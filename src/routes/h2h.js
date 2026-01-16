// routes/h2h.js
// Route untuk fetch Head-to-Head data

const express = require('express');
const router = express.Router();
const apiFootball = require('../services/apiFootball');

/**
 * GET /api/h2h
 * Get head-to-head data between two teams
 * Query params: 
 *   - team1 (required): First team ID
 *   - team2 (required): Second team ID  
 *   - last (optional): Number of past matches (default: 12)
 */
router.get('/', async (req, res) => {
    try {
        const { team1, team2, last = 12 } = req.query;

        if (!team1 || !team2) {
            return res.status(400).json({
                success: false,
                error: 'Both team1 and team2 are required'
            });
        }

        console.log(`⚔️ Fetching H2H: Team ${team1} vs Team ${team2}`);

        const result = await apiFootball.getH2H(team1, team2, parseInt(last));

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error || 'Failed to fetch H2H data'
            });
        }

        const fixtures = result.data || [];

        // Calculate statistics
        let team1_wins = 0;
        let team2_wins = 0;
        let draws = 0;
        let team1_name = null;
        let team2_name = null;
        let team1_logo = null;
        let team2_logo = null;

        const matches = [];

        for (const fixture of fixtures) {
            const home = fixture.teams?.home || {};
            const away = fixture.teams?.away || {};
            const goals = fixture.goals || {};
            const league = fixture.league || {};

            const home_goals = goals.home || 0;
            const away_goals = goals.away || 0;

            // Determine which team is team1 and team2
            if (String(home.id) === String(team1)) {
                team1_name = home.name;
                team1_logo = home.logo;
                team2_name = away.name;
                team2_logo = away.logo;

                if (home_goals > away_goals) team1_wins++;
                else if (away_goals > home_goals) team2_wins++;
                else draws++;
            } else {
                team1_name = away.name;
                team1_logo = away.logo;
                team2_name = home.name;
                team2_logo = home.logo;

                if (away_goals > home_goals) team1_wins++;
                else if (home_goals > away_goals) team2_wins++;
                else draws++;
            }

            matches.push({
                id: fixture.fixture?.id,
                date: fixture.fixture?.date,
                home_team: home.name,
                home_team_id: home.id,
                home_team_logo: home.logo,
                away_team: away.name,
                away_team_id: away.id,
                away_team_logo: away.logo,
                home_score: home_goals,
                away_score: away_goals,
                league: league.name,
                league_logo: league.logo,
                venue: fixture.fixture?.venue?.name
            });
        }

        // Calculate recent form (last 5 matches)
        const team1_form = [];
        const team2_form = [];

        for (const match of matches.slice(0, 5)) {
            if (String(match.home_team_id) === String(team1)) {
                if (match.home_score > match.away_score) {
                    team1_form.push('W');
                    team2_form.push('L');
                } else if (match.home_score < match.away_score) {
                    team1_form.push('L');
                    team2_form.push('W');
                } else {
                    team1_form.push('D');
                    team2_form.push('D');
                }
            } else {
                if (match.away_score > match.home_score) {
                    team1_form.push('W');
                    team2_form.push('L');
                } else if (match.away_score < match.home_score) {
                    team1_form.push('L');
                    team2_form.push('W');
                } else {
                    team1_form.push('D');
                    team2_form.push('D');
                }
            }
        }

        console.log(`✅ H2H Result: ${team1_name} ${team1_wins} - ${draws} - ${team2_wins} ${team2_name}`);

        res.json({
            success: true,
            h2h: {
                total_matches: fixtures.length,
                team1: {
                    id: team1,
                    name: team1_name,
                    logo: team1_logo,
                    wins: team1_wins,
                    form: team1_form
                },
                team2: {
                    id: team2,
                    name: team2_name,
                    logo: team2_logo,
                    wins: team2_wins,
                    form: team2_form
                },
                draws: draws,
                matches: matches
            }
        });

    } catch (error) {
        console.error('❌ H2H route error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
