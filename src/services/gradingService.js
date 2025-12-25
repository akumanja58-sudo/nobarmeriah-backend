/**
 * Grading Service
 * Auto grade predictions when matches finish (FT)
 * 
 * Flow:
 * 1. Get finished matches (FT) yang belum di-grade
 * 2. Get semua prediksi untuk match tersebut
 * 3. Compare prediksi vs hasil asli
 * 4. Kasih poin ke user
 * 5. Update streak (PER MATCH, bukan per prediksi)
 */

const { createClient } = require('@supabase/supabase-js');
const apiFootball = require('./apiFootball');

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

// Big leagues untuk bonus poin
const BIG_LEAGUES = [
    'UEFA Champions League',
    'Premier League',
    'La Liga',
    'Serie A',
    'Bundesliga',
    'Liga 1',
    'Europa League',
    'World Cup',
    'Euro Championship'
];

/**
 * Check apakah match termasuk big match
 */
const isBigMatch = (leagueName) => {
    if (!leagueName) return false;
    return BIG_LEAGUES.some(league =>
        leagueName.toLowerCase().includes(league.toLowerCase())
    );
};

/**
 * Calculate points untuk prediksi
 */
const calculatePoints = (predictionType, isCorrect, leagueName) => {
    if (!isCorrect) return 0;

    const isBig = isBigMatch(leagueName);

    if (predictionType === 'winner') {
        return isBig ? 15 : 10;
    } else if (predictionType === 'score') {
        return isBig ? 25 : 20;
    }

    return 0;
};

/**
 * Calculate streak bonus
 */
const calculateStreakBonus = (streak) => {
    if (streak >= 10) return 25;
    if (streak >= 5) return 10;
    if (streak >= 3) return 5;
    return 0;
};

/**
 * Get finished matches yang belum di-grade
 */
const getFinishedMatchesToGrade = async () => {
    try {
        // Get matches dengan status FT yang ada prediksi pending
        const { data: winnerPredictions, error: winnerError } = await supabase
            .from('winner_predictions')
            .select('match_id')
            .eq('status', 'pending');

        const { data: scorePredictions, error: scoreError } = await supabase
            .from('score_predictions')
            .select('match_id')
            .eq('status', 'pending');

        if (winnerError || scoreError) {
            console.error('Error fetching pending predictions:', winnerError || scoreError);
            return [];
        }

        // Combine unique match IDs
        const matchIds = new Set([
            ...(winnerPredictions || []).map(p => p.match_id),
            ...(scorePredictions || []).map(p => p.match_id)
        ]);

        return Array.from(matchIds);
    } catch (error) {
        console.error('Error in getFinishedMatchesToGrade:', error);
        return [];
    }
};

/**
 * Get match result from API-Football
 */
const getMatchResult = async (matchId) => {
    try {
        const result = await apiFootball.getMatchById(matchId);

        if (!result.success || !result.data || result.data.length === 0) {
            return null;
        }

        const match = result.data[0];
        const fixture = match.fixture;
        const teams = match.teams;
        const goals = match.goals;
        const league = match.league;

        // Check if match is finished
        const finishedStatuses = ['FT', 'AET', 'PEN'];
        if (!finishedStatuses.includes(fixture.status.short)) {
            return null; // Match not finished yet
        }

        // Determine winner
        let winner;
        if (goals.home > goals.away) {
            winner = 'home';
        } else if (goals.away > goals.home) {
            winner = 'away';
        } else {
            winner = 'draw';
        }

        return {
            matchId: fixture.id,
            status: fixture.status.short,
            homeTeam: teams.home.name,
            awayTeam: teams.away.name,
            homeScore: goals.home,
            awayScore: goals.away,
            winner: winner,
            leagueName: league.name
        };
    } catch (error) {
        console.error(`Error getting match result for ${matchId}:`, error);
        return null;
    }
};

/**
 * Grade winner predictions untuk satu match
 * Returns: { graded, correct, userResults: { email: { points, isCorrect } } }
 */
const gradeWinnerPredictions = async (matchId, matchResult) => {
    try {
        // Get all pending winner predictions for this match
        const { data: predictions, error } = await supabase
            .from('winner_predictions')
            .select('*')
            .eq('match_id', matchId)
            .eq('status', 'pending');

        if (error || !predictions || predictions.length === 0) {
            return { graded: 0, correct: 0, userResults: {} };
        }

        let gradedCount = 0;
        let correctCount = 0;
        const userResults = {};

        for (const prediction of predictions) {
            const isCorrect = prediction.predicted_result === matchResult.winner;
            const pointsEarned = calculatePoints('winner', isCorrect, matchResult.leagueName);

            // Update prediction status
            const { error: updateError } = await supabase
                .from('winner_predictions')
                .update({
                    status: 'graded',
                    is_correct: isCorrect,
                    points_earned: pointsEarned,
                    actual_result: matchResult.winner,
                    graded_at: new Date().toISOString()
                })
                .eq('id', prediction.id);

            if (updateError) {
                console.error('Error updating winner prediction:', updateError);
                continue;
            }

            // Store user result for later streak calculation
            userResults[prediction.email] = {
                points: pointsEarned,
                isCorrect: isCorrect
            };

            if (isCorrect) correctCount++;
            gradedCount++;
        }

        return { graded: gradedCount, correct: correctCount, userResults };
    } catch (error) {
        console.error('Error grading winner predictions:', error);
        return { graded: 0, correct: 0, userResults: {} };
    }
};

/**
 * Grade score predictions untuk satu match
 * Returns: { graded, correct, userResults: { email: { points, isCorrect } } }
 */
const gradeScorePredictions = async (matchId, matchResult) => {
    try {
        // Get all pending score predictions for this match
        const { data: predictions, error } = await supabase
            .from('score_predictions')
            .select('*')
            .eq('match_id', matchId)
            .eq('status', 'pending');

        if (error || !predictions || predictions.length === 0) {
            return { graded: 0, correct: 0, userResults: {} };
        }

        let gradedCount = 0;
        let correctCount = 0;
        const userResults = {};

        for (const prediction of predictions) {
            const isCorrect =
                prediction.predicted_home_score === matchResult.homeScore &&
                prediction.predicted_away_score === matchResult.awayScore;

            const pointsEarned = calculatePoints('score', isCorrect, matchResult.leagueName);

            // Update prediction status
            const { error: updateError } = await supabase
                .from('score_predictions')
                .update({
                    status: 'graded',
                    is_correct: isCorrect,
                    points_earned: pointsEarned,
                    actual_home_score: matchResult.homeScore,
                    actual_away_score: matchResult.awayScore,
                    graded_at: new Date().toISOString()
                })
                .eq('id', prediction.id);

            if (updateError) {
                console.error('Error updating score prediction:', updateError);
                continue;
            }

            // Store user result for later streak calculation
            userResults[prediction.email] = {
                points: pointsEarned,
                isCorrect: isCorrect
            };

            if (isCorrect) correctCount++;
            gradedCount++;
        }

        return { graded: gradedCount, correct: correctCount, userResults };
    } catch (error) {
        console.error('Error grading score predictions:', error);
        return { graded: 0, correct: 0, userResults: {} };
    }
};

/**
 * Update user stats PER MATCH (combined winner + score)
 * Streak dihitung berdasarkan: ada minimal 1 prediksi benar di match ini
 */
const updateUserStatsPerMatch = async (email, winnerResult, scoreResult) => {
    try {
        // Calculate total points from this match
        const winnerPoints = winnerResult?.points || 0;
        const scorePoints = scoreResult?.points || 0;
        const totalPoints = winnerPoints + scorePoints;

        // Determine if user got ANY prediction correct in this match (for streak)
        const hasCorrectPrediction = (winnerResult?.isCorrect === true) || (scoreResult?.isCorrect === true);

        // Count predictions made
        const predictionsMade = (winnerResult ? 1 : 0) + (scoreResult ? 1 : 0);
        const correctPredictions = (winnerResult?.isCorrect ? 1 : 0) + (scoreResult?.isCorrect ? 1 : 0);

        // Get current user stats
        const { data: profile, error: fetchError } = await supabase
            .from('profiles')
            .select('total_experience, season_points, current_streak, best_streak, correct_predictions, total_predictions')
            .eq('email', email)
            .single();

        if (fetchError || !profile) {
            console.error('Error fetching user profile:', fetchError);
            return;
        }

        // Calculate new streak (based on match, not individual predictions)
        let newStreak = hasCorrectPrediction ? (profile.current_streak || 0) + 1 : 0;
        let newBestStreak = Math.max(newStreak, profile.best_streak || 0);

        // Calculate streak bonus (only when reaching milestones)
        let streakBonus = 0;
        if (hasCorrectPrediction) {
            const oldStreak = profile.current_streak || 0;
            // Give bonus when reaching 3, 5, or 10
            if (newStreak === 3 && oldStreak < 3) {
                streakBonus = 5;
                console.log(`🔥 Streak bonus! ${email} reached 3 streak, +5 bonus`);
            } else if (newStreak === 5 && oldStreak < 5) {
                streakBonus = 10;
                console.log(`🔥 Streak bonus! ${email} reached 5 streak, +10 bonus`);
            } else if (newStreak === 10 && oldStreak < 10) {
                streakBonus = 25;
                console.log(`🔥 Streak bonus! ${email} reached 10 streak, +25 bonus`);
            }
        }

        const totalPointsEarned = totalPoints + streakBonus;

        // Update profile
        const { error: updateError } = await supabase
            .from('profiles')
            .update({
                total_experience: (profile.total_experience || 0) + totalPointsEarned,
                season_points: (profile.season_points || 0) + totalPointsEarned,
                current_streak: newStreak,
                best_streak: newBestStreak,
                correct_predictions: (profile.correct_predictions || 0) + correctPredictions,
                total_predictions: (profile.total_predictions || 0) + predictionsMade
            })
            .eq('email', email);

        if (updateError) {
            console.error('Error updating user stats:', updateError);
            return;
        }

        // Log result
        if (totalPointsEarned > 0) {
            console.log(`✅ ${email}: +${totalPoints} pts${streakBonus > 0 ? ` (+${streakBonus} streak bonus)` : ''}, streak: ${newStreak}`);
        } else if (hasCorrectPrediction) {
            console.log(`✅ ${email}: correct but 0 pts, streak: ${newStreak}`);
        } else {
            console.log(`❌ ${email}: wrong predictions, streak reset to 0`);
        }

    } catch (error) {
        console.error('Error in updateUserStatsPerMatch:', error);
    }
};

/**
 * Main grading function - grade all pending predictions
 */
const gradeAllPendingPredictions = async () => {
    console.log('\n🎯 Starting grading process...');

    try {
        // Get match IDs with pending predictions
        const matchIds = await getFinishedMatchesToGrade();

        if (matchIds.length === 0) {
            console.log('📝 No pending predictions to grade');
            return { success: true, graded: 0 };
        }

        console.log(`📋 Found ${matchIds.length} matches with pending predictions`);

        let totalGraded = 0;
        let totalCorrect = 0;

        for (const matchId of matchIds) {
            // Get match result from API
            const matchResult = await getMatchResult(matchId);

            if (!matchResult) {
                console.log(`⏳ Match ${matchId} not finished yet, skipping...`);
                continue;
            }

            console.log(`\n⚽ Grading match: ${matchResult.homeTeam} ${matchResult.homeScore}-${matchResult.awayScore} ${matchResult.awayTeam}`);

            // Grade winner predictions (don't update user stats yet)
            const winnerResults = await gradeWinnerPredictions(matchId, matchResult);
            console.log(`   Winner predictions: ${winnerResults.graded} graded, ${winnerResults.correct} correct`);

            // Grade score predictions (don't update user stats yet)
            const scoreResults = await gradeScorePredictions(matchId, matchResult);
            console.log(`   Score predictions: ${scoreResults.graded} graded, ${scoreResults.correct} correct`);

            // Now update user stats PER MATCH (combining winner + score results)
            // Get all unique emails from both results
            const allEmails = new Set([
                ...Object.keys(winnerResults.userResults),
                ...Object.keys(scoreResults.userResults)
            ]);

            for (const email of allEmails) {
                await updateUserStatsPerMatch(
                    email,
                    winnerResults.userResults[email] || null,
                    scoreResults.userResults[email] || null
                );
            }

            totalGraded += winnerResults.graded + scoreResults.graded;
            totalCorrect += winnerResults.correct + scoreResults.correct;

            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        console.log(`\n✅ Grading complete! Total: ${totalGraded} predictions graded, ${totalCorrect} correct`);

        return {
            success: true,
            graded: totalGraded,
            correct: totalCorrect
        };

    } catch (error) {
        console.error('❌ Grading error:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Manual grade untuk specific match (bisa dipanggil dari admin)
 */
const gradeMatch = async (matchId) => {
    console.log(`\n🎯 Manual grading for match ${matchId}...`);

    const matchResult = await getMatchResult(matchId);

    if (!matchResult) {
        return { success: false, error: 'Match not finished or not found' };
    }

    // Grade predictions
    const winnerResults = await gradeWinnerPredictions(matchId, matchResult);
    const scoreResults = await gradeScorePredictions(matchId, matchResult);

    // Update user stats per match
    const allEmails = new Set([
        ...Object.keys(winnerResults.userResults),
        ...Object.keys(scoreResults.userResults)
    ]);

    for (const email of allEmails) {
        await updateUserStatsPerMatch(
            email,
            winnerResults.userResults[email] || null,
            scoreResults.userResults[email] || null
        );
    }

    return {
        success: true,
        match: `${matchResult.homeTeam} ${matchResult.homeScore}-${matchResult.awayScore} ${matchResult.awayTeam}`,
        winnerPredictions: winnerResults,
        scorePredictions: scoreResults
    };
};

module.exports = {
    gradeAllPendingPredictions,
    gradeMatch,
    getMatchResult,
    calculatePoints,
    calculateStreakBonus,
    isBigMatch
};
