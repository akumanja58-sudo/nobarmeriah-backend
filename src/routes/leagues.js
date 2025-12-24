const express = require('express');
const router = express.Router();
const apiFootball = require('../services/apiFootball');

/**
 * GET /api/leagues
 * Get all available leagues
 */
router.get('/', async (req, res) => {
    try {
        const { country, season, current } = req.query;

        const params = {};
        if (country) params.country = country;
        if (season) params.season = season;
        if (current === 'true') params.current = 'true';

        const result = await apiFootball.getLeagues(params);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error
            });
        }

        // Transform league data
        const leagues = result.data.map(item => ({
            id: item.league.id,
            name: item.league.name,
            type: item.league.type,
            logo: item.league.logo,
            country: item.country.name,
            country_code: item.country.code,
            country_flag: item.country.flag,
            seasons: item.seasons?.map(s => ({
                year: s.year,
                start: s.start,
                end: s.end,
                current: s.current
            }))
        }));

        res.json({
            success: true,
            count: leagues.length,
            leagues: leagues
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/leagues/popular
 * Get popular leagues (yang udah di-define)
 */
router.get('/popular', async (req, res) => {
    try {
        const popularIds = apiFootball.POPULAR_LEAGUES;
        
        const result = await apiFootball.getLeagues();

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error
            });
        }

        // Filter only popular leagues
        const popularLeagues = result.data
            .filter(item => popularIds.includes(item.league.id))
            .map(item => ({
                id: item.league.id,
                name: item.league.name,
                type: item.league.type,
                logo: item.league.logo,
                country: item.country.name,
                country_code: item.country.code,
                country_flag: item.country.flag
            }));

        // Sort by priority (sesuai urutan di POPULAR_LEAGUES)
        popularLeagues.sort((a, b) => {
            return popularIds.indexOf(a.id) - popularIds.indexOf(b.id);
        });

        res.json({
            success: true,
            count: popularLeagues.length,
            leagues: popularLeagues
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/leagues/:id
 * Get league detail
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await apiFootball.getLeagues({ id });

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error
            });
        }

        if (result.data.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'League not found'
            });
        }

        const item = result.data[0];
        const league = {
            id: item.league.id,
            name: item.league.name,
            type: item.league.type,
            logo: item.league.logo,
            country: item.country.name,
            country_code: item.country.code,
            country_flag: item.country.flag,
            seasons: item.seasons
        };

        res.json({
            success: true,
            league: league
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
