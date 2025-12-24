const axios = require('axios');

const API_BASE_URL = 'https://v3.football.api-sports.io';

// Create axios instance with default config
const apiClient = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
    headers: {
        'x-apisports-key': process.env.API_FOOTBALL_KEY
    }
});

// Popular leagues to fetch (bisa di-customize)
const POPULAR_LEAGUES = [
    39,   // Premier League
    140,  // La Liga
    135,  // Serie A
    78,   // Bundesliga
    61,   // Ligue 1
    2,    // Champions League
    3,    // Europa League
    848,  // Conference League
    88,   // Eredivisie
    94,   // Primeira Liga (Portugal)
    274,  // Liga 1 Indonesia
    262,  // Liga 2 Indonesia
];

/**
 * Get current season year
 */
const getCurrentSeason = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    // Season biasanya mulai Agustus, jadi sebelum Agustus pake tahun sebelumnya
    return month < 8 ? year - 1 : year;
};

/**
 * Format date ke YYYY-MM-DD
 */
const formatDate = (date) => {
    return date.toISOString().split('T')[0];
};

/**
 * Fetch fixtures/matches dari API-Football
 */
const getFixtures = async (params = {}) => {
    try {
        const response = await apiClient.get('/fixtures', { params });

        if (response.data.errors && Object.keys(response.data.errors).length > 0) {
            console.error('❌ API-Football Error:', response.data.errors);
            return { success: false, error: response.data.errors };
        }

        return {
            success: true,
            data: response.data.response,
            results: response.data.results,
            paging: response.data.paging
        };
    } catch (error) {
        console.error('❌ API Request Failed:', error.message);
        return { success: false, error: error.message };
    }
};

/**
 * Get matches untuk hari ini
 */
const getTodayMatches = async () => {
    const today = formatDate(new Date());
    console.log(`📅 Fetching matches for: ${today}`);

    return await getFixtures({ date: today });
};

/**
 * Get matches untuk tanggal tertentu
 */
const getMatchesByDate = async (date) => {
    return await getFixtures({ date });
};

/**
 * Get LIVE matches only
 */
const getLiveMatches = async () => {
    return await getFixtures({ live: 'all' });
};

/**
 * Get matches by league
 */
const getMatchesByLeague = async (leagueId, season = null) => {
    return await getFixtures({
        league: leagueId,
        season: season || getCurrentSeason()
    });
};

/**
 * Get match detail by fixture ID
 */
const getMatchById = async (fixtureId) => {
    return await getFixtures({ id: fixtureId });
};

/**
 * Get matches untuk popular leagues hari ini
 */
const getPopularLeagueMatches = async () => {
    const today = formatDate(new Date());
    const allMatches = [];

    for (const leagueId of POPULAR_LEAGUES) {
        const result = await getFixtures({
            league: leagueId,
            date: today
        });

        if (result.success && result.data) {
            allMatches.push(...result.data);
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    return {
        success: true,
        data: allMatches,
        results: allMatches.length
    };
};

/**
 * Get fixtures untuk date range (today + tomorrow)
 */
const getMatchesDateRange = async (fromDate, toDate) => {
    return await getFixtures({
        from: fromDate,
        to: toDate
    });
};

/**
 * Get leagues info
 */
const getLeagues = async (params = {}) => {
    try {
        const response = await apiClient.get('/leagues', { params });
        return {
            success: true,
            data: response.data.response
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
};

/**
 * Get match statistics
 */
const getMatchStatistics = async (fixtureId) => {
    try {
        const response = await apiClient.get('/fixtures/statistics', {
            params: { fixture: fixtureId }
        });
        return {
            success: true,
            data: response.data.response
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
};

/**
 * Get match events (goals, cards, substitutions)
 */
const getMatchEvents = async (fixtureId) => {
    try {
        const response = await apiClient.get('/fixtures/events', {
            params: { fixture: fixtureId }
        });
        return {
            success: true,
            data: response.data.response
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
};

/**
 * Get match lineups
 */
const getMatchLineups = async (fixtureId) => {
    try {
        const response = await apiClient.get('/fixtures/lineups', {
            params: { fixture: fixtureId }
        });
        return {
            success: true,
            data: response.data.response
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
};

/**
 * Get league standings / klasemen
 */
const getStandings = async (leagueId, season = null) => {
    try {
        const params = {
            league: leagueId,
            season: season || getCurrentSeason()
        };

        console.log(`🏆 Fetching standings: league=${leagueId}, season=${params.season}`);

        const response = await apiClient.get('/standings', { params });

        if (response.data.errors && Object.keys(response.data.errors).length > 0) {
            console.error('❌ Standings API Error:', response.data.errors);
            return { success: false, error: response.data.errors };
        }

        return {
            success: true,
            data: response.data.response
        };
    } catch (error) {
        console.error('❌ Standings request failed:', error.message);
        return { success: false, error: error.message };
    }
};

/**
 * Get pre-match odds for a fixture
 */
const getOdds = async (fixtureId) => {
    try {
        console.log(`📊 Fetching odds for fixture: ${fixtureId}`);

        const response = await apiClient.get('/odds', {
            params: { fixture: fixtureId }
        });

        if (response.data.errors && Object.keys(response.data.errors).length > 0) {
            console.error('❌ Odds API Error:', response.data.errors);
            return { success: false, error: response.data.errors };
        }

        return {
            success: true,
            data: response.data.response
        };
    } catch (error) {
        console.error('❌ Odds request failed:', error.message);
        return { success: false, error: error.message };
    }
};

/**
 * Get live/in-play odds for a fixture
 */
const getLiveOdds = async (fixtureId) => {
    try {
        console.log(`📊 Fetching live odds for fixture: ${fixtureId}`);

        const response = await apiClient.get('/odds/live', {
            params: { fixture: fixtureId }
        });

        if (response.data.errors && Object.keys(response.data.errors).length > 0) {
            console.error('❌ Live Odds API Error:', response.data.errors);
            return { success: false, error: response.data.errors };
        }

        return {
            success: true,
            data: response.data.response
        };
    } catch (error) {
        console.error('❌ Live Odds request failed:', error.message);
        return { success: false, error: error.message };
    }
};

/**
 * Check API status & quota
 */
const getApiStatus = async () => {
    try {
        const response = await apiClient.get('/status');
        return {
            success: true,
            data: response.data.response
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
};

module.exports = {
    getTodayMatches,
    getMatchesByDate,
    getLiveMatches,
    getMatchesByLeague,
    getMatchById,
    getPopularLeagueMatches,
    getMatchesDateRange,
    getLeagues,
    getMatchStatistics,
    getMatchEvents,
    getMatchLineups,
    getStandings,
    getOdds,      // NEW
    getLiveOdds,  // NEW
    getApiStatus,
    getCurrentSeason,
    formatDate,
    POPULAR_LEAGUES
};
