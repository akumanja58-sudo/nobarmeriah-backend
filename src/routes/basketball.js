/**
 * Basketball Routes
 * Endpoints for Basketball data (NBA, Euroleague, etc)
 */

const express = require('express');
const router = express.Router();
const apiBasketball = require('../services/apiBasketball');

// ============================================================
// CONSTANTS - Popular Leagues
// ============================================================

const POPULAR_LEAGUES = {
    // USA
    12: 'NBA',
    13: 'NBA G-League',
    // Europe
    120: 'Euroleague',
    202: 'Eurocup',
    // Domestic Leagues
    117: 'Liga ACB (Spain)',
    146: 'Lega A (Italy)',
    79: 'Pro A (France)',
    132: 'BBL (Germany)',
    149: 'BSL (Turkey)',
    // Asia
    232: 'CBA (China)',
    234: 'KBL (Korea)',
    161: 'B.League (Japan)',
    172: 'PBA (Philippines)',
    // Australia
    191: 'NBL (Australia)'
};

const LEAGUE_TIERS = {
    // Tier 1 - Top leagues
    tier1: [12, 120, 202], // NBA, Euroleague, Eurocup
    // Tier 2 - Major domestic
    tier2: [117, 146, 79, 132, 149],
    // Tier 3 - Asia/Pacific
    tier3: [232, 234, 161, 172, 191]
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
 * GET /api/basketball
 * Get today's basketball games
 */
router.get('/', async (req, res) => {
    try {
        const { date, live_only } = req.query;

        console.log(`🏀 GET /api/basketball ${date ? `(date: ${date})` : '(today)'}`);

        let result;

        if (live_only === 'true') {
            result = await apiBasketball.getLiveGames();
        } else if (date) {
            result = await apiBasketball.getGamesByDate(date);
        } else {
            result = await apiBasketball.getTodayGames();
        }

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error
            });
        }

        // Transform games
        const games = apiBasketball.transformGames(result.data);

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
        console.error('❌ Basketball games error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/basketball/live
 * Get live basketball games only
 */
router.get('/live', async (req, res) => {
    try {
        console.log('🏀 GET /api/basketball/live');

        const result = await apiBasketball.getLiveGames();

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error
            });
        }

        const games = apiBasketball.transformGames(result.data);
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
        console.error('❌ Basketball live error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/basketball/leagues
 * Get all basketball leagues
 */
router.get('/leagues', async (req, res) => {
    try {
        console.log('🏀 GET /api/basketball/leagues');

        const result = await apiBasketball.getLeagues();

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
        console.error('❌ Basketball leagues error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/basketball/standings/:leagueId
 * Get standings for a league
 */
router.get('/standings/:leagueId', async (req, res) => {
    try {
        const { leagueId } = req.params;
        const { season } = req.query;

        // Default to current season
        const currentSeason = season || '2024-2025';

        console.log(`🏀 GET /api/basketball/standings/${leagueId} (season: ${currentSeason})`);

        const result = await apiBasketball.getStandings(leagueId, currentSeason);

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
        console.error('❌ Basketball standings error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/basketball/game/:gameId
 * Get game detail
 */
router.get('/game/:gameId', async (req, res) => {
    try {
        const { gameId } = req.params;

        console.log(`🏀 GET /api/basketball/game/${gameId}`);

        const result = await apiBasketball.getGameById(gameId);

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

        const game = apiBasketball.transformGame(result.data[0]);

        res.json({
            success: true,
            game: game,
            lastUpdated: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Basketball game error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/basketball/game/:gameId/statistics
 * Get game statistics
 */
router.get('/game/:gameId/statistics', async (req, res) => {
    try {
        const { gameId } = req.params;

        console.log(`🏀 GET /api/basketball/game/${gameId}/statistics`);

        const result = await apiBasketball.getGameStatistics(gameId);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error
            });
        }

        res.json({
            success: true,
            statistics: result.data,
            lastUpdated: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Basketball statistics error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/basketball/h2h
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

        console.log(`🏀 GET /api/basketball/h2h (${team1} vs ${team2})`);

        const result = await apiBasketball.getH2H(team1, team2);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error
            });
        }

        const games = apiBasketball.transformGames(result.data);

        res.json({
            success: true,
            h2h: games,
            lastUpdated: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Basketball H2H error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/basketball/team/:teamId
 * Get team info
 */
router.get('/team/:teamId', async (req, res) => {
    try {
        const { teamId } = req.params;

        console.log(`🏀 GET /api/basketball/team/${teamId}`);

        const result = await apiBasketball.getTeamById(teamId);

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
        console.error('❌ Basketball team error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/basketball/odds/:gameId
 * Get odds for a game
 */
router.get('/odds/:gameId', async (req, res) => {
    try {
        const { gameId } = req.params;

        console.log(`🏀 GET /api/basketball/odds/${gameId}`);

        const result = await apiBasketball.getOdds(gameId);

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
        console.error('❌ Basketball odds error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
