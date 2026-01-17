const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

// Supabase Admin Client (dengan service_role key untuk akses penuh)
const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
);

// Supabase Regular Client (untuk operasi database biasa)
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

/**
 * DELETE /api/account/delete
 * Hapus akun user secara permanen
 * 
 * Body: { userId, email }
 */
router.delete('/delete', async (req, res) => {
    try {
        const { userId, email } = req.body;

        // Validasi input
        if (!userId || !email) {
            return res.status(400).json({
                success: false,
                error: 'userId dan email wajib diisi'
            });
        }

        console.log(`🗑️ Deleting account for user: ${email} (${userId})`);

        // 1. Delete dari profiles
        const { error: profileError } = await supabase
            .from('profiles')
            .delete()
            .eq('email', email);

        if (profileError) {
            console.error('Error deleting profile:', profileError);
            // Lanjut aja, mungkin profile udah kehapus
        } else {
            console.log('✅ Deleted from profiles');
        }

        // 2. Delete dari winner_predictions
        const { error: winnerError } = await supabase
            .from('winner_predictions')
            .delete()
            .eq('email', email);

        if (winnerError) {
            console.error('Error deleting winner_predictions:', winnerError);
        } else {
            console.log('✅ Deleted from winner_predictions');
        }

        // 3. Delete dari score_predictions
        const { error: scoreError } = await supabase
            .from('score_predictions')
            .delete()
            .eq('email', email);

        if (scoreError) {
            console.error('Error deleting score_predictions:', scoreError);
        } else {
            console.log('✅ Deleted from score_predictions');
        }

        // 4. Delete dari active_sessions
        const { error: sessionError } = await supabase
            .from('active_sessions')
            .delete()
            .eq('account_email', email.toLowerCase());

        if (sessionError) {
            console.error('Error deleting active_sessions:', sessionError);
        } else {
            console.log('✅ Deleted from active_sessions');
        }

        // 5. Delete dari auth.users (PENTING! Supaya bisa daftar lagi dengan email yang sama)
        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);

        if (authError) {
            console.error('Error deleting from auth.users:', authError);
            return res.status(500).json({
                success: false,
                error: 'Gagal menghapus akun dari sistem autentikasi',
                details: authError.message
            });
        }

        console.log('✅ Deleted from auth.users');
        console.log(`🎉 Account ${email} successfully deleted!`);

        res.json({
            success: true,
            message: 'Akun berhasil dihapus permanen'
        });

    } catch (error) {
        console.error('❌ Delete account error:', error);
        res.status(500).json({
            success: false,
            error: 'Terjadi kesalahan saat menghapus akun',
            details: error.message
        });
    }
});

/**
 * GET /api/account/check
 * Cek apakah service_role key sudah dikonfigurasi
 */
router.get('/check', (req, res) => {
    const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    res.json({
        success: true,
        serviceKeyConfigured: hasServiceKey,
        message: hasServiceKey 
            ? 'Service role key configured' 
            : 'WARNING: SUPABASE_SERVICE_ROLE_KEY not set!'
    });
});

module.exports = router;
