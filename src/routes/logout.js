// routes/logout.js
// Endpoint untuk clear active_sessions tanpa perlu auth
// Pake service_role key jadi gak kena RLS

const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

// Supabase admin client dengan service_role key
const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// POST /api/logout
// Body: { email: "user@email.com" }
router.post('/', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ 
                success: false, 
                error: 'Email is required' 
            });
        }

        console.log('🚪 Clearing session for:', email);

        // Delete dari active_sessions pake service_role (bypass RLS)
        const { error } = await supabaseAdmin
            .from('active_sessions')
            .delete()
            .eq('account_email', email.toLowerCase());

        if (error) {
            console.error('❌ Error clearing session:', error);
            return res.status(500).json({ 
                success: false, 
                error: error.message 
            });
        }

        console.log('✅ Session cleared for:', email);

        return res.json({ 
            success: true, 
            message: 'Session cleared successfully' 
        });

    } catch (error) {
        console.error('💥 Logout API error:', error);
        return res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

module.exports = router;
