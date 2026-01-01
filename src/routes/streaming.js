const express = require('express');
const router = express.Router();

const SPORTSRC_BASE_URL = 'https://api.sportsrc.org';

/**
 * GET /api/streaming/matches
 * Get available matches from SportSRC
 */
router.get('/matches', async (req, res) => {
    try {
        const { category = 'football' } = req.query;

        console.log(`[Streaming] Fetching ${category} matches from SportSRC...`);

        // Fixed URL: /?data=matches&category=football
        const response = await fetch(`${SPORTSRC_BASE_URL}/?data=matches&category=${category}`);

        if (!response.ok) {
            throw new Error(`SportSRC API error: ${response.status}`);
        }

        const data = await response.json();

        console.log(`[Streaming] Found ${data?.length || 0} matches`);

        res.json({
            success: true,
            data: data,
            source: 'sportsrc'
        });

    } catch (error) {
        console.error('[Streaming] Error fetching matches:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/streaming/search
 * Search for a specific match stream
 */
router.get('/search', async (req, res) => {
    try {
        const { home, away, category = 'football' } = req.query;

        if (!home || !away) {
            return res.status(400).json({
                success: false,
                error: 'Missing home or away team parameter'
            });
        }

        console.log(`[Streaming] Searching stream for: ${home} vs ${away}`);

        // Fixed URL: /?data=matches&category=football
        const response = await fetch(`${SPORTSRC_BASE_URL}/?data=matches&category=${category}`);

        if (!response.ok) {
            throw new Error(`SportSRC API error: ${response.status}`);
        }

        const responseData = await response.json();

        // Handle nested response structure from SportSRC
        // Could be: { data: [...] } or { success: true, data: [...] } or just [...]
        let matches = responseData;
        if (responseData?.data?.data && Array.isArray(responseData.data.data)) {
            matches = responseData.data.data;
        } else if (responseData?.data && Array.isArray(responseData.data)) {
            matches = responseData.data;
        } else if (!Array.isArray(matches)) {
            matches = [];
        }

        if (!matches || matches.length === 0) {
            return res.json({
                success: false,
                error: 'No matches available'
            });
        }

        console.log(`[Streaming] Found ${matches.length} matches to search`);

        // Fuzzy search for matching teams
        const normalizeTeamName = (name) => {
            if (!name) return '';
            return name
                .toLowerCase()
                // Remove common suffixes/prefixes
                .replace(/\b(fc|cf|sc|ac|afc|united|utd|city|town|rovers|wanderers|sporting|athletic|club|de|la|el)\b/gi, '')
                .replace(/[^a-z0-9\s]/g, '')
                .replace(/\s+/g, ' ')
                .trim();
        };

        const homeNorm = normalizeTeamName(home);
        const awayNorm = normalizeTeamName(away);

        console.log(`[Streaming] Normalized search: "${homeNorm}" vs "${awayNorm}"`);

        // Calculate similarity score - improved algorithm
        const calculateSimilarity = (str1, str2) => {
            if (!str1 || !str2) return 0;

            const s1 = str1.toLowerCase().trim();
            const s2 = str2.toLowerCase().trim();

            // Exact match
            if (s1 === s2) return 1.0;

            // One contains the other (e.g., "Auckland" in "Auckland FC")
            if (s1.includes(s2) || s2.includes(s1)) return 0.95;

            // Word-based matching
            const words1 = s1.split(/\s+/);
            const words2 = s2.split(/\s+/);

            // Check if main word matches (first significant word)
            if (words1[0] === words2[0] && words1[0].length > 2) return 0.9;

            // Count matching words
            let matchingWords = 0;
            for (const w1 of words1) {
                if (w1.length < 3) continue;
                for (const w2 of words2) {
                    if (w2.length < 3) continue;
                    if (w1 === w2 || w1.includes(w2) || w2.includes(w1)) {
                        matchingWords++;
                        break;
                    }
                }
            }

            const maxWords = Math.max(words1.length, words2.length);
            if (matchingWords > 0) {
                return 0.6 + (matchingWords / maxWords) * 0.3;
            }

            // Character-based fallback
            let matches = 0;
            const longer = s1.length > s2.length ? s1 : s2;
            const shorter = s1.length > s2.length ? s2 : s1;

            for (let i = 0; i < shorter.length; i++) {
                if (longer.includes(shorter[i])) matches++;
            }

            return (matches / longer.length) * 0.5;
        };

        // Find best match
        let bestMatch = null;
        let bestScore = 0;

        for (const match of matches) {
            // SportSRC format: teams.home.name, teams.away.name
            const matchHomeRaw = match.teams?.home?.name ||
                match.title?.split(' vs ')?.[0] ||
                match.title?.split(' - ')?.[0] ||
                match.home ||
                '';
            const matchAwayRaw = match.teams?.away?.name ||
                match.title?.split(' vs ')?.[1] ||
                match.title?.split(' - ')?.[1] ||
                match.away ||
                '';

            const matchHome = normalizeTeamName(matchHomeRaw);
            const matchAway = normalizeTeamName(matchAwayRaw);

            // Calculate scores both ways (in case home/away are swapped)
            const homeVsHome = calculateSimilarity(homeNorm, matchHome);
            const awayVsAway = calculateSimilarity(awayNorm, matchAway);
            const homeVsAway = calculateSimilarity(homeNorm, matchAway);
            const awayVsHome = calculateSimilarity(awayNorm, matchHome);

            // Normal order
            const normalScore = (homeVsHome + awayVsAway) / 2;
            // Swapped order
            const swappedScore = (homeVsAway + awayVsHome) / 2;

            const totalScore = Math.max(normalScore, swappedScore);

            if (totalScore > bestScore) {
                bestScore = totalScore;
                bestMatch = match;
                console.log(`[Streaming] Candidate: "${matchHomeRaw}" vs "${matchAwayRaw}" = ${totalScore.toFixed(2)}`);
            }
        }

        // Lower threshold to 0.5 for more matches
        if (bestMatch && bestScore >= 0.5) {
            console.log(`[Streaming] Found match: ${bestMatch.title || bestMatch.id} (score: ${bestScore.toFixed(2)})`);

            // Get stream details - Fixed URL: /?data=detail&category=football&id=xxx
            const streamResponse = await fetch(
                `${SPORTSRC_BASE_URL}/?data=detail&category=${category}&id=${bestMatch.id}`
            );
            let streamData = null;

            if (streamResponse.ok) {
                streamData = await streamResponse.json();
            }

            res.json({
                success: true,
                match: bestMatch,
                stream: streamData,
                confidence: bestScore
            });
        } else {
            console.log(`[Streaming] No match found for: ${home} vs ${away}`);
            res.json({
                success: false,
                error: 'No matching stream found'
            });
        }

    } catch (error) {
        console.error('[Streaming] Search error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/streaming/details/:matchId
 * Get stream details for a specific match
 */
router.get('/details/:matchId', async (req, res) => {
    try {
        const { matchId } = req.params;
        const { category = 'football' } = req.query;

        console.log(`[Streaming] Fetching stream details for match: ${matchId}`);

        // Fixed URL: /?data=detail&category=football&id=xxx
        const response = await fetch(
            `${SPORTSRC_BASE_URL}/?data=detail&category=${category}&id=${matchId}`
        );

        if (!response.ok) {
            throw new Error(`SportSRC API error: ${response.status}`);
        }

        const data = await response.json();

        res.json({
            success: true,
            data: data
        });

    } catch (error) {
        console.error('[Streaming] Error fetching stream details:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
