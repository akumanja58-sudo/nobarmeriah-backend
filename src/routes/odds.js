// routes/odds.js
// Route untuk fetch match odds

const express = require('express');
const router = express.Router();
const apiFootball = require('../services/apiFootball');

/**
 * GET /api/odds/:fixtureId
 * Get odds for a specific match
 */
router.get('/:fixtureId', async (req, res) => {
    try {
        const { fixtureId } = req.params;

        if (!fixtureId) {
            return res.status(400).json({
                success: false,
                error: 'Fixture ID is required'
            });
        }

        console.log(`📊 Fetching odds for fixture ${fixtureId}`);

        const result = await apiFootball.getOdds(fixtureId);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error || 'Failed to fetch odds'
            });
        }

        // Extract bets from response
        const oddsData = result.data?.[0]?.bookmakers?.[0]?.bets || [];

        res.json({
            success: true,
            data: oddsData,
            bookmaker: result.data?.[0]?.bookmakers?.[0]?.name || 'Unknown',
            fixture: fixtureId
        });

    } catch (error) {
        console.error('❌ Odds route error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/odds/live/:fixtureId
 * Get live/in-play odds for a specific match
 */
router.get('/live/:fixtureId', async (req, res) => {
    try {
        const { fixtureId } = req.params;

        if (!fixtureId) {
            return res.status(400).json({
                success: false,
                error: 'Fixture ID is required'
            });
        }

        console.log(`📊 Fetching live odds for fixture ${fixtureId}`);

        const result = await apiFootball.getLiveOdds(fixtureId);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error || 'Failed to fetch live odds'
            });
        }

        res.json({
            success: true,
            data: result.data,
            fixture: fixtureId
        });

    } catch (error) {
        console.error('❌ Live odds route error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
