const cron = require('node-cron');
const matchSync = require('../services/matchSync');
const apiFootball = require('../services/apiFootball');
const gradingService = require('../services/gradingService');
const { supabase } = require('../config/database');

let isLiveSyncRunning = false;
let isDailySyncRunning = false;
let isGradingRunning = false;
let isCleanupRunning = false;

/**
 * Sync live matches setiap 1 menit
 * Ini buat update skor real-time
 */
const startLiveSync = () => {
    // Setiap 1 menit
    cron.schedule('*/1 * * * *', async () => {
        if (isLiveSyncRunning) {
            console.log('⏳ Live sync already running, skipping...');
            return;
        }

        isLiveSyncRunning = true;
        console.log(`\n⚡ [${new Date().toLocaleTimeString()}] Running live sync...`);

        try {
            const result = await matchSync.syncLiveMatches();

            if (result.success) {
                console.log(`✅ Live sync complete: ${result.liveCount} live matches`);
            } else {
                console.error('❌ Live sync failed:', result.error);
            }
        } catch (error) {
            console.error('❌ Live sync error:', error.message);
        } finally {
            isLiveSyncRunning = false;
        }
    });

    console.log('🔄 Live sync cron started (every 1 minute)');
};

/**
 * Sync semua matches hari ini setiap 15 menit
 * Ini buat catch new matches atau status changes
 */
const startDailySync = () => {
    // Setiap 15 menit
    cron.schedule('*/15 * * * *', async () => {
        if (isDailySyncRunning) {
            console.log('⏳ Daily sync already running, skipping...');
            return;
        }

        isDailySyncRunning = true;
        console.log(`\n📅 [${new Date().toLocaleTimeString()}] Running daily sync...`);

        try {
            const result = await matchSync.syncTodayMatches();

            if (result.success) {
                console.log(`✅ Daily sync complete: ${result.fetched} matches`);
            } else {
                console.error('❌ Daily sync failed:', result.error);
            }
        } catch (error) {
            console.error('❌ Daily sync error:', error.message);
        } finally {
            isDailySyncRunning = false;
        }
    });

    console.log('📅 Daily sync cron started (every 15 minutes)');
};

/**
 * Auto grading setiap 2 menit
 * Check match yang sudah FT dan grade predictions
 */
const startAutoGrading = () => {
    // Setiap 2 menit
    cron.schedule('*/2 * * * *', async () => {
        if (isGradingRunning) {
            console.log('⏳ Grading already running, skipping...');
            return;
        }

        isGradingRunning = true;
        console.log(`\n🎯 [${new Date().toLocaleTimeString()}] Running auto grading...`);

        try {
            const result = await gradingService.gradeAllPendingPredictions();

            if (result.success) {
                if (result.graded > 0) {
                    console.log(`✅ Grading complete: ${result.graded} predictions graded, ${result.correct} correct`);
                }
            } else {
                console.error('❌ Grading failed:', result.error);
            }
        } catch (error) {
            console.error('❌ Grading error:', error.message);
        } finally {
            isGradingRunning = false;
        }
    });

    console.log('🎯 Auto grading cron started (every 2 minutes)');
};

/**
 * Check API quota setiap jam
 */
const startQuotaCheck = () => {
    cron.schedule('0 * * * *', async () => {
        console.log('\n📊 Checking API quota...');

        try {
            const status = await apiFootball.getApiStatus();

            if (status.success) {
                const account = status.data.account;
                const subscription = status.data.subscription;
                const requests = status.data.requests;

                console.log('📊 API Status:');
                console.log(`   Account: ${account.firstname} ${account.lastname}`);
                console.log(`   Plan: ${subscription.plan}`);
                console.log(`   Requests today: ${requests.current}/${requests.limit_day}`);

                // Warning jika mendekati limit
                const usagePercent = (requests.current / requests.limit_day) * 100;
                if (usagePercent > 80) {
                    console.warn(`⚠️  WARNING: API usage at ${usagePercent.toFixed(1)}%`);
                }
            }
        } catch (error) {
            console.error('❌ Quota check error:', error.message);
        }
    });

    console.log('📊 Quota check cron started (every hour)');
};

/**
 * Auto cleanup matches older than 30 days
 * Runs daily at 3:00 AM
 */
const startAutoCleanup = () => {
    // Setiap hari jam 3 pagi
    cron.schedule('0 3 * * *', async () => {
        if (isCleanupRunning) {
            console.log('⏳ Cleanup already running, skipping...');
            return;
        }

        isCleanupRunning = true;
        console.log(`\n🗑️ [${new Date().toLocaleTimeString()}] Running auto cleanup...`);

        try {
            const result = await cleanupOldMatches(30); // 30 days

            if (result.success) {
                console.log(`✅ Cleanup complete: ${result.deleted} old matches deleted`);
            } else {
                console.error('❌ Cleanup failed:', result.error);
            }
        } catch (error) {
            console.error('❌ Cleanup error:', error.message);
        } finally {
            isCleanupRunning = false;
        }
    });

    console.log('🗑️ Auto cleanup cron started (daily at 3:00 AM)');
};

/**
 * Delete matches older than X days
 * @param {number} days - Number of days to keep
 */
const cleanupOldMatches = async (days = 30) => {
    try {
        if (!supabase) {
            return { success: false, error: 'Database not configured' };
        }

        // Calculate cutoff date
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        const cutoffISO = cutoffDate.toISOString();

        console.log(`🗑️ Deleting matches older than ${days} days (before ${cutoffISO.split('T')[0]})`);

        // First, count how many will be deleted
        const { count: toDeleteCount, error: countError } = await supabase
            .from('matches')
            .select('*', { count: 'exact', head: true })
            .lt('date', cutoffISO)
            .in('status_short', ['FT', 'AET', 'PEN', 'AWD', 'WO', 'CANC', 'ABD', 'PST']);

        if (countError) {
            console.error('❌ Count error:', countError);
            return { success: false, error: countError.message };
        }

        console.log(`📊 Found ${toDeleteCount || 0} matches to delete`);

        if (toDeleteCount === 0) {
            return { success: true, deleted: 0, message: 'No old matches to delete' };
        }

        // Delete old finished matches
        const { error: deleteError } = await supabase
            .from('matches')
            .delete()
            .lt('date', cutoffISO)
            .in('status_short', ['FT', 'AET', 'PEN', 'AWD', 'WO', 'CANC', 'ABD', 'PST']);

        if (deleteError) {
            console.error('❌ Delete error:', deleteError);
            return { success: false, error: deleteError.message };
        }

        console.log(`✅ Successfully deleted ${toDeleteCount} old matches`);

        return {
            success: true,
            deleted: toDeleteCount,
            cutoffDate: cutoffISO.split('T')[0]
        };

    } catch (error) {
        console.error('❌ Cleanup error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Start all cron jobs
 */
const startAllJobs = () => {
    console.log('\n🚀 Starting cron jobs...\n');

    startLiveSync();
    startDailySync();
    startAutoGrading();
    startQuotaCheck();
    startAutoCleanup();  // NEW: Auto cleanup old matches

    console.log('\n✅ All cron jobs started!\n');
};

/**
 * Manual trigger untuk initial sync
 */
const runInitialSync = async () => {
    console.log('\n🔄 Running initial sync...\n');

    try {
        const result = await matchSync.syncTodayMatches();

        if (result.success) {
            console.log(`✅ Initial sync complete: ${result.fetched} matches loaded\n`);
            return result;
        } else {
            console.error('❌ Initial sync failed:', result.error);
            return result;
        }
    } catch (error) {
        console.error('❌ Initial sync error:', error.message);
        return { success: false, error: error.message };
    }
};

/**
 * Manual trigger untuk grading (bisa dipanggil dari endpoint)
 */
const runManualGrading = async () => {
    console.log('\n🎯 Running manual grading...\n');

    try {
        const result = await gradingService.gradeAllPendingPredictions();
        return result;
    } catch (error) {
        console.error('❌ Manual grading error:', error.message);
        return { success: false, error: error.message };
    }
};

module.exports = {
    startAllJobs,
    startLiveSync,
    startDailySync,
    startAutoGrading,
    startQuotaCheck,
    startAutoCleanup,
    runInitialSync,
    runManualGrading,
    cleanupOldMatches  // Export for manual trigger
};
