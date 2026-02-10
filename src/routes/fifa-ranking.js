const express = require('express');
const router = express.Router();

// Zyla Labs FIFA Ranking API
const ZYLA_API_KEY = process.env.ZYLA_API_KEY || '12270|8rnZrHxc5b53Y0jhuz4i5yM7b4r8ViqmiR1B9MG1';
const ZYLA_BASE_URL = 'https://zylalabs.com/api/7847/fifa+ranking+information+api';

// Cache for FIFA rankings (update every 24 hours - rankings don't change often)
let fifaRankingsCache = null;
let fifaCacheTimestamp = null;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// ============================================================
// GET /api/fifa-ranking
// Get current FIFA World Rankings
// ============================================================
router.get('/', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10; // Default top 10

        // Check cache
        if (fifaRankingsCache && fifaCacheTimestamp && (Date.now() - fifaCacheTimestamp < CACHE_DURATION)) {
            console.log('📋 Returning cached FIFA rankings');
            return res.json({
                success: true,
                source: 'cache',
                data: fifaRankingsCache.slice(0, limit),
                total: fifaRankingsCache.length,
                cached_at: new Date(fifaCacheTimestamp).toISOString()
            });
        }

        console.log('🌐 Fetching FIFA rankings from Zyla Labs...');

        const response = await fetch(`${ZYLA_BASE_URL}/12882/get+ranking`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${ZYLA_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Zyla API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        // Parse the response - Zyla returns { date, ranking: [...] }
        let rankings = [];
        let rankingData = null;

        // Check different possible response formats
        if (Array.isArray(data)) {
            rankingData = data;
        } else if (data.ranking) {
            // Zyla API format: { date: "...", ranking: [...] }
            rankingData = data.ranking;
        } else if (data.rankings) {
            rankingData = data.rankings;
        }

        if (rankingData && Array.isArray(rankingData)) {
            rankings = rankingData.map((item, index) => ({
                rank: item.rank || index + 1,
                team: item.name || item.team || item.country || 'Unknown',
                points: parseFloat(item.points) || 0,
                previousPoints: parseFloat(item.previous_points) || 0,
                previousRank: item.previous_rank || item.rank || index + 1,
                change: (item.previous_rank || item.rank || index + 1) - (item.rank || index + 1), // positive = moved up
                confederation: item.confederation || '',
                flag: item.flag || null
            }));
        }

        console.log(`📊 Parsed ${rankings.length} rankings from Zyla API`);

        // Update cache
        fifaRankingsCache = rankings;
        fifaCacheTimestamp = Date.now();

        console.log(`✅ FIFA rankings fetched: ${rankings.length} teams`);

        res.json({
            success: true,
            source: 'api',
            data: rankings.slice(0, limit),
            total: rankings.length,
            fetched_at: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ FIFA Ranking API error:', error.message);

        // Return fallback data if API fails
        const fallbackData = [
            { rank: 1, team: 'Argentina', points: 1867.25, change: 0, confederation: 'CONMEBOL' },
            { rank: 2, team: 'France', points: 1859.78, change: 0, confederation: 'UEFA' },
            { rank: 3, team: 'Spain', points: 1845.50, change: 1, confederation: 'UEFA' },
            { rank: 4, team: 'England', points: 1814.27, change: -1, confederation: 'UEFA' },
            { rank: 5, team: 'Brazil', points: 1784.00, change: 0, confederation: 'CONMEBOL' },
            { rank: 6, team: 'Belgium', points: 1773.00, change: 0, confederation: 'UEFA' },
            { rank: 7, team: 'Netherlands', points: 1761.00, change: 0, confederation: 'UEFA' },
            { rank: 8, team: 'Portugal', points: 1756.00, change: 0, confederation: 'UEFA' },
            { rank: 9, team: 'Colombia', points: 1729.00, change: 0, confederation: 'CONMEBOL' },
            { rank: 10, team: 'Italy', points: 1723.00, change: 0, confederation: 'UEFA' },
        ];

        res.json({
            success: true,
            source: 'fallback',
            data: fallbackData.slice(0, parseInt(req.query.limit) || 10),
            total: fallbackData.length,
            error: error.message
        });
    }
});

// ============================================================
// GET /api/fifa-ranking/country/:country
// Get ranking for specific country
// ============================================================
router.get('/country/:country', async (req, res) => {
    try {
        const { country } = req.params;

        // First, get all rankings
        if (!fifaRankingsCache || !fifaCacheTimestamp || (Date.now() - fifaCacheTimestamp >= CACHE_DURATION)) {
            // Fetch fresh data
            const response = await fetch(`${ZYLA_BASE_URL}/12882/get+ranking`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${ZYLA_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (Array.isArray(data)) {
                    fifaRankingsCache = data.map((item, index) => ({
                        rank: item.rank || index + 1,
                        team: item.name || item.team || item.country || 'Unknown',
                        points: parseFloat(item.points) || 0,
                        previousPoints: parseFloat(item.previous_points) || 0,
                        previousRank: item.previous_rank || item.rank || index + 1,
                        change: (item.previous_rank || item.rank || index + 1) - (item.rank || index + 1),
                        confederation: item.confederation || '',
                        flag: item.flag || null
                    }));
                    fifaCacheTimestamp = Date.now();
                }
            }
        }

        // Search for country
        const countryLower = country.toLowerCase();
        const found = fifaRankingsCache?.find(r =>
            r.team.toLowerCase() === countryLower ||
            r.team.toLowerCase().includes(countryLower)
        );

        if (found) {
            res.json({
                success: true,
                data: found
            });
        } else {
            res.json({
                success: false,
                message: `Country '${country}' not found in rankings`
            });
        }

    } catch (error) {
        console.error('❌ Country ranking error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============================================================
// GET /api/fifa-ranking/confederation/:conf
// Get rankings by confederation (UEFA, CONMEBOL, etc)
// ============================================================
router.get('/confederation/:conf', async (req, res) => {
    try {
        const { conf } = req.params;
        const limit = parseInt(req.query.limit) || 10;

        // Ensure cache is populated
        if (!fifaRankingsCache || !fifaCacheTimestamp || (Date.now() - fifaCacheTimestamp >= CACHE_DURATION)) {
            const response = await fetch(`${ZYLA_BASE_URL}/12882/get+ranking`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${ZYLA_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (Array.isArray(data)) {
                    fifaRankingsCache = data.map((item, index) => ({
                        rank: item.rank || index + 1,
                        team: item.name || item.team || item.country || 'Unknown',
                        points: parseFloat(item.points) || 0,
                        previousPoints: parseFloat(item.previous_points) || 0,
                        previousRank: item.previous_rank || item.rank || index + 1,
                        change: (item.previous_rank || item.rank || index + 1) - (item.rank || index + 1),
                        confederation: item.confederation || '',
                        flag: item.flag || null
                    }));
                    fifaCacheTimestamp = Date.now();
                }
            }
        }

        // Filter by confederation
        const confUpper = conf.toUpperCase();
        const filtered = fifaRankingsCache?.filter(r =>
            r.confederation.toUpperCase() === confUpper
        ) || [];

        // Re-rank within confederation
        const reRanked = filtered.map((item, index) => ({
            ...item,
            confRank: index + 1
        }));

        res.json({
            success: true,
            confederation: confUpper,
            data: reRanked.slice(0, limit),
            total: reRanked.length
        });

    } catch (error) {
        console.error('❌ Confederation ranking error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
