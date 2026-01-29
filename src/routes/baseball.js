/**
 * Baseball Routes
 * Endpoints for Baseball data (MLB, NPB, KBO, etc)
 */

const express = require('express');
const router = express.Router();
const apiBaseball = require('../services/apiBaseball');

// ============================================================
// CONSTANTS - Popular Leagues
// ============================================================

const POPULAR_LEAGUES = {
    // USA
    1: 'MLB',
    // Japan
    2: 'NPB',
    // Korea
    3: 'KBO',
    // Taiwan
    4: 'CPBL',
    // Mexico
    5: 'LMB',
    // Cuba
    14: 'Serie Nacional',
    // Australia
    21: 'ABL'
};

const LEAGUE_TIERS = {
    // Tier 1 - Top leagues
    tier1: [1], // MLB
    // Tier 2 - Major Asian leagues
    tier2: [2, 3, 4], // NPB, KBO, CPBL
    // Tier 3 - Others
    tier3: [5, 14, 21]
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
 * GET /api/baseball
 * Get today's baseball games
 */
router.get('/', async (req, res) => {
    try {
        const { date, live_only } = req.query;

        console.log(`⚾ GET /api/baseball ${date ? `(date: ${date})` : '(today)'}`);

        let result;

        if (live_only === 'true') {
            result = await apiBaseball.getLiveGames();
        } else if (date) {
            result = await apiBaseball.getGamesByDate(date);
        } else {
            result = await apiBaseball.getTodayGames();
        }

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error
            });
        }

        // Transform games
        const games = apiBaseball.transformGames(result.data);

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
        console.error('❌ Baseball games error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/baseball/live
 * Get live baseball games only
 */
router.get('/live', async (req, res) => {
    try {
        console.log('⚾ GET /api/baseball/live');

        const result = await apiBaseball.getLiveGames();

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error
            });
        }

        const games = apiBaseball.transformGames(result.data);
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
        console.error('❌ Baseball live error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/baseball/leagues
 * Get all baseball leagues
 */
router.get('/leagues', async (req, res) => {
    try {
        console.log('⚾ GET /api/baseball/leagues');

        const result = await apiBaseball.getLeagues();

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
        console.error('❌ Baseball leagues error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/baseball/standings/:leagueId
 * Get standings for a league
 */
router.get('/standings/:leagueId', async (req, res) => {
    try {
        const { leagueId } = req.params;
        const { season } = req.query;

        // Default to current season
        const currentSeason = season || '2024';

        console.log(`⚾ GET /api/baseball/standings/${leagueId} (season: ${currentSeason})`);

        const result = await apiBaseball.getStandings(leagueId, currentSeason);

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
        console.error('❌ Baseball standings error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/baseball/game/:gameId
 * Get game detail
 */
router.get('/game/:gameId', async (req, res) => {
    try {
        const { gameId } = req.params;

        console.log(`⚾ GET /api/baseball/game/${gameId}`);

        const result = await apiBaseball.getGameById(gameId);

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

        const game = apiBaseball.transformGame(result.data[0]);

        res.json({
            success: true,
            game: game,
            lastUpdated: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Baseball game error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/baseball/h2h
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

        console.log(`⚾ GET /api/baseball/h2h (${team1} vs ${team2})`);

        const result = await apiBaseball.getH2H(team1, team2);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error
            });
        }

        const games = apiBaseball.transformGames(result.data);

        res.json({
            success: true,
            h2h: games,
            lastUpdated: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Baseball H2H error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/baseball/team/:teamId
 * Get team info
 */
router.get('/team/:teamId', async (req, res) => {
    try {
        const { teamId } = req.params;

        console.log(`⚾ GET /api/baseball/team/${teamId}`);

        const result = await apiBaseball.getTeamById(teamId);

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
        console.error('❌ Baseball team error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/baseball/odds/:gameId
 * Get odds for a game
 */
router.get('/odds/:gameId', async (req, res) => {
    try {
        const { gameId } = req.params;

        console.log(`⚾ GET /api/baseball/odds/${gameId}`);

        const result = await apiBaseball.getOdds(gameId);

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
        console.error('❌ Baseball odds error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
