/**
 * Formula 1 Routes
 * Endpoints for Formula 1 data (Races, Standings, Circuits)
 */

const express = require('express');
const router = express.Router();
const apiFormula1 = require('../services/apiFormula1');

// ============================================================
// ROUTES
// ============================================================

/**
 * GET /api/formula1
 * Get current season overview (races, next race, standings summary)
 */
router.get('/', async (req, res) => {
    try {
        console.log('🏎️ GET /api/formula1');

        // Fetch races and standings in parallel
        const [racesResult, driverStandingsResult, teamStandingsResult] = await Promise.all([
            apiFormula1.getCurrentSeasonRaces(),
            apiFormula1.getCurrentDriverRankings(),
            apiFormula1.getCurrentTeamRankings()
        ]);

        // Transform races
        const races = racesResult.success ? apiFormula1.transformRaces(racesResult.data) : [];
        
        // Separate past and upcoming races
        const now = new Date();
        const pastRaces = races.filter(r => r.isPast).sort((a, b) => new Date(b.date) - new Date(a.date));
        const upcomingRaces = races.filter(r => r.isUpcoming).sort((a, b) => new Date(a.date) - new Date(b.date));
        const nextRace = upcomingRaces.length > 0 ? upcomingRaces[0] : null;

        // Transform standings
        const driverStandings = driverStandingsResult.success 
            ? apiFormula1.transformDriverRankings(driverStandingsResult.data).slice(0, 10) 
            : [];
        const teamStandings = teamStandingsResult.success 
            ? apiFormula1.transformTeamRankings(teamStandingsResult.data) 
            : [];

        // Count stats
        const totalRaces = races.length;
        const completedRaces = pastRaces.length;
        const remainingRaces = upcomingRaces.length;

        res.json({
            success: true,
            season: new Date().getFullYear(),
            stats: {
                total: totalRaces,
                completed: completedRaces,
                remaining: remainingRaces
            },
            nextRace: nextRace,
            upcomingRaces: upcomingRaces.slice(0, 5),
            recentRaces: pastRaces.slice(0, 3),
            driverStandings: driverStandings,
            teamStandings: teamStandings,
            lastUpdated: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Formula 1 overview error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/formula1/races
 * Get all races for current or specified season
 */
router.get('/races', async (req, res) => {
    try {
        const { season } = req.query;
        const targetSeason = season || new Date().getFullYear();

        console.log(`🏎️ GET /api/formula1/races (season: ${targetSeason})`);

        const result = await apiFormula1.getRacesBySeason(targetSeason);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error
            });
        }

        const races = apiFormula1.transformRaces(result.data);
        
        // Sort by date
        races.sort((a, b) => new Date(a.date) - new Date(b.date));

        // Separate past and upcoming
        const pastRaces = races.filter(r => r.isPast);
        const upcomingRaces = races.filter(r => r.isUpcoming);

        res.json({
            success: true,
            season: targetSeason,
            count: races.length,
            races: races,
            pastRaces: pastRaces,
            upcomingRaces: upcomingRaces,
            lastUpdated: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Formula 1 races error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/formula1/race/:raceId
 * Get race detail
 */
router.get('/race/:raceId', async (req, res) => {
    try {
        const { raceId } = req.params;

        console.log(`🏎️ GET /api/formula1/race/${raceId}`);

        const result = await apiFormula1.getRaceById(raceId);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error
            });
        }

        if (!result.data || result.data.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Race not found'
            });
        }

        const race = apiFormula1.transformRace(result.data[0]);

        res.json({
            success: true,
            race: race,
            lastUpdated: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Formula 1 race detail error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/formula1/next-race
 * Get next upcoming race
 */
router.get('/next-race', async (req, res) => {
    try {
        console.log('🏎️ GET /api/formula1/next-race');

        const result = await apiFormula1.getNextRace();

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error
            });
        }

        const nextRace = result.data ? apiFormula1.transformRace(result.data) : null;

        res.json({
            success: true,
            nextRace: nextRace,
            lastUpdated: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Formula 1 next race error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/formula1/standings/drivers
 * Get driver standings
 */
router.get('/standings/drivers', async (req, res) => {
    try {
        const { season } = req.query;
        const targetSeason = season || new Date().getFullYear();

        console.log(`🏎️ GET /api/formula1/standings/drivers (season: ${targetSeason})`);

        const result = await apiFormula1.getDriverRankings(targetSeason);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error
            });
        }

        const standings = apiFormula1.transformDriverRankings(result.data);

        res.json({
            success: true,
            season: targetSeason,
            count: standings.length,
            standings: standings,
            lastUpdated: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Formula 1 driver standings error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/formula1/standings/teams
 * Get constructor/team standings
 */
router.get('/standings/teams', async (req, res) => {
    try {
        const { season } = req.query;
        const targetSeason = season || new Date().getFullYear();

        console.log(`🏎️ GET /api/formula1/standings/teams (season: ${targetSeason})`);

        const result = await apiFormula1.getTeamRankings(targetSeason);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error
            });
        }

        const standings = apiFormula1.transformTeamRankings(result.data);

        res.json({
            success: true,
            season: targetSeason,
            count: standings.length,
            standings: standings,
            lastUpdated: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Formula 1 team standings error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/formula1/circuits
 * Get all circuits
 */
router.get('/circuits', async (req, res) => {
    try {
        const { search } = req.query;

        console.log(`🏎️ GET /api/formula1/circuits ${search ? `(search: ${search})` : ''}`);

        let result;
        if (search) {
            result = await apiFormula1.searchCircuit(search);
        } else {
            result = await apiFormula1.getCircuits();
        }

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error
            });
        }

        const circuits = apiFormula1.transformCircuits(result.data);

        res.json({
            success: true,
            count: circuits.length,
            circuits: circuits,
            lastUpdated: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Formula 1 circuits error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/formula1/circuit/:circuitId
 * Get circuit detail
 */
router.get('/circuit/:circuitId', async (req, res) => {
    try {
        const { circuitId } = req.params;

        console.log(`🏎️ GET /api/formula1/circuit/${circuitId}`);

        const result = await apiFormula1.getCircuitById(circuitId);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error
            });
        }

        if (!result.data || result.data.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Circuit not found'
            });
        }

        const circuit = apiFormula1.transformCircuit(result.data[0]);

        res.json({
            success: true,
            circuit: circuit,
            lastUpdated: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Formula 1 circuit detail error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/formula1/drivers
 * Get all drivers
 */
router.get('/drivers', async (req, res) => {
    try {
        const { search } = req.query;

        console.log(`🏎️ GET /api/formula1/drivers ${search ? `(search: ${search})` : ''}`);

        let result;
        if (search) {
            result = await apiFormula1.searchDriver(search);
        } else {
            result = await apiFormula1.getDrivers();
        }

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error
            });
        }

        res.json({
            success: true,
            count: result.data.length,
            drivers: result.data,
            lastUpdated: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Formula 1 drivers error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/formula1/driver/:driverId
 * Get driver detail
 */
router.get('/driver/:driverId', async (req, res) => {
    try {
        const { driverId } = req.params;

        console.log(`🏎️ GET /api/formula1/driver/${driverId}`);

        const result = await apiFormula1.getDriverById(driverId);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error
            });
        }

        if (!result.data || result.data.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Driver not found'
            });
        }

        res.json({
            success: true,
            driver: result.data[0],
            lastUpdated: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Formula 1 driver detail error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/formula1/teams
 * Get all teams
 */
router.get('/teams', async (req, res) => {
    try {
        const { search } = req.query;

        console.log(`🏎️ GET /api/formula1/teams ${search ? `(search: ${search})` : ''}`);

        let result;
        if (search) {
            result = await apiFormula1.searchTeam(search);
        } else {
            result = await apiFormula1.getTeams();
        }

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error
            });
        }

        res.json({
            success: true,
            count: result.data.length,
            teams: result.data,
            lastUpdated: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Formula 1 teams error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/formula1/team/:teamId
 * Get team detail
 */
router.get('/team/:teamId', async (req, res) => {
    try {
        const { teamId } = req.params;

        console.log(`🏎️ GET /api/formula1/team/${teamId}`);

        const result = await apiFormula1.getTeamById(teamId);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error
            });
        }

        if (!result.data || result.data.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Team not found'
            });
        }

        res.json({
            success: true,
            team: result.data[0],
            lastUpdated: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Formula 1 team detail error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
