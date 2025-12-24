// hooks/useLivescore.js
// Clean hook untuk fetch data dari livescore backend

import { useState, useEffect, useCallback, useRef } from 'react';

// Default backend URL - sesuaikan dengan env lo
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

/**
 * Custom hook untuk fetch matches dari backend
 */
export const useLivescore = (options = {}) => {
    const {
        autoFetch = true,
        refreshInterval = 60000, // 1 menit default
        liveOnly = false,
        date = null,
        leagueId = null
    } = options;

    const [matches, setMatches] = useState([]);
    const [grouped, setGrouped] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [serverStatus, setServerStatus] = useState({ connected: false });

    const intervalRef = useRef(null);

    /**
     * Fetch matches dari backend
     */
    const fetchMatches = useCallback(async (isBackground = false) => {
        try {
            if (!isBackground) setLoading(true);
            setError(null);

            // Build query params
            const params = new URLSearchParams();
            if (liveOnly) params.set('live', 'true');
            if (date) params.set('date', date);

            const queryString = params.toString();
            let url = `${API_BASE_URL}/api/matches`;
            
            if (leagueId) {
                url = `${API_BASE_URL}/api/matches/league/${leagueId}`;
            }
            
            if (queryString) {
                url += `?${queryString}`;
            }

            console.log(`📡 Fetching: ${url}`);

            const response = await fetch(url);
            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Failed to fetch matches');
            }

            setMatches(data.matches || []);
            setGrouped(data.grouped || []);
            setLastUpdated(new Date());
            setServerStatus({ connected: true });

            console.log(`✅ Fetched ${data.count} matches`);

        } catch (err) {
            console.error('❌ Fetch error:', err);
            setError(err.message);
            setServerStatus({ connected: false });
        } finally {
            setLoading(false);
        }
    }, [liveOnly, date, leagueId]);

    /**
     * Check server health
     */
    const checkHealth = useCallback(async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/health`);
            const data = await response.json();
            
            setServerStatus({
                connected: data.status === 'ok',
                quota: data.apiFootball?.quota
            });

            return data;
        } catch (err) {
            setServerStatus({ connected: false });
            return null;
        }
    }, []);

    /**
     * Manual refresh
     */
    const refresh = useCallback(() => {
        fetchMatches(false);
    }, [fetchMatches]);

    // Auto fetch on mount
    useEffect(() => {
        if (autoFetch) {
            fetchMatches();
        }
    }, [autoFetch, fetchMatches]);

    // Setup auto refresh interval
    useEffect(() => {
        if (refreshInterval > 0) {
            intervalRef.current = setInterval(() => {
                fetchMatches(true);
            }, refreshInterval);
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [refreshInterval, fetchMatches]);

    return {
        matches,
        grouped,
        loading,
        error,
        lastUpdated,
        serverStatus,
        refresh,
        checkHealth
    };
};

/**
 * Hook untuk fetch live matches only
 */
export const useLiveMatches = (refreshInterval = 30000) => {
    return useLivescore({
        autoFetch: true,
        refreshInterval,
        liveOnly: true
    });
};

/**
 * Hook untuk fetch match detail
 */
export const useMatchDetail = (matchId, options = {}) => {
    const { includeStats = false, includeEvents = false, includeLineups = false } = options;

    const [match, setMatch] = useState(null);
    const [statistics, setStatistics] = useState(null);
    const [events, setEvents] = useState(null);
    const [lineups, setLineups] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchMatch = useCallback(async () => {
        if (!matchId) return;

        try {
            setLoading(true);
            setError(null);

            const params = new URLSearchParams();
            if (includeStats) params.set('stats', 'true');
            if (includeEvents) params.set('events', 'true');
            if (includeLineups) params.set('lineups', 'true');

            const queryString = params.toString();
            const url = `${API_BASE_URL}/api/matches/${matchId}${queryString ? `?${queryString}` : ''}`;

            const response = await fetch(url);
            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Failed to fetch match');
            }

            setMatch(data.match);
            if (data.statistics) setStatistics(data.statistics);
            if (data.events) setEvents(data.events);
            if (data.lineups) setLineups(data.lineups);

        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [matchId, includeStats, includeEvents, includeLineups]);

    useEffect(() => {
        fetchMatch();
    }, [fetchMatch]);

    return {
        match,
        statistics,
        events,
        lineups,
        loading,
        error,
        refresh: fetchMatch
    };
};

/**
 * Hook untuk fetch leagues
 */
export const useLeagues = (popularOnly = true) => {
    const [leagues, setLeagues] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchLeagues = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const url = popularOnly 
                ? `${API_BASE_URL}/api/leagues/popular`
                : `${API_BASE_URL}/api/leagues`;

            const response = await fetch(url);
            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Failed to fetch leagues');
            }

            setLeagues(data.leagues || []);

        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [popularOnly]);

    useEffect(() => {
        fetchLeagues();
    }, [fetchLeagues]);

    return {
        leagues,
        loading,
        error,
        refresh: fetchLeagues
    };
};

export default useLivescore;
