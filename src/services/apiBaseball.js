/**
 * API Baseball Service
 * Provider: api-sports.io
 * Documentation: https://api-sports.io/documentation/baseball/v1
 */

const axios = require('axios');

const BASE_URL = 'https://v1.baseball.api-sports.io';
const API_KEY = process.env.API_SPORTS_KEY || process.env.API_FOOTBALL_KEY;

/**
 * Helper: Make API request to Baseball API
 */
async function makeRequest(endpoint, params = {}) {
    try {
        console.log(`⚾ Baseball API: ${endpoint}`);

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
        console.error(`❌ Baseball API Error (${endpoint}):`, error.message);
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
 * Get live baseball games
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
    
    // Baseball status codes
    // IN1-IN9 = Inning 1-9, LIVE, POST (Postponed), FT (Finished), etc.
    const isLive = ['IN1', 'IN2', 'IN3', 'IN4', 'IN5', 'IN6', 'IN7', 'IN8', 'IN9', 'IN10', 'IN11', 'IN12', 'LIVE', 'INPROGRESS'].includes(status) || status.startsWith('IN');
    const isFinished = ['FT', 'AOT', 'POST', 'FINISHED', 'CANC', 'SUSP', 'AWD', 'WO'].includes(status);

    // Parse scores
    const homeScore = game.scores?.home?.total ?? 0;
    const awayScore = game.scores?.away?.total ?? 0;

    // Parse inning scores (baseball has 9+ innings)
    const innings = {
        home: {
            inn1: game.scores?.home?.innings?.['1'] ?? null,
            inn2: game.scores?.home?.innings?.['2'] ?? null,
            inn3: game.scores?.home?.innings?.['3'] ?? null,
            inn4: game.scores?.home?.innings?.['4'] ?? null,
            inn5: game.scores?.home?.innings?.['5'] ?? null,
            inn6: game.scores?.home?.innings?.['6'] ?? null,
            inn7: game.scores?.home?.innings?.['7'] ?? null,
            inn8: game.scores?.home?.innings?.['8'] ?? null,
            inn9: game.scores?.home?.innings?.['9'] ?? null,
            extra: game.scores?.home?.innings?.extra ?? null
        },
        away: {
            inn1: game.scores?.away?.innings?.['1'] ?? null,
            inn2: game.scores?.away?.innings?.['2'] ?? null,
            inn3: game.scores?.away?.innings?.['3'] ?? null,
            inn4: game.scores?.away?.innings?.['4'] ?? null,
            inn5: game.scores?.away?.innings?.['5'] ?? null,
            inn6: game.scores?.away?.innings?.['6'] ?? null,
            inn7: game.scores?.away?.innings?.['7'] ?? null,
            inn8: game.scores?.away?.innings?.['8'] ?? null,
            inn9: game.scores?.away?.innings?.['9'] ?? null,
            extra: game.scores?.away?.innings?.extra ?? null
        }
    };

    // Hits, Errors, Runs
    const stats = {
        home: {
            hits: game.scores?.home?.hits ?? 0,
            errors: game.scores?.home?.errors ?? 0,
            runs: homeScore
        },
        away: {
            hits: game.scores?.away?.hits ?? 0,
            errors: game.scores?.away?.errors ?? 0,
            runs: awayScore
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
        innings: innings,
        stats: stats,

        // Current inning (if live)
        currentInning: game.status?.inning || null,

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
        points: standing.points,
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
    getH2H,
    getOdds,

    // Transform functions
    transformGame,
    transformGames,
    transformStanding,
    transformStandings
};
