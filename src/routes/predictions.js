// routes/predictions.js
// Route untuk fetch match predictions dari API-Football

const express = require('express');
const router = express.Router();
const apiFootball = require('../services/apiFootball');

/**
 * GET /api/predictions
 * Get match predictions
 * Query params: fixture (required) - fixture ID
 */
router.get('/', async (req, res) => {
    try {
        const { fixture } = req.query;

        if (!fixture) {
            return res.status(400).json({
                success: false,
                error: 'Fixture ID is required'
            });
        }

        console.log(`🔮 Fetching predictions for fixture ${fixture}`);

        const result = await apiFootball.getPredictions(fixture);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error || 'Failed to fetch predictions'
            });
        }

        const predictionsData = result.data || [];

        if (!predictionsData.length) {
            return res.json({
                success: true,
                predictions: null,
                message: 'No predictions available for this fixture'
            });
        }

        const prediction = predictionsData[0];

        // Transform to clean format
        const cleanPrediction = {
            // Winner prediction
            winner: {
                id: prediction.predictions?.winner?.id || null,
                name: prediction.predictions?.winner?.name || null,
                comment: prediction.predictions?.winner?.comment || null
            },
            
            // Win or draw
            win_or_draw: prediction.predictions?.win_or_draw || false,
            
            // Under/Over prediction
            under_over: prediction.predictions?.under_over || null,
            
            // Goals prediction
            goals: {
                home: prediction.predictions?.goals?.home || '-',
                away: prediction.predictions?.goals?.away || '-'
            },
            
            // Advice
            advice: prediction.predictions?.advice || null,
            
            // Percent chances
            percent: {
                home: prediction.predictions?.percent?.home || '0%',
                draw: prediction.predictions?.percent?.draw || '0%',
                away: prediction.predictions?.percent?.away || '0%'
            },
            
            // Team comparison
            comparison: {
                form: {
                    home: prediction.comparison?.form?.home || '0%',
                    away: prediction.comparison?.form?.away || '0%'
                },
                attack: {
                    home: prediction.comparison?.att?.home || '0%',
                    away: prediction.comparison?.att?.away || '0%'
                },
                defense: {
                    home: prediction.comparison?.def?.home || '0%',
                    away: prediction.comparison?.def?.away || '0%'
                },
                poisson: {
                    home: prediction.comparison?.poisson_distribution?.home || '0%',
                    away: prediction.comparison?.poisson_distribution?.away || '0%'
                },
                h2h: {
                    home: prediction.comparison?.h2h?.home || '0%',
                    away: prediction.comparison?.h2h?.away || '0%'
                },
                goals: {
                    home: prediction.comparison?.goals?.home || '0%',
                    away: prediction.comparison?.goals?.away || '0%'
                },
                total: {
                    home: prediction.comparison?.total?.home || '0%',
                    away: prediction.comparison?.total?.away || '0%'
                }
            },
            
            // Teams info
            teams: {
                home: {
                    id: prediction.teams?.home?.id,
                    name: prediction.teams?.home?.name,
                    logo: prediction.teams?.home?.logo,
                    last_5: prediction.teams?.home?.last_5 || {},
                    league: prediction.teams?.home?.league || {}
                },
                away: {
                    id: prediction.teams?.away?.id,
                    name: prediction.teams?.away?.name,
                    logo: prediction.teams?.away?.logo,
                    last_5: prediction.teams?.away?.last_5 || {},
                    league: prediction.teams?.away?.league || {}
                }
            },
            
            // H2H data
            h2h: prediction.h2h || []
        };

        console.log(`✅ Predictions fetched for fixture ${fixture}`);

        res.json({
            success: true,
            predictions: cleanPrediction
        });

    } catch (error) {
        console.error('❌ Predictions route error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
