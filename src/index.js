require('dotenv').config();

const express = require('express');
const cors = require('cors');

// Import routes
const matchesRouter = require('./routes/matches');
const leaguesRouter = require('./routes/leagues');
const standingsRouter = require('./routes/standings');
const oddsRouter = require('./routes/odds');
const streamingRouter = require('./routes/streaming');

// Import jobs
const cronJobs = require('./jobs/cronJobs');

// Import services
const apiFootball = require('./services/apiFootball');

const app = express();
const PORT = process.env.PORT || 3001;

// CORS configuration
const corsOptions = {
    origin: process.env.CORS_ORIGINS
        ? process.env.CORS_ORIGINS.split(',')
        : ['http://localhost:5173', 'http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Request logging
app.use((req, res, next) => {
    console.log(`📥 ${req.method} ${req.path}`);
    next();
});

// Health check endpoint
app.get('/health', async (req, res) => {
    const apiStatus = await apiFootball.getApiStatus();

    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        apiFootball: {
            connected: apiStatus.success,
            quota: apiStatus.success ? {
                used: apiStatus.data.requests.current,
                limit: apiStatus.data.requests.limit_day
            } : null
        }
    });
});

// API status endpoint
app.get('/api/status', async (req, res) => {
    try {
        const status = await apiFootball.getApiStatus();

        if (!status.success) {
            return res.status(500).json({
                success: false,
                error: status.error
            });
        }

        res.json({
            success: true,
            server: 'online',
            apiFootball: {
                account: status.data.account,
                subscription: status.data.subscription,
                requests: status.data.requests
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Routes
app.use('/api/matches', matchesRouter);
app.use('/api/leagues', leaguesRouter);
app.use('/api/standings', standingsRouter);
app.use('/api/odds', oddsRouter);
app.use('/api/streaming', streamingRouter);

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found'
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('❌ Error:', err);
    res.status(500).json({
        success: false,
        error: err.message
    });
});

// Start server
app.listen(PORT, async () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   ⚽  LIVESCORE BACKEND                                   ║
║                                                           ║
║   Server running on http://localhost:${PORT}                 ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
    `);

    // Check API key
    if (!process.env.API_FOOTBALL_KEY) {
        console.error('⚠️  WARNING: API_FOOTBALL_KEY not set!');
        console.log('   Please add your API key to .env file\n');
    } else {
        console.log('✅ API-Football key configured');

        // Run initial sync
        await cronJobs.runInitialSync();

        // Start cron jobs
        cronJobs.startAllJobs();
    }

    // Check Supabase
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
        console.log('⚠️  Supabase not configured - running without database caching');
    } else {
        console.log('✅ Supabase configured');
    }

    console.log('\n📡 Available endpoints:');
    console.log('   GET  /health                    - Health check');
    console.log('   GET  /api/status                - API status & quota');
    console.log('   GET  /api/matches               - Today matches');
    console.log('   GET  /api/matches?live=true     - Live matches only');
    console.log('   GET  /api/matches?date=YYYY-MM-DD');
    console.log('   GET  /api/matches/:id           - Match detail');
    console.log('   GET  /api/matches/:id?stats=true&events=true&lineups=true');
    console.log('   GET  /api/leagues               - All leagues');
    console.log('   GET  /api/leagues/popular       - Popular leagues');
    console.log('   GET  /api/leagues/:id           - League detail');
    console.log('');
});

module.exports = app;
