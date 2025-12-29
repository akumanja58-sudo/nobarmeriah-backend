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
        
        console.log(`📺 [Streaming] Fetching ${category} matches from SportSRC...`);
        
        const response = await fetch(`${SPORTSRC_BASE_URL}/2/data-matches&category=${category}`);
        
        if (!response.ok) {
            throw new Error(`SportSRC API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        console.log(`📺 [Streaming] Found ${data?.length || 0} matches`);
        
        res.json({
            success: true,
            data: data,
            source: 'sportsrc'
        });
        
    } catch (error) {
        console.error('❌ [Streaming] Error fetching matches:', error.message);
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
        
        console.log(`📺 [Streaming] Searching stream for: ${home} vs ${away}`);
        
        // Fetch all matches
        const response = await fetch(`${SPORTSRC_BASE_URL}/2/data-matches&category=${category}`);
        
        if (!response.ok) {
            throw new Error(`SportSRC API error: ${response.status}`);
        }
        
        const matches = await response.json();
        
        if (!matches || !Array.isArray(matches)) {
            return res.json({
                success: false,
                error: 'No matches available'
            });
        }
        
        // Fuzzy search for matching teams
        const normalizeTeamName = (name) => {
            return name
                .toLowerCase()
                .replace(/fc|cf|sc|ac|afc|united|city|town|rovers|wanderers/gi, '')
                .replace(/[^a-z0-9]/g, '')
                .trim();
        };
        
        const homeNorm = normalizeTeamName(home);
        const awayNorm = normalizeTeamName(away);
        
        // Calculate similarity score
        const calculateSimilarity = (str1, str2) => {
            const longer = str1.length > str2.length ? str1 : str2;
            const shorter = str1.length > str2.length ? str2 : str1;
            
            if (longer.length === 0) return 1.0;
            if (longer.includes(shorter) || shorter.includes(longer)) return 0.9;
            
            let matches = 0;
            for (let i = 0; i < shorter.length; i++) {
                if (longer.includes(shorter[i])) matches++;
            }
            return matches / longer.length;
        };
        
        // Find best match
        let bestMatch = null;
        let bestScore = 0;
        
        for (const match of matches) {
            const matchHome = normalizeTeamName(match.title?.split(' vs ')?.[0] || match.home || '');
            const matchAway = normalizeTeamName(match.title?.split(' vs ')?.[1] || match.away || '');
            
            const homeScore = Math.max(
                calculateSimilarity(homeNorm, matchHome),
                calculateSimilarity(homeNorm, matchAway)
            );
            const awayScore = Math.max(
                calculateSimilarity(awayNorm, matchHome),
                calculateSimilarity(awayNorm, matchAway)
            );
            
            const totalScore = (homeScore + awayScore) / 2;
            
            if (totalScore > bestScore && totalScore >= 0.5) {
                bestScore = totalScore;
                bestMatch = match;
            }
        }
        
        if (bestMatch && bestScore >= 0.6) {
            console.log(`📺 [Streaming] Found match: ${bestMatch.title} (score: ${bestScore.toFixed(2)})`);
            
            // Get stream details
            const streamResponse = await fetch(`${SPORTSRC_BASE_URL}/2/stream-links/${bestMatch.id}`);
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
            console.log(`📺 [Streaming] No match found for: ${home} vs ${away}`);
            res.json({
                success: false,
                error: 'No matching stream found'
            });
        }
        
    } catch (error) {
        console.error('❌ [Streaming] Search error:', error.message);
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
        
        console.log(`📺 [Streaming] Fetching stream details for match: ${matchId}`);
        
        const response = await fetch(`${SPORTSRC_BASE_URL}/2/stream-links/${matchId}`);
        
        if (!response.ok) {
            throw new Error(`SportSRC API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        res.json({
            success: true,
            data: data
        });
        
    } catch (error) {
        console.error('❌ [Streaming] Error fetching stream details:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
