/**
 * API MMA Service
 * Provider: api-sports.io
 * Documentation: https://api-sports.io/documentation/mma/v1
 * Endpoints: Fights, Fighters, Categories, Odds
 */

const axios = require('axios');

const BASE_URL = 'https://v1.mma.api-sports.io';
const API_KEY = process.env.API_SPORTS_KEY || process.env.API_FOOTBALL_KEY;

/**
 * Helper: Make API request to MMA API
 */
async function makeRequest(endpoint, params = {}) {
    try {
        console.log(`🥊 MMA API: ${endpoint}`);

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
        console.error(`❌ MMA API Error (${endpoint}):`, error.message);
        return {
            success: false,
            error: error.message,
            data: []
        };
    }
}

// ============================================================
// FIGHTS
// ============================================================

/**
 * Get live MMA fights
 */
async function getLiveFights() {
    return await makeRequest('/fights', { live: 'all' });
}

/**
 * Get fights by date
 * @param {string} date - Date in YYYY-MM-DD format
 */
async function getFightsByDate(date) {
    return await makeRequest('/fights', { date: date });
}

/**
 * Get today's fights
 */
async function getTodayFights() {
    const today = new Date().toISOString().split('T')[0];
    return await getFightsByDate(today);
}

/**
 * Get fight by ID
 * @param {number} fightId - Fight ID
 */
async function getFightById(fightId) {
    return await makeRequest('/fights', { id: fightId });
}

/**
 * Get fights by category/league
 * @param {number} categoryId - Category ID (e.g., UFC, Bellator)
 * @param {string} season - Season year
 */
async function getFightsByCategory(categoryId, season) {
    return await makeRequest('/fights', { category: categoryId, season: season });
}

/**
 * Get upcoming fights
 * @param {number} next - Number of upcoming fights to return
 */
async function getUpcomingFights(next = 20) {
    return await makeRequest('/fights', { next: next });
}

// ============================================================
// FIGHTERS
// ============================================================

/**
 * Get fighter by ID
 * @param {number} fighterId - Fighter ID
 */
async function getFighterById(fighterId) {
    return await makeRequest('/fighters', { id: fighterId });
}

/**
 * Search fighters by name
 * @param {string} name - Fighter name
 */
async function searchFighters(name) {
    return await makeRequest('/fighters', { search: name });
}

/**
 * Get fighters by category
 * @param {number} categoryId - Category ID
 */
async function getFightersByCategory(categoryId) {
    return await makeRequest('/fighters', { category: categoryId });
}

// ============================================================
// CATEGORIES (Promotions / Leagues)
// ============================================================

/**
 * Get all categories (UFC, Bellator, ONE, PFL, etc)
 */
async function getCategories() {
    return await makeRequest('/categories');
}

// ============================================================
// ODDS
// ============================================================

/**
 * Get odds for a fight
 * @param {number} fightId - Fight ID
 */
async function getOdds(fightId) {
    return await makeRequest('/odds', { fight: fightId });
}

// ============================================================
// TRANSFORM FUNCTIONS
// ============================================================

/**
 * Transform raw fight data to frontend format
 */
function transformFight(fight) {
    const status = fight.status?.short || '';
    const isLive = ['LIVE', 'IP', 'R1', 'R2', 'R3', 'R4', 'R5'].includes(status);
    const isFinished = ['FT', 'FINISHED', 'POST', 'AW'].includes(status);

    return {
        id: fight.id,
        date: fight.date,
        time: fight.time,
        timestamp: fight.timestamp,

        // Fighters
        fighter1: {
            id: fight.fighters?.home?.id || fight.teams?.home?.id,
            name: fight.fighters?.home?.name || fight.teams?.home?.name,
            logo: fight.fighters?.home?.logo || fight.teams?.home?.logo,
            winner: fight.fighters?.home?.winner || fight.teams?.home?.winner
        },
        fighter2: {
            id: fight.fighters?.away?.id || fight.teams?.away?.id,
            name: fight.fighters?.away?.name || fight.teams?.away?.name,
            logo: fight.fighters?.away?.logo || fight.teams?.away?.logo,
            winner: fight.fighters?.away?.winner || fight.teams?.away?.winner
        },

        // Scores
        fighter1Score: fight.scores?.home?.total ?? null,
        fighter2Score: fight.scores?.away?.total ?? null,

        // Result
        result: {
            method: fight.result?.method || null,
            round: fight.result?.round || null,
            time: fight.result?.time || null,
            winner: fight.result?.winner || null
        },

        // Status
        status: status,
        statusLong: fight.status?.long,
        isLive: isLive,
        isFinished: isFinished,

        // Category/League info
        category: {
            id: fight.category?.id || fight.league?.id,
            name: fight.category?.name || fight.league?.name,
            logo: fight.category?.logo || fight.league?.logo,
            type: fight.category?.type || fight.league?.type,
            season: fight.category?.season || fight.league?.season
        },

        // Country
        country: {
            id: fight.country?.id,
            name: fight.country?.name,
            code: fight.country?.code,
            flag: fight.country?.flag
        },

        // Weight class
        weightClass: fight.weight_class || fight.weightClass || null,

        // Event
        event: fight.event || null
    };
}

/**
 * Transform multiple fights
 */
function transformFights(fights) {
    if (!Array.isArray(fights)) return [];
    return fights.map(transformFight);
}

/**
 * Transform fighter data
 */
function transformFighter(fighter) {
    return {
        id: fighter.id,
        name: fighter.name,
        nickname: fighter.nickname,
        logo: fighter.logo || fighter.image,
        nationality: fighter.nationality,
        birthDate: fighter.birth?.date,
        birthPlace: fighter.birth?.place,
        height: fighter.height,
        weight: fighter.weight,
        reach: fighter.reach,
        stance: fighter.stance,
        record: {
            wins: fighter.record?.wins || fighter.wins || 0,
            losses: fighter.record?.losses || fighter.losses || 0,
            draws: fighter.record?.draws || fighter.draws || 0,
            nc: fighter.record?.nc || 0
        },
        category: fighter.category,
        weightClass: fighter.weight_class || fighter.weightClass,
        team: fighter.team
    };
}

/**
 * Transform multiple fighters
 */
function transformFighters(fighters) {
    if (!Array.isArray(fighters)) return [];
    return fighters.map(transformFighter);
}

module.exports = {
    // Raw API calls
    getLiveFights,
    getFightsByDate,
    getTodayFights,
    getFightById,
    getFightsByCategory,
    getUpcomingFights,
    getFighterById,
    searchFighters,
    getFightersByCategory,
    getCategories,
    getOdds,

    // Transform functions
    transformFight,
    transformFights,
    transformFighter,
    transformFighters
};
