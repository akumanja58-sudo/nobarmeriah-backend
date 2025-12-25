const express = require('express');
const router = express.Router();
const apiFootball = require('../services/apiFootball');
const matchSync = require('../services/matchSync');

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

        // Group by league
        const groupedByLeague = matches.reduce((acc, match) => {
            const leagueName = match.league_name;
            if (!acc[leagueName]) {
                acc[leagueName] = {
                    league_id: match.league_id,
                    league_name: match.league_name,
                    league_country: match.league_country,
                    league_logo: match.league_logo,
                    league_flag: match.league_flag,
                    matches: []
                };
            }
            acc[leagueName].matches.push(match);
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
