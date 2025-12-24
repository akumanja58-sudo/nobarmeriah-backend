// routes/standings.js
// Route untuk fetch league standings/klasemen

const express = require('express');
const router = express.Router();
const apiFootball = require('../services/apiFootball');

/**
 * GET /api/standings
 * Get league standings
 * Query params: league (required), season (optional)
 */
router.get('/', async (req, res) => {
    try {
        const { league, season } = req.query;

        if (!league) {
            return res.status(400).json({
                success: false,
                error: 'League ID is required'
            });
        }

        console.log(`📊 Fetching standings for league ${league}, season ${season || 'current'}`);

        const result = await apiFootball.getStandings(league, season);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error || 'Failed to fetch standings'
            });
        }

        res.json({
            success: true,
            data: result.data,
            league: league,
            season: season || apiFootball.getCurrentSeason()
        });

    } catch (error) {
        console.error('❌ Standings route error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
