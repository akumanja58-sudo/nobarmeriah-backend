/**
 * API Tennis Service
 * Provider: api-tennis.com (via RapidAPI)
 * Documentation: https://api-tennis.com/documentation
 */

const axios = require('axios');

// Base URL - bisa pake direct atau via RapidAPI
const BASE_URL = 'https://api.api-tennis.com/tennis';
const API_KEY = process.env.API_TENNIS_KEY;

// RapidAPI config (alternatif)
const RAPIDAPI_HOST = 'tennis-api-atp-wta-itf.p.rapidapi.com';
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || API_KEY;

/**
 * Helper: Make API request to Tennis API
 */
async function makeRequest(method, params = {}) {
    try {
        const url = `${BASE_URL}/?method=${method}&APIkey=${API_KEY}`;
        const queryParams = new URLSearchParams(params).toString();
        const fullUrl = queryParams ? `${url}&${queryParams}` : url;

        console.log(`🎾 Tennis API: ${method}`);

        const response = await axios.get(fullUrl, {
            timeout: 30000,
            headers: {
                'Accept': 'application/json'
            }
        });

        if (response.data && response.data.success === 1) {
            return {
                success: true,
                data: response.data.result
            };
        }

        return {
            success: false,
            error: response.data?.error || 'Unknown error',
            data: []
        };

    } catch (error) {
        console.error(`❌ Tennis API Error (${method}):`, error.message);
        return {
            success: false,
            error: error.message,
            data: []
        };
    }
}

/**
 * Get live tennis matches
 * Endpoint: get_livescore
 */
async function getLiveMatches() {
    return await makeRequest('get_livescore');
}

/**
 * Get tennis fixtures by date range
 * @param {string} dateStart - Start date (YYYY-MM-DD)
 * @param {string} dateStop - End date (YYYY-MM-DD)
 * @param {object} options - Optional filters (event_type_key, tournament_key)
 */
async function getFixtures(dateStart, dateStop, options = {}) {
    const params = {
        date_start: dateStart,
        date_stop: dateStop,
        ...options
    };
    return await makeRequest('get_fixtures', params);
}

/**
 * Get today's tennis matches (live + scheduled + finished)
 */
async function getTodayMatches() {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    return await getFixtures(today, today);
}

/**
 * Get matches by specific date
 * @param {string} date - Date in YYYY-MM-DD format
 */
async function getMatchesByDate(date) {
    return await getFixtures(date, date);
}

/**
 * Get ATP Rankings
 */
async function getAtpRankings() {
    return await makeRequest('get_standings', { event_type: 'ATP' });
}

/**
 * Get WTA Rankings
 */
async function getWtaRankings() {
    return await makeRequest('get_standings', { event_type: 'WTA' });
}

/**
 * Get both ATP and WTA Rankings
 */
async function getAllRankings() {
    try {
        const [atpResult, wtaResult] = await Promise.all([
            getAtpRankings(),
            getWtaRankings()
        ]);

        return {
            success: true,
            data: {
                atp: atpResult.success ? atpResult.data : [],
                wta: wtaResult.success ? wtaResult.data : []
            }
        };
    } catch (error) {
        return {
            success: false,
            error: error.message,
            data: { atp: [], wta: [] }
        };
    }
}

/**
 * Get player profile
 * @param {string} playerKey - Player ID
 */
async function getPlayer(playerKey) {
    return await makeRequest('get_players', { player_key: playerKey });
}

/**
 * Get Head to Head between two players
 * @param {string} firstPlayerKey - First player ID
 * @param {string} secondPlayerKey - Second player ID
 */
async function getH2H(firstPlayerKey, secondPlayerKey) {
    return await makeRequest('get_H2H', {
        first_player_key: firstPlayerKey,
        second_player_key: secondPlayerKey
    });
}

/**
 * Get all tournaments
 */
async function getTournaments() {
    return await makeRequest('get_tournaments');
}

/**
 * Get all event types (ATP Singles, WTA Singles, etc)
 */
async function getEventTypes() {
    return await makeRequest('get_events');
}

/**
 * Get match odds
 * @param {string} matchKey - Match ID
 */
async function getOdds(matchKey) {
    return await makeRequest('get_odds', { match_key: matchKey });
}

/**
 * Get live odds for live matches
 */
async function getLiveOdds() {
    return await makeRequest('get_live_odds');
}

/**
 * Transform raw match data to frontend format
 */
function transformMatch(match) {
    // Determine match status
    const isLive = match.event_live === '1' || match.event_live === 1;
    const isFinished = match.event_status === 'Finished';
    
    // Parse scores
    const scores = match.scores || [];
    const setsScore = scores.map(s => ({
        set: parseInt(s.score_set),
        player1: parseInt(s.score_first) || 0,
        player2: parseInt(s.score_second) || 0
    }));

    // Calculate total sets won
    let player1Sets = 0;
    let player2Sets = 0;
    setsScore.forEach(set => {
        if (set.player1 > set.player2) player1Sets++;
        else if (set.player2 > set.player1) player2Sets++;
    });

    // Get current game score (for live matches)
    const gameScore = match.event_game_result || '-';

    return {
        id: match.event_key,
        date: match.event_date,
        time: match.event_time,
        
        // Players
        player1: {
            name: match.event_first_player,
            key: match.first_player_key,
            logo: match.event_first_player_logo,
            isServing: match.event_serve === 'First Player'
        },
        player2: {
            name: match.event_second_player,
            key: match.second_player_key,
            logo: match.event_second_player_logo,
            isServing: match.event_serve === 'Second Player'
        },
        
        // Scores
        scores: setsScore,
        setsWon: {
            player1: player1Sets,
            player2: player2Sets
        },
        gameScore: gameScore,
        finalResult: match.event_final_result,
        
        // Status
        status: match.event_status || (isLive ? 'Live' : 'Scheduled'),
        isLive: isLive,
        isFinished: isFinished,
        winner: match.event_winner,
        
        // Tournament info
        tournament: {
            name: match.tournament_name,
            key: match.tournament_key,
            round: match.tournament_round,
            season: match.tournament_season
        },
        eventType: match.event_type_type,
        
        // Extra data
        isQualification: match.event_qualification === 'True',
        pointByPoint: match.pointbypoint || []
    };
}

/**
 * Transform multiple matches
 */
function transformMatches(matches) {
    if (!Array.isArray(matches)) return [];
    return matches.map(transformMatch);
}

/**
 * Transform ranking data
 */
function transformRanking(player) {
    return {
        rank: parseInt(player.place),
        name: player.player,
        playerKey: player.player_key,
        country: player.country,
        points: parseInt(player.points),
        movement: player.movement // 'up', 'down', 'same'
    };
}

/**
 * Transform rankings array
 */
function transformRankings(rankings) {
    if (!Array.isArray(rankings)) return [];
    return rankings.map(transformRanking);
}

module.exports = {
    // Raw API calls
    getLiveMatches,
    getFixtures,
    getTodayMatches,
    getMatchesByDate,
    getAtpRankings,
    getWtaRankings,
    getAllRankings,
    getPlayer,
    getH2H,
    getTournaments,
    getEventTypes,
    getOdds,
    getLiveOdds,
    
    // Transform functions
    transformMatch,
    transformMatches,
    transformRanking,
    transformRankings
};
