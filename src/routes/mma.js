/**
 * MMA Routes
 * Endpoints for MMA data (UFC, Bellator, ONE, PFL, etc)
 */

const express = require('express');
const router = express.Router();
const apiMMA = require('../services/apiMMA');

// ============================================================
// CONSTANTS - Popular Categories (Promotions)
// ============================================================

const POPULAR_CATEGORIES = {
    1: 'UFC',
    2: 'Bellator',
    3: 'ONE Championship',
    4: 'PFL',
    5: 'KSW',
    6: 'RIZIN',
    7: 'Cage Warriors',
    8: 'LFA',
    9: 'BKFC',
    10: 'Dana White\'s Contender Series'
};

const CATEGORY_TIERS = {
    tier1: [1],           // UFC
    tier2: [2, 3, 4],     // Bellator, ONE, PFL
    tier3: [5, 6, 7, 8, 9, 10]  // Regional / Other
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Get category tier for sorting
 */
function getCategoryTier(categoryId) {
    if (CATEGORY_TIERS.tier1.includes(categoryId)) return 1;
    if (CATEGORY_TIERS.tier2.includes(categoryId)) return 2;
    if (CATEGORY_TIERS.tier3.includes(categoryId)) return 3;
    return 4;
}

/**
 * Sort fights by: Live first, then tier, then time
 */
function sortFights(fights) {
    return fights.sort((a, b) => {
        // 1. Live fights first
        if (a.isLive && !b.isLive) return -1;
        if (!a.isLive && b.isLive) return 1;

        // 2. Sort by category tier
        const tierA = getCategoryTier(a.category?.id);
        const tierB = getCategoryTier(b.category?.id);
        if (tierA !== tierB) return tierA - tierB;

        // 3. Sort by date/time
        return new Date(a.date) - new Date(b.date);
    });
}

/**
 * Group fights by category (promotion)
 */
function groupByCategory(fights) {
    const grouped = {};

    fights.forEach(fight => {
        const catId = fight.category?.id || 'unknown';

        if (!grouped[catId]) {
            grouped[catId] = {
                category_id: catId,
                category_name: fight.category?.name || POPULAR_CATEGORIES[catId] || 'Unknown',
                category_logo: fight.category?.logo,
                country: fight.country?.name,
                country_flag: fight.country?.flag,
                tier: getCategoryTier(catId),
                fights: []
            };
        }

        grouped[catId].fights.push(fight);
    });

    // Sort groups by tier
    return Object.values(grouped).sort((a, b) => a.tier - b.tier);
}

// ============================================================
// ROUTES
// ============================================================

/**
 * GET /api/mma
 * Get today's MMA fights
 */
router.get('/', async (req, res) => {
    try {
        const { date, live_only } = req.query;

        console.log(`🥊 GET /api/mma ${date ? `(date: ${date})` : '(today)'}`);

        let result;

        if (live_only === 'true') {
            result = await apiMMA.getLiveFights();
        } else if (date) {
            result = await apiMMA.getFightsByDate(date);
        } else {
            result = await apiMMA.getTodayFights();
        }

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error
            });
        }

        // Transform fights
        const fights = apiMMA.transformFights(result.data);

        // Sort fights
        const sortedFights = sortFights(fights);

        // Group by category
        const grouped = groupByCategory(sortedFights);

        // Count stats
        const liveCount = fights.filter(f => f.isLive).length;
        const finishedCount = fights.filter(f => f.isFinished).length;
        const scheduledCount = fights.filter(f => !f.isLive && !f.isFinished).length;

        res.json({
            success: true,
            count: fights.length,
            stats: {
                live: liveCount,
                finished: finishedCount,
                scheduled: scheduledCount
            },
            fights: sortedFights,
            grouped: grouped,
            lastUpdated: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ MMA fights error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/mma/live
 * Get live MMA fights only
 */
router.get('/live', async (req, res) => {
    try {
        console.log('🥊 GET /api/mma/live');

        const result = await apiMMA.getLiveFights();

        if (!result.success) {
            return res.status(500).json({ success: false, error: result.error });
        }

        const fights = apiMMA.transformFights(result.data);
        const sortedFights = sortFights(fights);
        const grouped = groupByCategory(sortedFights);

        res.json({
            success: true,
            count: fights.length,
            fights: sortedFights,
            grouped: grouped,
            lastUpdated: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ MMA live error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/mma/upcoming
 * Get upcoming MMA fights
 */
router.get('/upcoming', async (req, res) => {
    try {
        const { limit } = req.query;
        console.log('🥊 GET /api/mma/upcoming');

        const result = await apiMMA.getUpcomingFights(parseInt(limit) || 20);

        if (!result.success) {
            return res.status(500).json({ success: false, error: result.error });
        }

        const fights = apiMMA.transformFights(result.data);
        const grouped = groupByCategory(fights);

        res.json({
            success: true,
            count: fights.length,
            fights: fights,
            grouped: grouped,
            lastUpdated: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ MMA upcoming error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/mma/categories
 * Get all MMA categories (promotions)
 */
router.get('/categories', async (req, res) => {
    try {
        console.log('🥊 GET /api/mma/categories');

        const result = await apiMMA.getCategories();

        if (!result.success) {
            return res.status(500).json({ success: false, error: result.error });
        }

        const categories = result.data.map(cat => ({
            ...cat,
            isPopular: !!POPULAR_CATEGORIES[cat.id],
            tier: getCategoryTier(cat.id)
        }));

        categories.sort((a, b) => a.tier - b.tier);

        res.json({
            success: true,
            count: categories.length,
            categories: categories,
            popularCategories: Object.entries(POPULAR_CATEGORIES).map(([id, name]) => ({
                id: parseInt(id),
                name
            })),
            lastUpdated: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ MMA categories error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/mma/fight/:fightId
 * Get fight detail
 */
router.get('/fight/:fightId', async (req, res) => {
    try {
        const { fightId } = req.params;

        console.log(`🥊 GET /api/mma/fight/${fightId}`);

        const result = await apiMMA.getFightById(fightId);

        if (!result.success) {
            return res.status(500).json({ success: false, error: result.error });
        }

        if (!result.data || result.data.length === 0) {
            return res.status(404).json({ success: false, error: 'Fight not found' });
        }

        const fight = apiMMA.transformFight(result.data[0]);

        res.json({
            success: true,
            fight: fight,
            lastUpdated: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ MMA fight error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/mma/fighter/:fighterId
 * Get fighter details
 */
router.get('/fighter/:fighterId', async (req, res) => {
    try {
        const { fighterId } = req.params;

        console.log(`🥊 GET /api/mma/fighter/${fighterId}`);

        const result = await apiMMA.getFighterById(fighterId);

        if (!result.success) {
            return res.status(500).json({ success: false, error: result.error });
        }

        if (!result.data || result.data.length === 0) {
            return res.status(404).json({ success: false, error: 'Fighter not found' });
        }

        const fighter = apiMMA.transformFighter(result.data[0]);

        res.json({
            success: true,
            fighter: fighter,
            lastUpdated: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ MMA fighter error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/mma/fighters/search
 * Search fighters by name
 */
router.get('/fighters/search', async (req, res) => {
    try {
        const { q } = req.query;

        if (!q) {
            return res.status(400).json({ success: false, error: 'Query parameter "q" is required' });
        }

        console.log(`🥊 GET /api/mma/fighters/search (q: ${q})`);

        const result = await apiMMA.searchFighters(q);

        if (!result.success) {
            return res.status(500).json({ success: false, error: result.error });
        }

        const fighters = apiMMA.transformFighters(result.data);

        res.json({
            success: true,
            count: fighters.length,
            fighters: fighters,
            lastUpdated: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ MMA fighter search error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/mma/odds/:fightId
 * Get odds for a fight
 */
router.get('/odds/:fightId', async (req, res) => {
    try {
        const { fightId } = req.params;

        console.log(`🥊 GET /api/mma/odds/${fightId}`);

        const result = await apiMMA.getOdds(fightId);

        if (!result.success) {
            return res.status(500).json({ success: false, error: result.error });
        }

        res.json({
            success: true,
            odds: result.data,
            lastUpdated: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ MMA odds error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
