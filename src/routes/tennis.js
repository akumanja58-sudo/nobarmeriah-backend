/**
 * Tennis Routes
 * Endpoints for Tennis data (ATP, WTA, ITF)
 */

const express = require('express');
const router = express.Router();
const apiTennis = require('../services/apiTennis');

// ============================================================
// CONSTANTS
// ============================================================

// Tournament categories for grouping
const GRAND_SLAMS = [
    'australian open',
    'roland garros',
    'french open',
    'wimbledon',
    'us open'
];

const ATP_MASTERS = [
    'indian wells',
    'miami',
    'monte carlo',
    'madrid',
    'rome',
    'canada',
    'cincinnati',
    'shanghai',
    'paris'
];

// Event type priorities for sorting
const EVENT_TYPE_PRIORITY = {
    'Atp Singles': 1,
    'Wta Singles': 2,
    'Atp Doubles': 3,
    'Wta Doubles': 4,
    'Challenger Men Singles': 5,
    'Challenger Women Singles': 6,
    'Itf Men Singles': 7,
    'Itf Women Singles': 8,
    'Itf Men Doubles': 9,
    'Itf Women Doubles': 10
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Check if tournament is a Grand Slam
 */
function isGrandSlam(tournamentName) {
    if (!tournamentName) return false;
    const name = tournamentName.toLowerCase();
    return GRAND_SLAMS.some(gs => name.includes(gs));
}

/**
 * Check if tournament is ATP Masters 1000
 */
function isMasters(tournamentName) {
    if (!tournamentName) return false;
    const name = tournamentName.toLowerCase();
    return ATP_MASTERS.some(m => name.includes(m));
}

/**
 * Get tournament tier for sorting
 */
function getTournamentTier(match) {
    const tournamentName = match.tournament?.name || '';
    const eventType = match.eventType || '';
    
    // Grand Slams first
    if (isGrandSlam(tournamentName)) return 1;
    
    // ATP/WTA main tour
    if (eventType.includes('Atp Singles') || eventType.includes('Wta Singles')) {
        if (isMasters(tournamentName)) return 2;
        return 3;
    }
    
    // Doubles
    if (eventType.includes('Doubles')) return 4;
    
    // Challenger
    if (eventType.includes('Challenger')) return 5;
    
    // ITF
    if (eventType.includes('Itf')) return 6;
    
    return 7;
}

/**
 * Sort matches by: Live first, then tier, then time
 */
function sortMatches(matches) {
    return matches.sort((a, b) => {
        // 1. Live matches first
        if (a.isLive && !b.isLive) return -1;
        if (!a.isLive && b.isLive) return 1;
        
        // 2. Sort by tournament tier
        const tierA = getTournamentTier(a);
        const tierB = getTournamentTier(b);
        if (tierA !== tierB) return tierA - tierB;
        
        // 3. Sort by time
        const timeA = `${a.date} ${a.time}`;
        const timeB = `${b.date} ${b.time}`;
        return timeA.localeCompare(timeB);
    });
}

/**
 * Group matches by tournament
 */
function groupByTournament(matches) {
    const grouped = {};
    
    matches.forEach(match => {
        const key = match.tournament?.key || 'unknown';
        
        if (!grouped[key]) {
            grouped[key] = {
                tournament_key: match.tournament?.key,
                tournament_name: match.tournament?.name || 'Unknown Tournament',
                tournament_round: match.tournament?.round,
                event_type: match.eventType,
                tier: getTournamentTier(match),
                matches: []
            };
        }
        
        grouped[key].matches.push(match);
    });
    
    // Sort groups by tier
    return Object.values(grouped).sort((a, b) => a.tier - b.tier);
}

// ============================================================
// ROUTES
// ============================================================

/**
 * GET /api/tennis
 * Get today's tennis matches (live + scheduled + finished)
 */
router.get('/', async (req, res) => {
    try {
        const { date, live_only } = req.query;
        
        console.log(`🎾 GET /api/tennis ${date ? `(date: ${date})` : '(today)'}`);
        
        let result;
        
        if (live_only === 'true') {
            // Only live matches
            result = await apiTennis.getLiveMatches();
        } else if (date) {
            // Specific date
            result = await apiTennis.getMatchesByDate(date);
        } else {
            // Today's matches
            result = await apiTennis.getTodayMatches();
        }
        
        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error
            });
        }
        
        // Transform matches
        const matches = apiTennis.transformMatches(result.data);
        
        // Sort matches
        const sortedMatches = sortMatches(matches);
        
        // Group by tournament
        const grouped = groupByTournament(sortedMatches);
        
        // Count stats
        const liveCount = matches.filter(m => m.isLive).length;
        const finishedCount = matches.filter(m => m.isFinished).length;
        const scheduledCount = matches.filter(m => !m.isLive && !m.isFinished).length;
        
        res.json({
            success: true,
            count: matches.length,
            stats: {
                live: liveCount,
                finished: finishedCount,
                scheduled: scheduledCount
            },
            matches: sortedMatches,
            grouped: grouped,
            lastUpdated: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Tennis matches error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/tennis/live
 * Get live tennis matches only
 */
router.get('/live', async (req, res) => {
    try {
        console.log('🎾 GET /api/tennis/live');
        
        const result = await apiTennis.getLiveMatches();
        
        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error
            });
        }
        
        const matches = apiTennis.transformMatches(result.data);
        const sortedMatches = sortMatches(matches);
        const grouped = groupByTournament(sortedMatches);
        
        res.json({
            success: true,
            count: matches.length,
            matches: sortedMatches,
            grouped: grouped,
            lastUpdated: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Tennis live error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/tennis/rankings
 * Get ATP and WTA rankings
 */
router.get('/rankings', async (req, res) => {
    try {
        const { type, limit = 100 } = req.query;
        
        console.log(`🎾 GET /api/tennis/rankings (type: ${type || 'all'})`);
        
        let result;
        
        if (type === 'atp') {
            result = await apiTennis.getAtpRankings();
            if (result.success) {
                result.data = { atp: result.data, wta: [] };
            }
        } else if (type === 'wta') {
            result = await apiTennis.getWtaRankings();
            if (result.success) {
                result.data = { atp: [], wta: result.data };
            }
        } else {
            result = await apiTennis.getAllRankings();
        }
        
        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error
            });
        }
        
        // Transform and limit rankings
        const limitNum = parseInt(limit);
        const rankings = {
            atp: apiTennis.transformRankings(result.data.atp).slice(0, limitNum),
            wta: apiTennis.transformRankings(result.data.wta).slice(0, limitNum)
        };
        
        res.json({
            success: true,
            rankings: rankings,
            lastUpdated: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Tennis rankings error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/tennis/player/:playerKey
 * Get player profile
 */
router.get('/player/:playerKey', async (req, res) => {
    try {
        const { playerKey } = req.params;
        
        console.log(`🎾 GET /api/tennis/player/${playerKey}`);
        
        const result = await apiTennis.getPlayer(playerKey);
        
        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error
            });
        }
        
        if (!result.data || result.data.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Player not found'
            });
        }
        
        res.json({
            success: true,
            player: result.data[0],
            lastUpdated: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Tennis player error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/tennis/h2h
 * Get head to head between two players
 */
router.get('/h2h', async (req, res) => {
    try {
        const { player1, player2 } = req.query;
        
        if (!player1 || !player2) {
            return res.status(400).json({
                success: false,
                error: 'Both player1 and player2 query params are required'
            });
        }
        
        console.log(`🎾 GET /api/tennis/h2h (${player1} vs ${player2})`);
        
        const result = await apiTennis.getH2H(player1, player2);
        
        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error
            });
        }
        
        res.json({
            success: true,
            h2h: result.data,
            lastUpdated: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Tennis H2H error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/tennis/tournaments
 * Get all tournaments
 */
router.get('/tournaments', async (req, res) => {
    try {
        const { event_type } = req.query;
        
        console.log(`🎾 GET /api/tennis/tournaments`);
        
        const result = await apiTennis.getTournaments();
        
        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error
            });
        }
        
        let tournaments = result.data;
        
        // Filter by event type if specified
        if (event_type) {
            tournaments = tournaments.filter(t => 
                t.event_type_type?.toLowerCase().includes(event_type.toLowerCase())
            );
        }
        
        res.json({
            success: true,
            count: tournaments.length,
            tournaments: tournaments,
            lastUpdated: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Tennis tournaments error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/tennis/match/:matchKey
 * Get match detail with point by point
 */
router.get('/match/:matchKey', async (req, res) => {
    try {
        const { matchKey } = req.params;
        
        console.log(`🎾 GET /api/tennis/match/${matchKey}`);
        
        // Get match from fixtures
        const today = new Date().toISOString().split('T')[0];
        const result = await apiTennis.getFixtures(today, today, { match_key: matchKey });
        
        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error
            });
        }
        
        if (!result.data || result.data.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Match not found'
            });
        }
        
        const match = apiTennis.transformMatch(result.data[0]);
        
        res.json({
            success: true,
            match: match,
            lastUpdated: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Tennis match error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/tennis/odds/:matchKey
 * Get odds for a match
 */
router.get('/odds/:matchKey', async (req, res) => {
    try {
        const { matchKey } = req.params;
        
        console.log(`🎾 GET /api/tennis/odds/${matchKey}`);
        
        const result = await apiTennis.getOdds(matchKey);
        
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
        console.error('❌ Tennis odds error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
