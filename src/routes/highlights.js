const express = require('express');
const router = express.Router();

// YouTube Data API v3
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || 'AIzaSyCJppC0Vb1KbsGvzVe_lM6Kivsojh9Mag0';
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

// Cache untuk hemat quota (YouTube API limit 10,000 units/day)
const highlightsCache = new Map();
const CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 jam

// Trusted channels untuk highlight (channel ID)
const TRUSTED_CHANNELS = [
    'UCGq7ov9-Xk9fkeQjeeXElkQ', // UEFA Champions League
    'UCg3R1lSZ4H7RfqF8jBMSAMA', // Premier League
    'UCG5qGWdu8nIRZqJ_GgDwQ-w', // La Liga
    'UC9lRN3hJKbFz1MRK2BUHX_w', // Bundesliga
    'UCDhEUC3htBULIW7mHLwfFqA', // beIN SPORTS
    'UCH4h9TgVIDLVQNGCO7LRlPQ', // Sky Sports
];

// ============================================================
// GET /api/highlights/search
// Search highlights berdasarkan nama tim
// Query: ?home=Arsenal&away=Chelsea&date=2026-02-10
// ============================================================
router.get('/search', async (req, res) => {
    try {
        const { home, away, date, matchId } = req.query;

        if (!home || !away) {
            return res.status(400).json({
                success: false,
                error: 'Missing required params: home, away'
            });
        }

        // Generate cache key
        const cacheKey = `${home}-${away}-${date || 'nodate'}`;
        
        // Check cache
        const cached = highlightsCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp < CACHE_DURATION)) {
            console.log('📹 Returning cached highlights for:', cacheKey);
            return res.json({
                success: true,
                source: 'cache',
                data: cached.data
            });
        }

        // Build search query
        const searchQuery = `${home} vs ${away} highlights ${date ? new Date(date).getFullYear() : new Date().getFullYear()}`;
        
        console.log('🔍 Searching YouTube highlights:', searchQuery);

        // Search YouTube
        const searchUrl = new URL(`${YOUTUBE_API_BASE}/search`);
        searchUrl.searchParams.append('part', 'snippet');
        searchUrl.searchParams.append('q', searchQuery);
        searchUrl.searchParams.append('type', 'video');
        searchUrl.searchParams.append('maxResults', '5');
        searchUrl.searchParams.append('order', 'relevance');
        searchUrl.searchParams.append('videoDuration', 'medium'); // 4-20 menit
        searchUrl.searchParams.append('key', YOUTUBE_API_KEY);

        const response = await fetch(searchUrl.toString());
        
        if (!response.ok) {
            const errorData = await response.json();
            console.error('❌ YouTube API error:', errorData);
            throw new Error(errorData.error?.message || 'YouTube API error');
        }

        const data = await response.json();

        // Parse results
        const highlights = (data.items || []).map(item => ({
            videoId: item.id.videoId,
            title: item.snippet.title,
            description: item.snippet.description,
            thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
            channelTitle: item.snippet.channelTitle,
            channelId: item.snippet.channelId,
            publishedAt: item.snippet.publishedAt,
            embedUrl: `https://www.youtube.com/embed/${item.id.videoId}`,
            watchUrl: `https://www.youtube.com/watch?v=${item.id.videoId}`,
            isTrustedChannel: TRUSTED_CHANNELS.includes(item.snippet.channelId)
        }));

        // Sort: trusted channels first
        highlights.sort((a, b) => {
            if (a.isTrustedChannel && !b.isTrustedChannel) return -1;
            if (!a.isTrustedChannel && b.isTrustedChannel) return 1;
            return 0;
        });

        // Save to cache
        highlightsCache.set(cacheKey, {
            timestamp: Date.now(),
            data: highlights
        });

        console.log(`✅ Found ${highlights.length} highlights for: ${home} vs ${away}`);

        res.json({
            success: true,
            source: 'api',
            query: searchQuery,
            data: highlights,
            total: highlights.length
        });

    } catch (error) {
        console.error('❌ Highlights search error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============================================================
// GET /api/highlights/video/:videoId
// Get detail video tertentu
// ============================================================
router.get('/video/:videoId', async (req, res) => {
    try {
        const { videoId } = req.params;

        if (!videoId) {
            return res.status(400).json({
                success: false,
                error: 'Missing videoId'
            });
        }

        const videoUrl = new URL(`${YOUTUBE_API_BASE}/videos`);
        videoUrl.searchParams.append('part', 'snippet,statistics,contentDetails');
        videoUrl.searchParams.append('id', videoId);
        videoUrl.searchParams.append('key', YOUTUBE_API_KEY);

        const response = await fetch(videoUrl.toString());
        
        if (!response.ok) {
            throw new Error('Failed to fetch video details');
        }

        const data = await response.json();

        if (!data.items || data.items.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Video not found'
            });
        }

        const video = data.items[0];
        
        res.json({
            success: true,
            data: {
                videoId: video.id,
                title: video.snippet.title,
                description: video.snippet.description,
                thumbnail: video.snippet.thumbnails?.maxres?.url || video.snippet.thumbnails?.high?.url,
                channelTitle: video.snippet.channelTitle,
                publishedAt: video.snippet.publishedAt,
                duration: video.contentDetails.duration,
                viewCount: parseInt(video.statistics.viewCount || 0),
                likeCount: parseInt(video.statistics.likeCount || 0),
                embedUrl: `https://www.youtube.com/embed/${video.id}`,
                watchUrl: `https://www.youtube.com/watch?v=${video.id}`
            }
        });

    } catch (error) {
        console.error('❌ Video detail error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============================================================
// GET /api/highlights/trending
// Get trending football highlights
// ============================================================
router.get('/trending', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;

        // Check cache
        const cacheKey = 'trending-highlights';
        const cached = highlightsCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp < CACHE_DURATION)) {
            return res.json({
                success: true,
                source: 'cache',
                data: cached.data.slice(0, limit)
            });
        }

        const searchUrl = new URL(`${YOUTUBE_API_BASE}/search`);
        searchUrl.searchParams.append('part', 'snippet');
        searchUrl.searchParams.append('q', 'football highlights goals today');
        searchUrl.searchParams.append('type', 'video');
        searchUrl.searchParams.append('maxResults', '20');
        searchUrl.searchParams.append('order', 'date');
        searchUrl.searchParams.append('publishedAfter', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()); // Last 24 hours
        searchUrl.searchParams.append('videoDuration', 'medium');
        searchUrl.searchParams.append('key', YOUTUBE_API_KEY);

        const response = await fetch(searchUrl.toString());
        
        if (!response.ok) {
            throw new Error('Failed to fetch trending highlights');
        }

        const data = await response.json();

        const highlights = (data.items || []).map(item => ({
            videoId: item.id.videoId,
            title: item.snippet.title,
            thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.medium?.url,
            channelTitle: item.snippet.channelTitle,
            publishedAt: item.snippet.publishedAt,
            embedUrl: `https://www.youtube.com/embed/${item.id.videoId}`,
            watchUrl: `https://www.youtube.com/watch?v=${item.id.videoId}`
        }));

        // Save to cache
        highlightsCache.set(cacheKey, {
            timestamp: Date.now(),
            data: highlights
        });

        res.json({
            success: true,
            source: 'api',
            data: highlights.slice(0, limit),
            total: highlights.length
        });

    } catch (error) {
        console.error('❌ Trending highlights error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============================================================
// DELETE /api/highlights/cache
// Clear cache (untuk admin)
// ============================================================
router.delete('/cache', (req, res) => {
    highlightsCache.clear();
    console.log('🗑️ Highlights cache cleared');
    res.json({
        success: true,
        message: 'Cache cleared'
    });
});

module.exports = router;
