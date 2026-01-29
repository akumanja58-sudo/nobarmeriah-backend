/**
 * Unified Search Routes
 * Search across all sports - matches, teams, leagues
 */

const express = require('express');
const router = express.Router();

// Import all sport services
const apiFootball = require('../services/apiFootball');
const apiTennis = require('../services/apiTennis');
const apiBasketball = require('../services/apiBasketball');
const apiVolleyball = require('../services/apiVolleyball');
const apiBaseball = require('../services/apiBaseball');

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Normalize search query
 */
function normalizeQuery(query) {
    return (query || '').toLowerCase().trim();
}

/**
 * Check if string matches search query
 */
function matchesQuery(str, query) {
    if (!str || !query) return false;
    return str.toLowerCase().includes(query);
}

/**
 * Search in today's matches for a sport
 */
async function searchMatchesInSport(sportName, getMatchesFn, transformFn, query) {
    try {
        const result = await getMatchesFn();
        if (!result.success) return [];

        const matches = transformFn ? transformFn(result.data) : result.data;

        return matches.filter(match => {
            const homeTeam = match.homeTeam?.name || match.teams?.home?.name || '';
            const awayTeam = match.awayTeam?.name || match.teams?.away?.name || '';
            const league = match.league?.name || '';
            const country = match.country?.name || '';

            return matchesQuery(homeTeam, query) ||
                matchesQuery(awayTeam, query) ||
                matchesQuery(league, query) ||
                matchesQuery(country, query);
        }).map(match => ({
            ...match,
            sport: sportName
        }));
    } catch (error) {
        console.error(`Search error in ${sportName}:`, error.message);
        return [];
    }
}

// ============================================================
// ROUTES
// ============================================================

/**
 * GET /api/search
 * Unified search across all sports
 */
router.get('/', async (req, res) => {
    try {
        const { q, sport, type } = req.query;
        const query = normalizeQuery(q);

        if (!query || query.length < 2) {
            return res.json({
                success: true,
                query: q,
                message: 'Query too short (min 2 characters)',
                results: {
                    matches: [],
                    teams: [],
                    leagues: []
                },
                total: 0
            });
        }

        console.log(`🔍 GET /api/search (q: "${q}", sport: ${sport || 'all'})`);

        let allMatches = [];

        // Search based on sport filter or all sports
        const searchSports = sport ? [sport] : ['football', 'tennis', 'basketball', 'volleyball', 'baseball'];

        const searchPromises = searchSports.map(async (sportType) => {
            switch (sportType) {
                case 'football':
                    return searchMatchesInSport(
                        'football',
                        () => apiFootball.getTodayMatches(),
                        null, // Already formatted
                        query
                    );
                case 'tennis':
                    return searchMatchesInSport(
                        'tennis',
                        () => apiTennis.getTodayMatches(),
                        apiTennis.transformMatches,
                        query
                    );
                case 'basketball':
                    return searchMatchesInSport(
                        'basketball',
                        () => apiBasketball.getTodayGames(),
                        apiBasketball.transformGames,
                        query
                    );
                case 'volleyball':
                    return searchMatchesInSport(
                        'volleyball',
                        () => apiVolleyball.getTodayGames(),
                        apiVolleyball.transformGames,
                        query
                    );
                case 'baseball':
                    return searchMatchesInSport(
                        'baseball',
                        () => apiBaseball.getTodayGames(),
                        apiBaseball.transformGames,
                        query
                    );
                default:
                    return [];
            }
        });

        const results = await Promise.allSettled(searchPromises);

        results.forEach((result) => {
            if (result.status === 'fulfilled' && Array.isArray(result.value)) {
                allMatches = [...allMatches, ...result.value];
            }
        });

        // Sort: Live first, then by time
        allMatches.sort((a, b) => {
            if (a.isLive && !b.isLive) return -1;
            if (!a.isLive && b.isLive) return 1;
            return 0;
        });

        // Group by sport for easier display
        const groupedBySport = {};
        allMatches.forEach(match => {
            const sport = match.sport || 'other';
            if (!groupedBySport[sport]) {
                groupedBySport[sport] = [];
            }
            groupedBySport[sport].push(match);
        });

        res.json({
            success: true,
            query: q,
            results: {
                matches: allMatches,
                grouped: groupedBySport
            },
            total: allMatches.length,
            lastUpdated: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Search error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/search/suggestions
 * Get search suggestions (quick search)
 */
router.get('/suggestions', async (req, res) => {
    try {
        const { q } = req.query;
        const query = normalizeQuery(q);

        if (!query || query.length < 2) {
            return res.json({
                success: true,
                suggestions: []
            });
        }

        console.log(`🔍 GET /api/search/suggestions (q: "${q}")`);

        // Get suggestions from all sports (limited results for speed)
        const suggestions = [];

        // Popular teams / leagues suggestions (hardcoded for speed)
        const popularItems = [
            // Football
            { name: 'Manchester United', type: 'team', sport: 'football' },
            { name: 'Manchester City', type: 'team', sport: 'football' },
            { name: 'Liverpool', type: 'team', sport: 'football' },
            { name: 'Arsenal', type: 'team', sport: 'football' },
            { name: 'Chelsea', type: 'team', sport: 'football' },
            { name: 'Barcelona', type: 'team', sport: 'football' },
            { name: 'Real Madrid', type: 'team', sport: 'football' },
            { name: 'Bayern Munich', type: 'team', sport: 'football' },
            { name: 'Juventus', type: 'team', sport: 'football' },
            { name: 'PSG', type: 'team', sport: 'football' },
            { name: 'Inter Milan', type: 'team', sport: 'football' },
            { name: 'AC Milan', type: 'team', sport: 'football' },
            { name: 'Borussia Dortmund', type: 'team', sport: 'football' },
            { name: 'Atletico Madrid', type: 'team', sport: 'football' },
            { name: 'Tottenham', type: 'team', sport: 'football' },
            // Indonesia
            { name: 'Persib Bandung', type: 'team', sport: 'football' },
            { name: 'Persija Jakarta', type: 'team', sport: 'football' },
            { name: 'Arema FC', type: 'team', sport: 'football' },
            { name: 'Bali United', type: 'team', sport: 'football' },
            { name: 'PSM Makassar', type: 'team', sport: 'football' },
            // Leagues
            { name: 'Premier League', type: 'league', sport: 'football' },
            { name: 'La Liga', type: 'league', sport: 'football' },
            { name: 'Serie A', type: 'league', sport: 'football' },
            { name: 'Bundesliga', type: 'league', sport: 'football' },
            { name: 'Ligue 1', type: 'league', sport: 'football' },
            { name: 'Champions League', type: 'league', sport: 'football' },
            { name: 'Europa League', type: 'league', sport: 'football' },
            { name: 'BRI Liga 1', type: 'league', sport: 'football' },
            // Tennis
            { name: 'Novak Djokovic', type: 'player', sport: 'tennis' },
            { name: 'Carlos Alcaraz', type: 'player', sport: 'tennis' },
            { name: 'Jannik Sinner', type: 'player', sport: 'tennis' },
            { name: 'Daniil Medvedev', type: 'player', sport: 'tennis' },
            { name: 'Australian Open', type: 'tournament', sport: 'tennis' },
            { name: 'Roland Garros', type: 'tournament', sport: 'tennis' },
            { name: 'Wimbledon', type: 'tournament', sport: 'tennis' },
            { name: 'US Open', type: 'tournament', sport: 'tennis' },
            // Basketball
            { name: 'Los Angeles Lakers', type: 'team', sport: 'basketball' },
            { name: 'Golden State Warriors', type: 'team', sport: 'basketball' },
            { name: 'Boston Celtics', type: 'team', sport: 'basketball' },
            { name: 'Miami Heat', type: 'team', sport: 'basketball' },
            { name: 'NBA', type: 'league', sport: 'basketball' },
            { name: 'Euroleague', type: 'league', sport: 'basketball' },
            // Baseball
            { name: 'New York Yankees', type: 'team', sport: 'baseball' },
            { name: 'Los Angeles Dodgers', type: 'team', sport: 'baseball' },
            { name: 'MLB', type: 'league', sport: 'baseball' },
            { name: 'NPB', type: 'league', sport: 'baseball' },
        ];

        // Filter by query
        const matchedSuggestions = popularItems.filter(item =>
            matchesQuery(item.name, query)
        ).slice(0, 8);

        res.json({
            success: true,
            query: q,
            suggestions: matchedSuggestions,
            lastUpdated: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Suggestions error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
