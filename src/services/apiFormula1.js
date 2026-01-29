/**
 * API Formula 1 Service
 * Provider: api-sports.io
 * Documentation: https://api-sports.io/documentation/formula-1/v1
 */

const axios = require('axios');

const BASE_URL = 'https://v1.formula-1.api-sports.io';
const API_KEY = process.env.API_SPORTS_KEY || process.env.API_FOOTBALL_KEY;

/**
 * Helper: Make API request to Formula 1 API
 */
async function makeRequest(endpoint, params = {}) {
    try {
        console.log(`🏎️ Formula 1 API: ${endpoint}`);

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
        console.error(`❌ Formula 1 API Error (${endpoint}):`, error.message);
        return {
            success: false,
            error: error.message,
            data: []
        };
    }
}

// ============================================================
// RACES
// ============================================================

/**
 * Get races by season
 * @param {number} season - Season year (e.g., 2024)
 */
async function getRacesBySeason(season) {
    return await makeRequest('/races', { season: season });
}

/**
 * Get current season races
 */
async function getCurrentSeasonRaces() {
    const currentYear = new Date().getFullYear();
    return await getRacesBySeason(currentYear);
}

/**
 * Get race by ID
 * @param {number} raceId - Race ID
 */
async function getRaceById(raceId) {
    return await makeRequest('/races', { id: raceId });
}

/**
 * Get next race
 */
async function getNextRace() {
    const result = await getCurrentSeasonRaces();
    if (!result.success) return result;

    const now = new Date();
    const upcomingRaces = result.data.filter(race => {
        const raceDate = new Date(race.date);
        return raceDate >= now;
    }).sort((a, b) => new Date(a.date) - new Date(b.date));

    return {
        success: true,
        data: upcomingRaces.length > 0 ? upcomingRaces[0] : null
    };
}

// ============================================================
// RANKINGS / STANDINGS
// ============================================================

/**
 * Get driver rankings/standings
 * @param {number} season - Season year
 */
async function getDriverRankings(season) {
    return await makeRequest('/rankings/drivers', { season: season });
}

/**
 * Get current season driver rankings
 */
async function getCurrentDriverRankings() {
    const currentYear = new Date().getFullYear();
    return await getDriverRankings(currentYear);
}

/**
 * Get team/constructor rankings
 * @param {number} season - Season year
 */
async function getTeamRankings(season) {
    return await makeRequest('/rankings/teams', { season: season });
}

/**
 * Get current season team rankings
 */
async function getCurrentTeamRankings() {
    const currentYear = new Date().getFullYear();
    return await getTeamRankings(currentYear);
}

// ============================================================
// CIRCUITS
// ============================================================

/**
 * Get all circuits
 */
async function getCircuits() {
    return await makeRequest('/circuits');
}

/**
 * Get circuit by ID
 * @param {number} circuitId - Circuit ID
 */
async function getCircuitById(circuitId) {
    return await makeRequest('/circuits', { id: circuitId });
}

/**
 * Search circuit by name
 * @param {string} name - Circuit name
 */
async function searchCircuit(name) {
    return await makeRequest('/circuits', { search: name });
}

// ============================================================
// DRIVERS
// ============================================================

/**
 * Get all drivers
 */
async function getDrivers() {
    return await makeRequest('/drivers');
}

/**
 * Get driver by ID
 * @param {number} driverId - Driver ID
 */
async function getDriverById(driverId) {
    return await makeRequest('/drivers', { id: driverId });
}

/**
 * Search driver by name
 * @param {string} name - Driver name
 */
async function searchDriver(name) {
    return await makeRequest('/drivers', { search: name });
}

// ============================================================
// TEAMS
// ============================================================

/**
 * Get all teams
 */
async function getTeams() {
    return await makeRequest('/teams');
}

/**
 * Get team by ID
 * @param {number} teamId - Team ID
 */
async function getTeamById(teamId) {
    return await makeRequest('/teams', { id: teamId });
}

/**
 * Search team by name
 * @param {string} name - Team name
 */
async function searchTeam(name) {
    return await makeRequest('/teams', { search: name });
}

// ============================================================
// COMPETITIONS
// ============================================================

/**
 * Get all competitions/series
 */
async function getCompetitions() {
    return await makeRequest('/competitions');
}

// ============================================================
// TRANSFORM FUNCTIONS
// ============================================================

/**
 * Transform race data to frontend format
 */
function transformRace(race) {
    const raceDate = new Date(race.date);
    const now = new Date();
    const isPast = raceDate < now;
    const isUpcoming = raceDate >= now;

    // Calculate days until race
    const diffTime = raceDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return {
        id: race.id,
        competition: {
            id: race.competition?.id,
            name: race.competition?.name,
            location: {
                country: race.competition?.location?.country,
                city: race.competition?.location?.city
            }
        },
        circuit: {
            id: race.circuit?.id,
            name: race.circuit?.name,
            image: race.circuit?.image,
            length: race.circuit?.length,
            lapRecord: race.circuit?.lap_record
        },
        season: race.season,
        type: race.type, // "Race", "Sprint", "Qualifying", etc.
        
        // Date & Time
        date: race.date,
        timezone: race.timezone,
        
        // Status
        status: race.status,
        isPast: isPast,
        isUpcoming: isUpcoming,
        daysUntil: isUpcoming ? diffDays : null,

        // Results (if race is finished)
        laps: race.laps,
        fastestLap: race.fastest_lap,
        distance: race.distance
    };
}

/**
 * Transform multiple races
 */
function transformRaces(races) {
    if (!Array.isArray(races)) return [];
    return races.map(transformRace);
}

/**
 * Transform driver ranking
 */
function transformDriverRanking(ranking) {
    return {
        position: ranking.position,
        driver: {
            id: ranking.driver?.id,
            name: ranking.driver?.name,
            abbr: ranking.driver?.abbr,
            number: ranking.driver?.number,
            image: ranking.driver?.image,
            nationality: ranking.driver?.nationality
        },
        team: {
            id: ranking.team?.id,
            name: ranking.team?.name,
            logo: ranking.team?.logo
        },
        points: ranking.points,
        wins: ranking.wins,
        season: ranking.season
    };
}

/**
 * Transform driver rankings array
 */
function transformDriverRankings(rankings) {
    if (!Array.isArray(rankings)) return [];
    return rankings.map(transformDriverRanking);
}

/**
 * Transform team ranking
 */
function transformTeamRanking(ranking) {
    return {
        position: ranking.position,
        team: {
            id: ranking.team?.id,
            name: ranking.team?.name,
            logo: ranking.team?.logo
        },
        points: ranking.points,
        season: ranking.season
    };
}

/**
 * Transform team rankings array
 */
function transformTeamRankings(rankings) {
    if (!Array.isArray(rankings)) return [];
    return rankings.map(transformTeamRanking);
}

/**
 * Transform circuit data
 */
function transformCircuit(circuit) {
    return {
        id: circuit.id,
        name: circuit.name,
        image: circuit.image,
        competition: {
            id: circuit.competition?.id,
            name: circuit.competition?.name,
            location: {
                country: circuit.competition?.location?.country,
                city: circuit.competition?.location?.city
            }
        },
        firstGrandPrix: circuit.first_grand_prix,
        laps: circuit.laps,
        length: circuit.length,
        raceDistance: circuit.race_distance,
        lapRecord: {
            time: circuit.lap_record?.time,
            driver: circuit.lap_record?.driver,
            year: circuit.lap_record?.year
        },
        capacity: circuit.capacity,
        opened: circuit.opened
    };
}

/**
 * Transform circuits array
 */
function transformCircuits(circuits) {
    if (!Array.isArray(circuits)) return [];
    return circuits.map(transformCircuit);
}

module.exports = {
    // Raw API calls
    getRacesBySeason,
    getCurrentSeasonRaces,
    getRaceById,
    getNextRace,
    getDriverRankings,
    getCurrentDriverRankings,
    getTeamRankings,
    getCurrentTeamRankings,
    getCircuits,
    getCircuitById,
    searchCircuit,
    getDrivers,
    getDriverById,
    searchDriver,
    getTeams,
    getTeamById,
    searchTeam,
    getCompetitions,

    // Transform functions
    transformRace,
    transformRaces,
    transformDriverRanking,
    transformDriverRankings,
    transformTeamRanking,
    transformTeamRankings,
    transformCircuit,
    transformCircuits
};
