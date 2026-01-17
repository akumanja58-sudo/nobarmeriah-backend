const express = require('express');
const router = express.Router();
const apiFootball = require('../services/apiFootball');
const matchSync = require('../services/matchSync');
const { supabase } = require('../config/database');

/**
 * GET /api/matches/top-players
 * Get top rated players from today's finished matches
 */
router.get('/top-players', async (req, res) => {
    try {
        const { limit = 3 } = req.query;

        // Get today's date range
        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();

        // First, get finished matches from today from database
        const { data: finishedMatches, error: dbError } = await supabase
            .from('matches')
            .select('id, home_team_name, away_team_name, home_score, away_score, league_name')
            .gte('date', startOfDay)
            .lt('date', endOfDay)
            .in('status_short', ['FT', 'AET', 'PEN'])
            .limit(10);

        if (dbError) {
            console.error('❌ DB Error fetching finished matches:', dbError);
        }

        const allPlayers = [];
        const matchesToProcess = finishedMatches || [];

        console.log(`🏆 Found ${matchesToProcess.length} finished matches today for top players`);

        // Fetch player stats for each finished match (max 5 to avoid API overload)
        for (const match of matchesToProcess.slice(0, 5)) {
            try {
                // Fetch fixture/players endpoint which includes ratings
                const playersResult = await apiFootball.request('/fixtures/players', { fixture: match.id });

                if (playersResult.success && playersResult.data) {
                    playersResult.data.forEach(teamPlayers => {
                        const players = teamPlayers.players || [];
                        players.forEach(playerStats => {
                            const player = playerStats.player;
                            const stats = playerStats.statistics?.[0];
                            const rating = stats?.games?.rating;

                            if (rating && parseFloat(rating) >= 7.0) {
                                allPlayers.push({
                                    id: player?.id,
                                    name: player?.name || 'Unknown',
                                    photo: player?.photo || `https://media.api-sports.io/football/players/${player?.id}.png`,
                                    position: translatePosition(stats?.games?.position),
                                    rating: parseFloat(rating),
                                    matchId: match.id,
                                    matchScore: `${match.home_score} - ${match.away_score}`,
                                    league: match.league_name,
                                    goals: stats?.goals?.total || 0,
                                    assists: stats?.goals?.assists || 0,
                                });
                            }
                        });
                    });
                }
            } catch (apiErr) {
                console.log(`⚠️ Could not fetch players for match ${match.id}:`, apiErr.message);
            }
        }

        // Sort by rating descending
        allPlayers.sort((a, b) => b.rating - a.rating);

        // Get top N players
        const topPlayers = allPlayers.slice(0, parseInt(limit)).map((p, idx) => ({
            rank: idx + 1,
            id: p.id,
            name: p.name,
            photo: p.photo,
            position: p.position,
            rating: p.rating.toFixed(1),
            stats: p.matchScore,
            league: p.league,
            goals: p.goals,
            assists: p.assists,
            initial: (p.name || 'U')[0].toUpperCase(),
            color: getRatingColor(p.rating),
        }));

        // If no players found, return placeholder message
        if (topPlayers.length === 0) {
            console.log('⚠️ No rated players found - returning placeholder');
            return res.json({
                success: true,
                data: [],
                message: 'Belum ada data rating pemain untuk match hari ini. Data biasanya tersedia untuk liga-liga top (Premier League, La Liga, Serie A, dll).',
                totalMatches: matchesToProcess.length,
                lastUpdated: new Date().toISOString()
            });
        }

        console.log(`🏆 Top ${topPlayers.length} players:`, topPlayers.map(p => `${p.name} (${p.rating})`).join(', '));

        res.json({
            success: true,
            data: topPlayers,
            totalMatches: matchesToProcess.length,
            lastUpdated: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Top players error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Helper: Translate position to Indonesian
function translatePosition(pos) {
    const positions = {
        'G': 'Kiper',
        'D': 'Bek',
        'M': 'Gelandang',
        'F': 'Penyerang',
        'Goalkeeper': 'Kiper',
        'Defender': 'Bek',
        'Midfielder': 'Gelandang',
        'Attacker': 'Penyerang',
    };
    return positions[pos] || 'Pemain';
}

// Helper: Get rating color
function getRatingColor(rating) {
    if (rating >= 9.0) return '#10B981'; // Green
    if (rating >= 8.5) return '#34D399'; // Light Green  
    if (rating >= 8.0) return '#FBBF24'; // Yellow
    if (rating >= 7.5) return '#F97316'; // Orange
    return '#EF4444'; // Red
}

/**
 * GET /api/matches/archived
 * Get archived/finished matches from database
 */
router.get('/archived', async (req, res) => {
    try {
        const { limit = 20, offset = 0, league, date_from, date_to } = req.query;

        if (!supabase) {
            return res.status(500).json({
                success: false,
                error: 'Database not configured'
            });
        }

        // Build query for finished matches
        let query = supabase
            .from('matches')
            .select('*')
            .in('status_short', ['FT', 'AET', 'PEN', 'AWD', 'WO']) // Finished statuses
            .order('date', { ascending: false })
            .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

        // Optional filters
        if (league) {
            query = query.eq('league_id', parseInt(league));
        }

        if (date_from) {
            query = query.gte('date', date_from);
        }

        if (date_to) {
            query = query.lte('date', date_to);
        }

        const { data, error, count } = await query;

        if (error) {
            console.error('❌ Archive query error:', error);
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }

        // Transform to frontend format
        const matches = (data || []).map(match => ({
            id: match.id,
            fixture_id: match.id,
            date: match.date,
            match_date: match.date,
            local_date: new Date(match.date).toLocaleDateString('id-ID', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            }),
            kickoff_date: match.date,
            timestamp: match.timestamp,
            venue: match.venue,
            venue_city: match.venue_city,
            status: match.status,
            status_short: match.status_short,
            status_long: match.status_long,
            elapsed: match.elapsed,
            is_live: false,
            is_finished: true,
            league_id: match.league_id,
            league_name: match.league_name,
            league_country: match.league_country,
            league_logo: match.league_logo,
            league_flag: match.league_flag,
            league_round: match.league_round,
            home_team_id: match.home_team_id,
            home_team: match.home_team_name,
            home_team_name: match.home_team_name,
            home_team_logo: match.home_team_logo,
            home_logo: match.home_team_logo,
            away_team_id: match.away_team_id,
            away_team: match.away_team_name,
            away_team_name: match.away_team_name,
            away_team_logo: match.away_team_logo,
            away_logo: match.away_team_logo,
            home_score: match.home_score,
            away_score: match.away_score,
            ht_home: match.ht_home,
            ht_away: match.ht_away,
            ft_home: match.ft_home,
            ft_away: match.ft_away,
            source: 'database'
        }));

        console.log(`📦 Archive: Found ${matches.length} finished matches`);

        res.json({
            success: true,
            data: {
                matches: matches,
                total: matches.length,
                offset: parseInt(offset),
                limit: parseInt(limit),
                hasMore: matches.length === parseInt(limit)
            },
            lastUpdated: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Archive error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/matches/archived/stats
 * Get archive statistics
 */
router.get('/archived/stats', async (req, res) => {
    try {
        if (!supabase) {
            return res.status(500).json({
                success: false,
                error: 'Database not configured'
            });
        }

        // Get archived count (finished matches)
        const { count: archivedCount, error: archivedError } = await supabase
            .from('matches')
            .select('*', { count: 'exact', head: true })
            .in('status_short', ['FT', 'AET', 'PEN', 'AWD', 'WO']);

        // Get active count (not finished)
        const { count: activeCount, error: activeError } = await supabase
            .from('matches')
            .select('*', { count: 'exact', head: true })
            .not('status_short', 'in', '("FT","AET","PEN","AWD","WO")');

        // Get total count
        const { count: totalCount, error: totalError } = await supabase
            .from('matches')
            .select('*', { count: 'exact', head: true });

        if (archivedError || activeError || totalError) {
            console.error('❌ Stats query error:', archivedError || activeError || totalError);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch stats'
            });
        }

        const stats = {
            archived_matches: archivedCount || 0,
            active_matches: activeCount || 0,
            total_matches: totalCount || 0
        };

        console.log(`📊 Archive stats:`, stats);

        res.json({
            success: true,
            stats: stats,
            lastUpdated: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Stats error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/matches
 * Get all matches (today + live by default)
 */
router.get('/', async (req, res) => {
    try {
        const { date, league, live } = req.query;

        let result;

        if (live === 'true') {
            // Get live matches only
            result = await apiFootball.getLiveMatches();
        } else if (date) {
            // Get matches by specific date
            result = await apiFootball.getMatchesByDate(date);
        } else if (league) {
            // Get matches by league
            result = await apiFootball.getMatchesByLeague(league);
        } else {
            // Default: get today's matches + any LIVE matches (including from yesterday)
            console.log('📅 Fetching today matches + live matches...');

            // Fetch both in parallel
            const [todayResult, liveResult] = await Promise.all([
                apiFootball.getTodayMatches(),
                apiFootball.getLiveMatches()
            ]);

            // Combine results
            const todayMatches = todayResult.success ? todayResult.data : [];
            const liveMatches = liveResult.success ? liveResult.data : [];

            // Merge and deduplicate by fixture ID
            const matchMap = new Map();

            // Add today's matches first
            for (const match of todayMatches) {
                matchMap.set(match.fixture.id, match);
            }

            // Add/update with live matches (live data is more current)
            for (const match of liveMatches) {
                matchMap.set(match.fixture.id, match);
            }

            const combinedMatches = Array.from(matchMap.values());

            console.log(`✅ Combined: ${todayMatches.length} today + ${liveMatches.length} live = ${combinedMatches.length} unique matches`);

            result = {
                success: true,
                data: combinedMatches
            };
        }

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error
            });
        }

        // Transform data ke format yang clean
        const matches = matchSync.transformMatches(result.data);

        // League Tier Priority (lower = more important)
        const TIER_1_LEAGUES = [
            // Top 5 Leagues
            'Premier League',
            'La Liga',
            'Serie A',
            'Bundesliga',
            'Ligue 1',
            // European Competitions
            'UEFA Champions League',
            'Champions League',
            'UEFA Europa League',
            'Europa League',
            'UEFA Europa Conference League',
            'Conference League',
            // International
            'World Cup',
            'UEFA Euro',
            'Euro Championship',
            'Copa America',
            'AFC Asian Cup',
            // Indonesia
            'Liga 1',
            'BRI Liga 1'
        ];

        const TIER_2_LEAGUES = [
            'Eredivisie',
            'Primeira Liga',
            'Liga Portugal',
            'Belgian Pro League',
            'Scottish Premiership',
            'Championship',
            'Liga 2',
            'Serie B',
            'La Liga 2',
            '2. Bundesliga',
            'Ligue 2',
            'MLS',
            'Saudi Pro League',
            'Super Lig'
        ];

        // Function to get league tier
        const getLeagueTier = (leagueName) => {
            if (!leagueName) return 99;
            const name = leagueName.toLowerCase();

            // Check TIER 1
            for (const league of TIER_1_LEAGUES) {
                if (name.includes(league.toLowerCase())) return 1;
            }

            // Check TIER 2
            for (const league of TIER_2_LEAGUES) {
                if (name.includes(league.toLowerCase())) return 2;
            }

            // Default tier
            return 3;
        };

        // Sort: LIVE first, then by tier, then by kickoff time
        matches.sort((a, b) => {
            const aLive = a.is_live || ['1H', '2H', 'HT', 'ET', 'BT', 'P'].includes(a.status_short);
            const bLive = b.is_live || ['1H', '2H', 'HT', 'ET', 'BT', 'P'].includes(b.status_short);

            // 1. LIVE matches first
            if (aLive && !bLive) return -1;
            if (!aLive && bLive) return 1;

            // 2. If both LIVE or both not LIVE, sort by tier
            const aTier = getLeagueTier(a.league_name);
            const bTier = getLeagueTier(b.league_name);

            if (aTier !== bTier) return aTier - bTier;

            // 3. Same tier, sort by kickoff time
            return new Date(a.date) - new Date(b.date);
        });

        console.log('📊 Sorted matches by: LIVE → Tier → Kickoff time');

        // Group by league (using league_id to avoid mixing leagues with same name)
        const groupedByLeague = matches.reduce((acc, match) => {
            const leagueKey = `${match.league_id}`; // Use league_id as unique key
            if (!acc[leagueKey]) {
                acc[leagueKey] = {
                    league_id: match.league_id,
                    league_name: match.league_name,
                    league_country: match.league_country,
                    league_logo: match.league_logo,
                    league_flag: match.league_flag,
                    matches: []
                };
            }
            acc[leagueKey].matches.push(match);
            return acc;
        }, {});

        res.json({
            success: true,
            count: matches.length,
            matches: matches,
            grouped: Object.values(groupedByLeague),
            lastUpdated: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/matches/live
 * Get live matches only
 */
router.get('/live', async (req, res) => {
    try {
        const result = await apiFootball.getLiveMatches();

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error
            });
        }

        const matches = matchSync.transformMatches(result.data);

        res.json({
            success: true,
            count: matches.length,
            matches: matches,
            lastUpdated: new Date().toISOString()
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/matches/:id
 * Get match detail
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { stats, events, lineups } = req.query;

        // Get basic match info
        const matchResult = await apiFootball.getMatchById(id);

        if (!matchResult.success || matchResult.data.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Match not found'
            });
        }

        const match = matchSync.transformMatch(matchResult.data[0]);
        const response = { match };

        // Optionally fetch additional data
        if (stats === 'true') {
            const statsResult = await apiFootball.getMatchStatistics(id);
            if (statsResult.success) {
                response.statistics = statsResult.data;
            }
        }

        if (events === 'true') {
            const eventsResult = await apiFootball.getMatchEvents(id);
            if (eventsResult.success) {
                response.events = eventsResult.data;
            }
        }

        if (lineups === 'true') {
            const lineupsResult = await apiFootball.getMatchLineups(id);
            if (lineupsResult.success) {
                response.lineups = lineupsResult.data;
            }
        }

        res.json({
            success: true,
            ...response
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/matches/date/:date
 * Get matches by date (format: YYYY-MM-DD)
 */
router.get('/date/:date', async (req, res) => {
    try {
        const { date } = req.params;

        // Validate date format
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid date format. Use YYYY-MM-DD'
            });
        }

        const result = await apiFootball.getMatchesByDate(date);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error
            });
        }

        const matches = matchSync.transformMatches(result.data);

        res.json({
            success: true,
            date: date,
            count: matches.length,
            matches: matches,
            lastUpdated: new Date().toISOString()
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/matches/league/:leagueId
 * Get matches by league
 */
router.get('/league/:leagueId', async (req, res) => {
    try {
        const { leagueId } = req.params;
        const { date, season } = req.query;

        let result;

        if (date) {
            result = await apiFootball.getFixtures({
                league: leagueId,
                date: date
            });
        } else {
            result = await apiFootball.getMatchesByLeague(leagueId, season);
        }

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error
            });
        }

        const matches = matchSync.transformMatches(result.data);

        res.json({
            success: true,
            league_id: leagueId,
            count: matches.length,
            matches: matches,
            lastUpdated: new Date().toISOString()
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
