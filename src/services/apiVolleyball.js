/**
 * API Volleyball Service
 * Provider: api-sports.io
 * Documentation: https://api-sports.io/documentation/volleyball/v1
 */

const axios = require('axios');

const BASE_URL = 'https://v1.volleyball.api-sports.io';
const API_KEY = process.env.API_SPORTS_KEY || process.env.API_FOOTBALL_KEY;

/**
 * Helper: Make API request to Volleyball API
 */
async function makeRequest(endpoint, params = {}) {
    try {
        console.log(`🏐 Volleyball API: ${endpoint}`);

        const response = await axios.get(`${BASE_URL}${endpoint}`, {
            headers: {
                'x-apisports-key': API_KEY
            },
            params: params,
            timeout: 30000
        });

        if (response.data && response.data.response) {
            return {
                success: true,
                data: response.data.response,
                results: response.data.results,
                paging: response.data.paging
            };
        }

        return {
            success: false,
            error: response.data?.errors || 'Unknown error',
            data: []
        };

    } catch (error) {
        console.error(`❌ Volleyball API Error (${endpoint}):`, error.message);
        return {
            success: false,
            error: error.message,
            data: []
        };
    }
}

// ============================================================
// GAMES / MATCHES
// ============================================================

/**
 * Get live volleyball games
 */
async function getLiveGames() {
    return await makeRequest('/games', { live: 'all' });
}

/**
 * Get games by date
 * @param {string} date - Date in YYYY-MM-DD format
 */
async function getGamesByDate(date) {
    return await makeRequest('/games', { date: date });
}

/**
 * Get today's games
 */
async function getTodayGames() {
    const today = new Date().toISOString().split('T')[0];
    return await getGamesByDate(today);
}

/**
 * Get game by ID
 * @param {number} gameId - Game ID
 */
async function getGameById(gameId) {
    return await makeRequest('/games', { id: gameId });
}

/**
 * Get games by league and season
 * @param {number} leagueId - League ID
 * @param {string} season - Season (e.g., "2024")
 */
async function getGamesByLeague(leagueId, season) {
    return await makeRequest('/games', { league: leagueId, season: season });
}

// ============================================================
// LEAGUES
// ============================================================

/**
 * Get all leagues
 */
async function getLeagues() {
    return await makeRequest('/leagues');
}

/**
 * Get league by ID
 * @param {number} leagueId - League ID
 */
async function getLeagueById(leagueId) {
    return await makeRequest('/leagues', { id: leagueId });
}

// ============================================================
// STANDINGS
// ============================================================

/**
 * Get standings by league and season
 * @param {number} leagueId - League ID
 * @param {string} season - Season (e.g., "2024")
 */
async function getStandings(leagueId, season) {
    return await makeRequest('/standings', { league: leagueId, season: season });
}

// ============================================================
// TEAMS
// ============================================================

/**
 * Get team by ID
 * @param {number} teamId - Team ID
 */
async function getTeamById(teamId) {
    return await makeRequest('/teams', { id: teamId });
}

/**
 * Get teams by league
 * @param {number} leagueId - League ID
 */
async function getTeamsByLeague(leagueId) {
    return await makeRequest('/teams', { league: leagueId });
}

// ============================================================
// HEAD TO HEAD
// ============================================================

/**
 * Get head to head between two teams
 * @param {number} team1Id - First team ID
 * @param {number} team2Id - Second team ID
 */
async function getH2H(team1Id, team2Id) {
    return await makeRequest('/games/h2h', { h2h: `${team1Id}-${team2Id}` });
}

// ============================================================
// ODDS
// ============================================================

/**
 * Get odds for a game
 * @param {number} gameId - Game ID
 */
async function getOdds(gameId) {
    return await makeRequest('/odds', { game: gameId });
}

// ============================================================
// TRANSFORM FUNCTIONS
// ============================================================

/**
 * Transform raw game data to frontend format
 */
function transformGame(game) {
    const status = game.status?.short || '';
    
    // Volleyball status codes: SET1, SET2, SET3, SET4, SET5, BT (Break Time), FT (Finished)
    const isLive = ['SET1', 'SET2', 'SET3', 'SET4', 'SET5', 'BT', 'IN_PROGRESS'].includes(status) || status.includes('SET');
    const isFinished = ['FT', 'AOT', 'POST', 'FINISHED'].includes(status);

    // Parse scores (total sets won)
    const homeScore = game.scores?.home ?? 0;
    const awayScore = game.scores?.away ?? 0;

    // Parse set scores (volleyball has up to 5 sets)
    const sets = {
        home: {
            set1: game.periods?.first?.home ?? null,
            set2: game.periods?.second?.home ?? null,
            set3: game.periods?.third?.home ?? null,
            set4: game.periods?.fourth?.home ?? null,
            set5: game.periods?.fifth?.home ?? null
        },
        away: {
            set1: game.periods?.first?.away ?? null,
            set2: game.periods?.second?.away ?? null,
            set3: game.periods?.third?.away ?? null,
            set4: game.periods?.fourth?.away ?? null,
            set5: game.periods?.fifth?.away ?? null
        }
    };

    return {
        id: game.id,
        date: game.date,
        time: game.time,
        timestamp: game.timestamp,
        timezone: game.timezone,

        // Teams
        homeTeam: {
            id: game.teams?.home?.id,
            name: game.teams?.home?.name,
            logo: game.teams?.home?.logo
        },
        awayTeam: {
            id: game.teams?.away?.id,
            name: game.teams?.away?.name,
            logo: game.teams?.away?.logo
        },

        // Scores (sets won)
        homeScore: homeScore,
        awayScore: awayScore,
        sets: sets,

        // Current set score (if live)
        currentSet: game.periods?.current || null,

        // Status
        status: status,
        statusLong: game.status?.long,
        isLive: isLive,
        isFinished: isFinished,

        // League info
        league: {
            id: game.league?.id,
            name: game.league?.name,
            type: game.league?.type,
            season: game.league?.season,
            logo: game.league?.logo
        },

        // Country
        country: {
            id: game.country?.id,
            name: game.country?.name,
            code: game.country?.code,
            flag: game.country?.flag
        },

        // Week info (if available)
        week: game.week
    };
}

/**
 * Transform multiple games
 */
function transformGames(games) {
    if (!Array.isArray(games)) return [];
    return games.map(transformGame);
}

/**
 * Transform standing data
 */
function transformStanding(standing) {
    return {
        rank: standing.position,
        team: {
            id: standing.team?.id,
            name: standing.team?.name,
            logo: standing.team?.logo
        },
        group: standing.group?.name,
        games: {
            played: standing.games?.played,
            win: standing.games?.win?.total,
            lose: standing.games?.lose?.total
        },
        sets: {
            won: standing.sets?.won,
            lost: standing.sets?.lost,
            diff: (standing.sets?.won || 0) - (standing.sets?.lost || 0)
        },
        points: standing.points
    };
}

/**
 * Transform standings array
 */
function transformStandings(standings) {
    if (!Array.isArray(standings)) return [];
    return standings.map(transformStanding);
}

module.exports = {
    // Raw API calls
    getLiveGames,
    getGamesByDate,
    getTodayGames,
    getGameById,
    getGamesByLeague,
    getLeagues,
    getLeagueById,
    getStandings,
    getTeamById,
    getTeamsByLeague,
    getH2H,
    getOdds,

    // Transform functions
    transformGame,
    transformGames,
    transformStanding,
    transformStandings
};
