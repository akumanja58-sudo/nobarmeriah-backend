// routes/teamStats.js
// Route untuk fetch team statistics dari API-Football

const express = require('express');
const router = express.Router();
const apiFootball = require('../services/apiFootball');

/**
 * GET /api/teams/statistics
 * Get team statistics for a season
 * Query params: team (required), league (required), season (optional)
 */
router.get('/', async (req, res) => {
    try {
        const { team, league, season } = req.query;

        if (!team || !league) {
            return res.status(400).json({
                success: false,
                error: 'Team ID and League ID are required'
            });
        }

        // Calculate current season
        const now = new Date();
        const currentSeason = season || (now.getMonth() + 1 < 8 ? now.getFullYear() - 1 : now.getFullYear());

        console.log(`📊 Fetching team statistics: team=${team}, league=${league}, season=${currentSeason}`);

        const result = await apiFootball.getTeamStatistics(team, league, currentSeason);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error || 'Failed to fetch team statistics'
            });
        }

        const statsData = result.data;

        if (!statsData) {
            return res.json({
                success: true,
                statistics: null,
                message: 'No statistics available for this team'
            });
        }

        // Transform to clean format
        const cleanStats = {
            // Team info
            team: {
                id: statsData.team?.id,
                name: statsData.team?.name,
                logo: statsData.team?.logo
            },
            
            // League info
            league: {
                id: statsData.league?.id,
                name: statsData.league?.name,
                logo: statsData.league?.logo,
                country: statsData.league?.country,
                season: statsData.league?.season
            },
            
            // Form (e.g., "WWDLW")
            form: statsData.form || '',
            
            // Fixtures stats
            fixtures: {
                played: {
                    home: statsData.fixtures?.played?.home || 0,
                    away: statsData.fixtures?.played?.away || 0,
                    total: statsData.fixtures?.played?.total || 0
                },
                wins: {
                    home: statsData.fixtures?.wins?.home || 0,
                    away: statsData.fixtures?.wins?.away || 0,
                    total: statsData.fixtures?.wins?.total || 0
                },
                draws: {
                    home: statsData.fixtures?.draws?.home || 0,
                    away: statsData.fixtures?.draws?.away || 0,
                    total: statsData.fixtures?.draws?.total || 0
                },
                loses: {
                    home: statsData.fixtures?.loses?.home || 0,
                    away: statsData.fixtures?.loses?.away || 0,
                    total: statsData.fixtures?.loses?.total || 0
                }
            },
            
            // Goals stats
            goals: {
                for: {
                    total: {
                        home: statsData.goals?.for?.total?.home || 0,
                        away: statsData.goals?.for?.total?.away || 0,
                        total: statsData.goals?.for?.total?.total || 0
                    },
                    average: {
                        home: statsData.goals?.for?.average?.home || '0',
                        away: statsData.goals?.for?.average?.away || '0',
                        total: statsData.goals?.for?.average?.total || '0'
                    }
                },
                against: {
                    total: {
                        home: statsData.goals?.against?.total?.home || 0,
                        away: statsData.goals?.against?.total?.away || 0,
                        total: statsData.goals?.against?.total?.total || 0
                    },
                    average: {
                        home: statsData.goals?.against?.average?.home || '0',
                        away: statsData.goals?.against?.average?.away || '0',
                        total: statsData.goals?.against?.average?.total || '0'
                    }
                }
            },
            
            // Biggest stats
            biggest: {
                streak: {
                    wins: statsData.biggest?.streak?.wins || 0,
                    draws: statsData.biggest?.streak?.draws || 0,
                    loses: statsData.biggest?.streak?.loses || 0
                },
                wins: {
                    home: statsData.biggest?.wins?.home || null,
                    away: statsData.biggest?.wins?.away || null
                },
                loses: {
                    home: statsData.biggest?.loses?.home || null,
                    away: statsData.biggest?.loses?.away || null
                },
                goals: {
                    for: {
                        home: statsData.biggest?.goals?.for?.home || 0,
                        away: statsData.biggest?.goals?.for?.away || 0
                    },
                    against: {
                        home: statsData.biggest?.goals?.against?.home || 0,
                        away: statsData.biggest?.goals?.against?.away || 0
                    }
                }
            },
            
            // Clean sheets
            clean_sheet: {
                home: statsData.clean_sheet?.home || 0,
                away: statsData.clean_sheet?.away || 0,
                total: statsData.clean_sheet?.total || 0
            },
            
            // Failed to score
            failed_to_score: {
                home: statsData.failed_to_score?.home || 0,
                away: statsData.failed_to_score?.away || 0,
                total: statsData.failed_to_score?.total || 0
            },
            
            // Penalty stats
            penalty: {
                scored: {
                    total: statsData.penalty?.scored?.total || 0,
                    percentage: statsData.penalty?.scored?.percentage || '0%'
                },
                missed: {
                    total: statsData.penalty?.missed?.total || 0,
                    percentage: statsData.penalty?.missed?.percentage || '0%'
                }
            },
            
            // Lineups (formations used)
            lineups: statsData.lineups || [],
            
            // Cards stats
            cards: {
                yellow: statsData.cards?.yellow || {},
                red: statsData.cards?.red || {}
            }
        };

        console.log(`✅ Team statistics fetched for team ${team}`);

        res.json({
            success: true,
            statistics: cleanStats
        });

    } catch (error) {
        console.error('❌ Team statistics route error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
