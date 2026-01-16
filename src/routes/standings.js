// routes/standings.js
// Route untuk fetch league standings/klasemen

const express = require('express');
const router = express.Router();
const apiFootball = require('../services/apiFootball');

/**
 * GET /api/standings
 * Get league standings
 * Query params: league (required), season (optional)
 */
router.get('/', async (req, res) => {
    try {
        const { league, season } = req.query;

        if (!league) {
            return res.status(400).json({
                success: false,
                error: 'League ID is required'
            });
        }

        console.log(`📊 Fetching standings for league ${league}, season ${season || 'current'}`);

        const result = await apiFootball.getStandings(league, season);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error || 'Failed to fetch standings'
            });
        }

        const standingsData = result.data || [];

        // Parse standings data
        if (!standingsData.length) {
            return res.json({
                success: true,
                standings: [],
                league: null
            });
        }

        const leagueInfo = standingsData[0]?.league || {};
        const standingsRaw = leagueInfo.standings || [[]];

        // Transform standings to clean format
        const standings = [];

        for (const team of standingsRaw[0] || []) {
            standings.push({
                rank: team.rank,
                team: {
                    id: team.team?.id,
                    name: team.team?.name,
                    logo: team.team?.logo
                },
                points: team.points,
                played: team.all?.played || 0,
                win: team.all?.win || 0,
                draw: team.all?.draw || 0,
                lose: team.all?.lose || 0,
                goals_for: team.all?.goals?.for || 0,
                goals_against: team.all?.goals?.against || 0,
                goal_diff: team.goalsDiff,
                form: team.form || '',
                description: team.description,
                home: {
                    played: team.home?.played || 0,
                    win: team.home?.win || 0,
                    draw: team.home?.draw || 0,
                    lose: team.home?.lose || 0,
                    goals_for: team.home?.goals?.for || 0,
                    goals_against: team.home?.goals?.against || 0
                },
                away: {
                    played: team.away?.played || 0,
                    win: team.away?.win || 0,
                    draw: team.away?.draw || 0,
                    lose: team.away?.lose || 0,
                    goals_for: team.away?.goals?.for || 0,
                    goals_against: team.away?.goals?.against || 0
                }
            });
        }

        console.log(`✅ Standings: Found ${standings.length} teams for ${leagueInfo.name}`);

        res.json({
            success: true,
            league: {
                id: leagueInfo.id,
                name: leagueInfo.name,
                logo: leagueInfo.logo,
                country: leagueInfo.country,
                flag: leagueInfo.flag,
                season: leagueInfo.season
            },
            standings: standings,
            has_groups: (standingsRaw.length > 1)
        });

    } catch (error) {
        console.error('❌ Standings route error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
