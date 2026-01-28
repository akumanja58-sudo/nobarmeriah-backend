/**
 * Volleyball Routes
 * Endpoints for Volleyball data (CEV Champions League, SuperLega, etc)
 */

const express = require('express');
const router = express.Router();
const apiVolleyball = require('../services/apiVolleyball');

// ============================================================
// CONSTANTS - Popular Leagues
// ============================================================

const POPULAR_LEAGUES = {
    // International / Europe
    47: 'CEV Champions League',
    181: 'CEV Cup',
    // Italy
    97: 'SuperLega (Italy)',
    98: 'Serie A1 Women (Italy)',
    // Poland
    66: 'PlusLiga (Poland)',
    // Russia
    75: 'Super League (Russia)',
    // Turkey
    82: 'Efeler Ligi (Turkey)',
    83: 'Sultanlar Ligi Women (Turkey)',
    // Brazil
    1: 'Superliga (Brazil)',
    2: 'Superliga Women (Brazil)',
    // France
    54: 'Ligue A (France)',
    // Germany
    31: 'Bundesliga (Germany)',
    // Japan
    113: 'V.League (Japan)',
    // Korea
    123: 'V-League (Korea)'
};

const LEAGUE_TIERS = {
    // Tier 1 - Top international & leagues
    tier1: [47, 181, 97, 66, 1],  // CEV CL, CEV Cup, SuperLega, PlusLiga, Brazil Superliga
    // Tier 2 - Major domestic
    tier2: [75, 82, 54, 31, 98, 2],
    // Tier 3 - Asia
    tier3: [113, 123, 83]
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Get league tier for sorting
 */
function getLeagueTier(leagueId) {
    if (LEAGUE_TIERS.tier1.includes(leagueId)) return 1;
    if (LEAGUE_TIERS.tier2.includes(leagueId)) return 2;
    if (LEAGUE_TIERS.tier3.includes(leagueId)) return 3;
    return 4;
}

/**
 * Sort games by: Live first, then tier, then time
 */
function sortGames(games) {
    return games.sort((a, b) => {
        // 1. Live games first
        if (a.isLive && !b.isLive) return -1;
        if (!a.isLive && b.isLive) return 1;

        // 2. Sort by league tier
        const tierA = getLeagueTier(a.league?.id);
        const tierB = getLeagueTier(b.league?.id);
        if (tierA !== tierB) return tierA - tierB;

        // 3. Sort by time
        return new Date(a.date) - new Date(b.date);
    });
}

/**
 * Group games by league
 */
function groupByLeague(games) {
    const grouped = {};

    games.forEach(game => {
        const leagueId = game.league?.id || 'unknown';

        if (!grouped[leagueId]) {
            grouped[leagueId] = {
                league_id: leagueId,
                league_name: game.league?.name || 'Unknown League',
                league_logo: game.league?.logo,
                league_type: game.league?.type,
                country: game.country?.name,
                country_flag: game.country?.flag,
                tier: getLeagueTier(leagueId),
                games: []
            };
        }

        grouped[leagueId].games.push(game);
    });

    // Sort groups by tier
    return Object.values(grouped).sort((a, b) => a.tier - b.tier);
}

// ============================================================
// ROUTES
// ============================================================

/**
 * GET /api/volleyball
 * Get today's volleyball games
 */
router.get('/', async (req, res) => {
    try {
        const { date, live_only } = req.query;

        console.log(`🏐 GET /api/volleyball ${date ? `(date: ${date})` : '(today)'}`);

        let result;

        if (live_only === 'true') {
            result = await apiVolleyball.getLiveGames();
        } else if (date) {
            result = await apiVolleyball.getGamesByDate(date);
        } else {
            result = await apiVolleyball.getTodayGames();
        }

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error
            });
        }

        // Transform games
        const games = apiVolleyball.transformGames(result.data);

        // Sort games
        const sortedGames = sortGames(games);

        // Group by league
        const grouped = groupByLeague(sortedGames);

        // Count stats
        const liveCount = games.filter(g => g.isLive).length;
        const finishedCount = games.filter(g => g.isFinished).length;
        const scheduledCount = games.filter(g => !g.isLive && !g.isFinished).length;

        res.json({
            success: true,
            count: games.length,
            stats: {
                live: liveCount,
                finished: finishedCount,
                scheduled: scheduledCount
            },
            games: sortedGames,
            grouped: grouped,
            lastUpdated: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Volleyball games error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/volleyball/live
 * Get live volleyball games only
 */
router.get('/live', async (req, res) => {
    try {
        console.log('🏐 GET /api/volleyball/live');

        const result = await apiVolleyball.getLiveGames();

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error
            });
        }

        const games = apiVolleyball.transformGames(result.data);
        const sortedGames = sortGames(games);
        const grouped = groupByLeague(sortedGames);

        res.json({
            success: true,
            count: games.length,
            games: sortedGames,
            grouped: grouped,
            lastUpdated: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Volleyball live error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/volleyball/leagues
 * Get all volleyball leagues
 */
router.get('/leagues', async (req, res) => {
    try {
        console.log('🏐 GET /api/volleyball/leagues');

        const result = await apiVolleyball.getLeagues();

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error
            });
        }

        // Mark popular leagues
        const leagues = result.data.map(league => ({
            ...league,
            isPopular: !!POPULAR_LEAGUES[league.id],
            tier: getLeagueTier(league.id)
        }));

        // Sort by tier
        leagues.sort((a, b) => a.tier - b.tier);

        res.json({
            success: true,
            count: leagues.length,
            leagues: leagues,
            popularLeagues: Object.entries(POPULAR_LEAGUES).map(([id, name]) => ({
                id: parseInt(id),
                name
            })),
            lastUpdated: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Volleyball leagues error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/volleyball/standings/:leagueId
 * Get standings for a league
 */
router.get('/standings/:leagueId', async (req, res) => {
    try {
        const { leagueId } = req.params;
        const { season } = req.query;

        // Default to current season
        const currentSeason = season || '2024';

        console.log(`🏐 GET /api/volleyball/standings/${leagueId} (season: ${currentSeason})`);

        const result = await apiVolleyball.getStandings(leagueId, currentSeason);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error
            });
        }

        res.json({
            success: true,
            leagueId: leagueId,
            season: currentSeason,
            standings: result.data,
            lastUpdated: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Volleyball standings error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/volleyball/game/:gameId
 * Get game detail
 */
router.get('/game/:gameId', async (req, res) => {
    try {
        const { gameId } = req.params;

        console.log(`🏐 GET /api/volleyball/game/${gameId}`);

        const result = await apiVolleyball.getGameById(gameId);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error
            });
        }

        if (!result.data || result.data.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Game not found'
            });
        }

        const game = apiVolleyball.transformGame(result.data[0]);

        res.json({
            success: true,
            game: game,
            lastUpdated: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Volleyball game error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/volleyball/h2h
 * Get head to head between two teams
 */
router.get('/h2h', async (req, res) => {
    try {
        const { team1, team2 } = req.query;

        if (!team1 || !team2) {
            return res.status(400).json({
                success: false,
                error: 'Both team1 and team2 query params are required'
            });
        }

        console.log(`🏐 GET /api/volleyball/h2h (${team1} vs ${team2})`);

        const result = await apiVolleyball.getH2H(team1, team2);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error
            });
        }

        const games = apiVolleyball.transformGames(result.data);

        res.json({
            success: true,
            h2h: games,
            lastUpdated: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Volleyball H2H error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/volleyball/team/:teamId
 * Get team info
 */
router.get('/team/:teamId', async (req, res) => {
    try {
        const { teamId } = req.params;

        console.log(`🏐 GET /api/volleyball/team/${teamId}`);

        const result = await apiVolleyball.getTeamById(teamId);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error
            });
        }

        if (!result.data || result.data.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Team not found'
            });
        }

        res.json({
            success: true,
            team: result.data[0],
            lastUpdated: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Volleyball team error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/volleyball/odds/:gameId
 * Get odds for a game
 */
router.get('/odds/:gameId', async (req, res) => {
    try {
        const { gameId } = req.params;

        console.log(`🏐 GET /api/volleyball/odds/${gameId}`);

        const result = await apiVolleyball.getOdds(gameId);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error
            });
        }

        res.json({
            success: true,
            odds: result.data,
            lastUpdated: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Volleyball odds error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
