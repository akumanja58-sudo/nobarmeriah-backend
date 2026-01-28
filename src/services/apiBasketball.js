/**
 * API Basketball Service
 * Provider: api-sports.io
 * Documentation: https://api-sports.io/documentation/basketball/v1
 */

const axios = require('axios');

const BASE_URL = 'https://v1.basketball.api-sports.io';
const API_KEY = process.env.API_SPORTS_KEY || process.env.API_FOOTBALL_KEY;

/**
 * Helper: Make API request to Basketball API
 */
async function makeRequest(endpoint, params = {}) {
    try {
        console.log(`🏀 Basketball API: ${endpoint}`);

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
        console.error(`❌ Basketball API Error (${endpoint}):`, error.message);
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
 * Get live basketball games
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
 * @param {string} season - Season (e.g., "2024-2025")
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
 * @param {string} season - Season (e.g., "2024-2025")
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
// STATISTICS
// ============================================================

/**
 * Get game statistics
 * @param {number} gameId - Game ID
 */
async function getGameStatistics(gameId) {
    return await makeRequest('/games/statistics', { id: gameId });
}

/**
 * Get team statistics
 * @param {number} teamId - Team ID
 * @param {number} leagueId - League ID
 * @param {string} season - Season
 */
async function getTeamStatistics(teamId, leagueId, season) {
    return await makeRequest('/statistics', { 
        team: teamId, 
        league: leagueId, 
        season: season 
    });
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
    const isLive = ['Q1', 'Q2', 'Q3', 'Q4', 'OT', 'BT', 'HT'].includes(status);
    const isFinished = ['FT', 'AOT', 'POST'].includes(status);

    // Parse scores
    const homeScore = game.scores?.home?.total ?? 0;
    const awayScore = game.scores?.away?.total ?? 0;

    // Quarter scores
    const quarters = {
        home: {
            q1: game.scores?.home?.quarter_1 ?? 0,
            q2: game.scores?.home?.quarter_2 ?? 0,
            q3: game.scores?.home?.quarter_3 ?? 0,
            q4: game.scores?.home?.quarter_4 ?? 0,
            ot: game.scores?.home?.over_time ?? null
        },
        away: {
            q1: game.scores?.away?.quarter_1 ?? 0,
            q2: game.scores?.away?.quarter_2 ?? 0,
            q3: game.scores?.away?.quarter_3 ?? 0,
            q4: game.scores?.away?.quarter_4 ?? 0,
            ot: game.scores?.away?.over_time ?? null
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

        // Scores
        homeScore: homeScore,
        awayScore: awayScore,
        quarters: quarters,

        // Status
        status: status,
        statusLong: game.status?.long,
        timer: game.status?.timer,
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
        }
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
        points: {
            for: standing.points?.for,
            against: standing.points?.against,
            diff: standing.points?.for - standing.points?.against
        },
        form: standing.form
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
    getGameStatistics,
    getTeamStatistics,
    getH2H,
    getOdds,

    // Transform functions
    transformGame,
    transformGames,
    transformStanding,
    transformStandings
};
