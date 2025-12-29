const { supabase } = require('../config/database');
const apiFootball = require('./apiFootball');

/**
 * Blacklist match IDs - matches that are stuck/broken in API-Football
 * These will be skipped when syncing and not saved to database
 * Add match IDs here when they're stuck as LIVE for days
 */
const BLACKLISTED_MATCH_IDS = [
    1434975,  // Rayners Lane vs Hitchin Town - stuck since 27/12/2025
];

/**
 * Check if match is blacklisted
 */
const isBlacklisted = (matchId) => {
    return BLACKLISTED_MATCH_IDS.includes(matchId);
};

/**
 * Transform API-Football response ke format yang lebih clean
 */
const transformMatch = (match) => {
    const fixture = match.fixture;
    const league = match.league;
    const teams = match.teams;
    const goals = match.goals;
    const score = match.score;

    // Determine match status
    let status = 'scheduled';
    let isLive = false;

    const shortStatus = fixture.status.short;

    if (['1H', '2H', 'HT', 'ET', 'P', 'BT', 'LIVE'].includes(shortStatus)) {
        status = 'live';
        isLive = true;
    } else if (['FT', 'AET', 'PEN'].includes(shortStatus)) {
        status = 'finished';
    } else if (['PST', 'CANC', 'ABD', 'AWD', 'WO'].includes(shortStatus)) {
        status = 'postponed';
    } else if (['TBD', 'NS'].includes(shortStatus)) {
        status = 'scheduled';
    }

    return {
        id: fixture.id,
        date: fixture.date,
        timestamp: fixture.timestamp,
        timezone: fixture.timezone,
        venue: fixture.venue?.name || null,
        venue_city: fixture.venue?.city || null,

        // Status
        status: status,
        status_short: shortStatus,
        status_long: fixture.status.long,
        elapsed: fixture.status.elapsed,
        is_live: isLive,

        // League info
        league_id: league.id,
        league_name: league.name,
        league_country: league.country,
        league_logo: league.logo,
        league_flag: league.flag,
        league_season: league.season,
        league_round: league.round,

        // Home team
        home_team_id: teams.home.id,
        home_team_name: teams.home.name,
        home_team_logo: teams.home.logo,
        home_team_winner: teams.home.winner,

        // Away team
        away_team_id: teams.away.id,
        away_team_name: teams.away.name,
        away_team_logo: teams.away.logo,
        away_team_winner: teams.away.winner,

        // Goals
        home_score: goals.home,
        away_score: goals.away,

        // Halftime score
        ht_home: score.halftime?.home,
        ht_away: score.halftime?.away,

        // Fulltime score
        ft_home: score.fulltime?.home,
        ft_away: score.fulltime?.away,

        // Extra time score
        et_home: score.extratime?.home,
        et_away: score.extratime?.away,

        // Penalty score
        pen_home: score.penalty?.home,
        pen_away: score.penalty?.away,

        // Metadata
        last_updated: new Date().toISOString()
    };
};

/**
 * Transform multiple matches
 */
const transformMatches = (matches) => {
    return matches.map(transformMatch);
};

/**
 * Save matches to Supabase (upsert)
 * Filters out blacklisted matches before saving
 */
const saveMatchesToDb = async (matches) => {
    if (!supabase) {
        console.log('⚠️  Supabase not configured, skipping database save');
        return { success: true, cached: false };
    }

    try {
        // Filter out blacklisted matches
        const filteredMatches = matches.filter(match => {
            const matchId = match.fixture?.id || match.id;
            if (isBlacklisted(matchId)) {
                console.log(`🚫 Skipping blacklisted match: ${matchId}`);
                return false;
            }
            return true;
        });

        if (filteredMatches.length === 0) {
            console.log('⚠️  No matches to save (all blacklisted or empty)');
            return { success: true, count: 0 };
        }

        const transformedMatches = transformMatches(filteredMatches);

        const { data, error } = await supabase
            .from('matches')
            .upsert(transformedMatches, {
                onConflict: 'id',
                ignoreDuplicates: false
            });

        if (error) {
            console.error('❌ Supabase Error:', error);
            return { success: false, error: error.message };
        }

        console.log(`✅ Saved ${transformedMatches.length} matches to database`);
        return { success: true, count: transformedMatches.length };
    } catch (error) {
        console.error('❌ Save Error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Get matches from database
 */
const getMatchesFromDb = async (filters = {}) => {
    if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
    }

    try {
        let query = supabase
            .from('matches')
            .select('*')
            .order('date', { ascending: true });

        // Apply filters
        if (filters.date) {
            const startOfDay = `${filters.date}T00:00:00`;
            const endOfDay = `${filters.date}T23:59:59`;
            query = query.gte('date', startOfDay).lte('date', endOfDay);
        }

        if (filters.league_id) {
            query = query.eq('league_id', filters.league_id);
        }

        if (filters.is_live !== undefined) {
            query = query.eq('is_live', filters.is_live);
        }

        if (filters.status) {
            query = query.eq('status', filters.status);
        }

        const { data, error } = await query;

        if (error) {
            return { success: false, error: error.message };
        }

        return { success: true, data };
    } catch (error) {
        return { success: false, error: error.message };
    }
};

/**
 * Sync today's matches (fetch from API & save to DB)
 */
const syncTodayMatches = async () => {
    console.log('🔄 Syncing today matches...');

    const result = await apiFootball.getTodayMatches();

    if (!result.success) {
        console.error('❌ Failed to fetch matches:', result.error);
        return result;
    }

    console.log(`📊 Fetched ${result.results} matches from API`);

    // Save to database
    const saveResult = await saveMatchesToDb(result.data);

    return {
        success: true,
        fetched: result.results,
        saved: saveResult.success,
        matches: transformMatches(result.data)
    };
};

/**
 * Sync live matches only (untuk update skor real-time)
 */
const syncLiveMatches = async () => {
    console.log('⚡ Syncing live matches...');

    const result = await apiFootball.getLiveMatches();

    if (!result.success) {
        return result;
    }

    if (result.data.length > 0) {
        await saveMatchesToDb(result.data);
    }

    return {
        success: true,
        liveCount: result.results,
        matches: transformMatches(result.data)
    };
};

/**
 * Fix stuck matches - matches that are "LIVE" for more than X hours
 * These are likely matches where API didn't update the final status
 * @param {number} maxHours - Maximum hours a match can be "LIVE" (default: 4)
 */
const fixStuckMatches = async (maxHours = 4) => {
    if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
    }

    try {
        console.log(`🔧 Checking for stuck matches (LIVE > ${maxHours} hours)...`);

        // Calculate cutoff time (now - maxHours)
        const cutoffTime = new Date();
        cutoffTime.setHours(cutoffTime.getHours() - maxHours);
        const cutoffISO = cutoffTime.toISOString();

        // Find stuck matches: status is LIVE but match started more than X hours ago
        const { data: stuckMatches, error: fetchError } = await supabase
            .from('matches')
            .select('*')
            .or('is_live.eq.true,status.eq.live')
            .lt('date', cutoffISO);

        if (fetchError) {
            console.error('❌ Error fetching stuck matches:', fetchError);
            return { success: false, error: fetchError.message };
        }

        if (!stuckMatches || stuckMatches.length === 0) {
            console.log('✅ No stuck matches found');
            return { success: true, fixed: 0 };
        }

        console.log(`⚠️ Found ${stuckMatches.length} stuck matches`);

        // Fix each stuck match - mark as FT (Finished) or ABD (Abandoned)
        const fixedIds = [];
        const failedIds = [];

        for (const match of stuckMatches) {
            const hoursStuck = Math.round((new Date() - new Date(match.date)) / (1000 * 60 * 60));

            console.log(`🔧 Fixing: ${match.home_team_name} vs ${match.away_team_name} (stuck ${hoursStuck}h)`);

            // If match has scores, mark as FT. Otherwise mark as ABD
            const hasScores = match.home_score !== null && match.away_score !== null;
            const newStatusShort = hasScores ? 'FT' : 'ABD';
            const newStatus = hasScores ? 'finished' : 'postponed';
            const newStatusLong = hasScores ? 'Match Finished' : 'Match Abandoned';

            // Update with explicit values
            const updateData = {
                status: newStatus,
                status_short: newStatusShort,
                status_long: newStatusLong,
                is_live: false,
                last_updated: new Date().toISOString()
            };

            // Also set final scores if available
            if (hasScores) {
                updateData.ft_home = match.home_score;
                updateData.ft_away = match.away_score;
            }

            const { data: updateResult, error: updateError } = await supabase
                .from('matches')
                .update(updateData)
                .eq('id', match.id)
                .select();

            if (updateError) {
                console.error(`❌ Failed to fix match ${match.id}:`, updateError.message);
                failedIds.push({ id: match.id, error: updateError.message });
            } else if (!updateResult || updateResult.length === 0) {
                console.error(`❌ Match ${match.id} not updated (no rows affected)`);
                failedIds.push({ id: match.id, error: 'No rows affected' });
            } else {
                // Verify the update
                const updated = updateResult[0];
                if (updated.is_live === false && updated.status_short === newStatusShort) {
                    fixedIds.push(match.id);
                    console.log(`✅ Fixed match ${match.id} → ${newStatusShort}`);
                } else {
                    console.error(`❌ Match ${match.id} update verification failed`);
                    console.error(`   Expected: is_live=false, status_short=${newStatusShort}`);
                    console.error(`   Got: is_live=${updated.is_live}, status_short=${updated.status_short}`);
                    failedIds.push({ id: match.id, error: 'Verification failed' });
                }
            }
        }

        console.log(`✅ Fixed ${fixedIds.length} stuck matches`);
        if (failedIds.length > 0) {
            console.log(`❌ Failed to fix ${failedIds.length} matches:`, failedIds);
        }

        return {
            success: true,
            fixed: fixedIds.length,
            failed: failedIds.length,
            fixedMatches: fixedIds,
            failedMatches: failedIds
        };

    } catch (error) {
        console.error('❌ Fix stuck matches error:', error);
        return { success: false, error: error.message };
    }
};

module.exports = {
    transformMatch,
    transformMatches,
    saveMatchesToDb,
    getMatchesFromDb,
    syncTodayMatches,
    syncLiveMatches,
    fixStuckMatches,
    isBlacklisted,
    BLACKLISTED_MATCH_IDS
};
