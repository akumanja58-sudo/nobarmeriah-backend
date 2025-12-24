const { supabase } = require('../config/database');
const apiFootball = require('./apiFootball');

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
 */
const saveMatchesToDb = async (matches) => {
    if (!supabase) {
        console.log('⚠️  Supabase not configured, skipping database save');
        return { success: true, cached: false };
    }

    try {
        const transformedMatches = transformMatches(matches);
        
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

module.exports = {
    transformMatch,
    transformMatches,
    saveMatchesToDb,
    getMatchesFromDb,
    syncTodayMatches,
    syncLiveMatches
};
