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
 * Get Head-to-Head data between two teams
 * @param {string|number} team1 - First team ID
 * @param {string|number} team2 - Second team ID
 * @param {number} last - Number of past matches (default: 12)
 */
const getH2H = async (team1, team2, last = 12) => {
    try {
        console.log(`⚔️ Fetching H2H: team1=${team1}, team2=${team2}, last=${last}`);

        const response = await apiClient.get('/fixtures/headtohead', {
            params: {
                h2h: `${team1}-${team2}`,
                last: last
            }
        });

        if (response.data.errors && Object.keys(response.data.errors).length > 0) {
            console.error('❌ H2H API Error:', response.data.errors);
            return { success: false, error: response.data.errors };
        }

        return {
            success: true,
            data: response.data.response || []
        };
    } catch (error) {
        console.error('❌ H2H request failed:', error.message);
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

/**
 * Get match predictions
 * @param {string|number} fixtureId - Fixture ID
 */
const getPredictions = async (fixtureId) => {
    try {
        console.log(`🔮 Fetching predictions for fixture: ${fixtureId}`);

        const response = await apiClient.get('/predictions', {
            params: { fixture: fixtureId }
        });

        if (response.data.errors && Object.keys(response.data.errors).length > 0) {
            console.error('❌ Predictions API Error:', response.data.errors);
            return { success: false, error: response.data.errors };
        }

        return {
            success: true,
            data: response.data.response || []
        };
    } catch (error) {
        console.error('❌ Predictions request failed:', error.message);
        return { success: false, error: error.message };
    }
};

/**
 * Get team statistics for a season
 * @param {string|number} teamId - Team ID
 * @param {string|number} leagueId - League ID
 * @param {string|number} season - Season year
 */
const getTeamStatistics = async (teamId, leagueId, season) => {
    try {
        console.log(`📊 Fetching team statistics: team=${teamId}, league=${leagueId}, season=${season}`);

        const response = await apiClient.get('/teams/statistics', {
            params: {
                team: teamId,
                league: leagueId,
                season: season
            }
        });

        if (response.data.errors && Object.keys(response.data.errors).length > 0) {
            console.error('❌ Team Statistics API Error:', response.data.errors);
            return { success: false, error: response.data.errors };
        }

        return {
            success: true,
            data: response.data.response || null
        };
    } catch (error) {
        console.error('❌ Team Statistics request failed:', error.message);
        return { success: false, error: error.message };
    }
};

/**
 * Get players statistics by league and season
 * @param {string|number} leagueId - League ID
 * @param {string|number} season - Season year
 * @param {number} page - Page number (default: 1)
 */
const getPlayersStatistics = async (leagueId, season = null, page = 1) => {
    try {
        const params = {
            league: leagueId,
            season: season || getCurrentSeason(),
            page: page
        };

        console.log(`👤 Fetching players: league=${leagueId}, season=${params.season}, page=${page}`);

        const response = await apiClient.get('/players', { params });

        if (response.data.errors && Object.keys(response.data.errors).length > 0) {
            console.error('❌ Players API Error:', response.data.errors);
            return { success: false, error: response.data.errors };
        }

        return {
            success: true,
            data: response.data.response || [],
            paging: response.data.paging
        };
    } catch (error) {
        console.error('❌ Players request failed:', error.message);
        return { success: false, error: error.message };
    }
};

/**
 * Get top rated players from top leagues
 * @param {number} limit - Number of players to return (default: 5)
 */
const getTopPlayers = async (limit = 5) => {
    try {
        console.log(`🌟 Fetching top ${limit} players from top leagues...`);

        const TOP_LEAGUES = [39, 140, 135, 78, 61, 2]; // PL, La Liga, Serie A, Bundesliga, Ligue 1, UCL
        const season = getCurrentSeason();
        let allPlayers = [];

        for (const leagueId of TOP_LEAGUES) {
            const result = await getPlayersStatistics(leagueId, season, 1);

            if (result.success && result.data) {
                const players = result.data
                    .filter(item => {
                        const rating = parseFloat(item.statistics?.[0]?.games?.rating) || 0;
                        const appearances = item.statistics?.[0]?.games?.appearences || 0;
                        return rating > 0 && appearances >= 5;
                    })
                    .map(item => ({
                        id: item.player.id,
                        name: item.player.name,
                        photo: item.player.photo,
                        age: item.player.age,
                        nationality: item.player.nationality,
                        position: item.statistics?.[0]?.games?.position || 'Unknown',
                        team: item.statistics?.[0]?.team?.name || 'Unknown',
                        teamLogo: item.statistics?.[0]?.team?.logo,
                        leagueId: leagueId,
                        rating: parseFloat(item.statistics?.[0]?.games?.rating) || 0,
                        appearances: item.statistics?.[0]?.games?.appearences || 0,
                        goals: item.statistics?.[0]?.goals?.total || 0,
                        assists: item.statistics?.[0]?.goals?.assists || 0,
                    }));

                allPlayers = [...allPlayers, ...players];
            }

            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 150));
        }

        // Sort by rating (highest first)
        allPlayers.sort((a, b) => b.rating - a.rating);

        // Remove duplicates
        const uniquePlayers = [];
        const seenIds = new Set();
        for (const player of allPlayers) {
            if (!seenIds.has(player.id)) {
                seenIds.add(player.id);
                uniquePlayers.push(player);
            }
        }

        console.log(`✅ Found ${uniquePlayers.length} unique top players`);

        return {
            success: true,
            data: uniquePlayers.slice(0, limit)
        };
    } catch (error) {
        console.error('❌ Top Players request failed:', error.message);
        return { success: false, error: error.message };
    }
};

/**
 * Get player statistics by fixture (match)
 * @param {string|number} fixtureId - Fixture ID
 */
const getFixturePlayers = async (fixtureId) => {
    try {
        console.log(`👥 Fetching players for fixture: ${fixtureId}`);

        const response = await apiClient.get('/fixtures/players', {
            params: { fixture: fixtureId }
        });

        if (response.data.errors && Object.keys(response.data.errors).length > 0) {
            console.error('❌ Fixture Players API Error:', response.data.errors);
            return { success: false, error: response.data.errors };
        }

        return {
            success: true,
            data: response.data.response || []
        };
    } catch (error) {
        console.error('❌ Fixture Players request failed:', error.message);
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
    getH2H,
    getOdds,
    getLiveOdds,
    getApiStatus,
    getCurrentSeason,
    formatDate,
    POPULAR_LEAGUES,
    getPredictions,
    getTeamStatistics,
    getPlayersStatistics,
    getTopPlayers,
    getFixturePlayers,
};
