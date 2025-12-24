-- ============================================
-- LIVESCORE DATABASE SCHEMA
-- Jalankan di Supabase SQL Editor
-- ============================================

-- Create matches table
CREATE TABLE IF NOT EXISTS matches (
    id BIGINT PRIMARY KEY,
    
    -- Match timing
    date TIMESTAMPTZ NOT NULL,
    timestamp BIGINT,
    timezone VARCHAR(50),
    
    -- Venue
    venue VARCHAR(255),
    venue_city VARCHAR(100),
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'scheduled',
    status_short VARCHAR(10),
    status_long VARCHAR(50),
    elapsed INTEGER,
    is_live BOOLEAN DEFAULT FALSE,
    
    -- League info
    league_id INTEGER NOT NULL,
    league_name VARCHAR(100),
    league_country VARCHAR(100),
    league_logo TEXT,
    league_flag TEXT,
    league_season INTEGER,
    league_round VARCHAR(100),
    
    -- Home team
    home_team_id INTEGER NOT NULL,
    home_team_name VARCHAR(100),
    home_team_logo TEXT,
    home_team_winner BOOLEAN,
    
    -- Away team
    away_team_id INTEGER NOT NULL,
    away_team_name VARCHAR(100),
    away_team_logo TEXT,
    away_team_winner BOOLEAN,
    
    -- Current score
    home_score INTEGER,
    away_score INTEGER,
    
    -- Halftime
    ht_home INTEGER,
    ht_away INTEGER,
    
    -- Fulltime
    ft_home INTEGER,
    ft_away INTEGER,
    
    -- Extra time
    et_home INTEGER,
    et_away INTEGER,
    
    -- Penalties
    pen_home INTEGER,
    pen_away INTEGER,
    
    -- Metadata
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_matches_date ON matches(date);
CREATE INDEX IF NOT EXISTS idx_matches_league ON matches(league_id);
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);
CREATE INDEX IF NOT EXISTS idx_matches_is_live ON matches(is_live);
CREATE INDEX IF NOT EXISTS idx_matches_home_team ON matches(home_team_id);
CREATE INDEX IF NOT EXISTS idx_matches_away_team ON matches(away_team_id);

-- Create a composite index for common queries
CREATE INDEX IF NOT EXISTS idx_matches_date_league ON matches(date, league_id);

-- Enable Row Level Security (optional, tapi recommended)
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

-- Create policy untuk read access (public read)
CREATE POLICY "Allow public read" ON matches
    FOR SELECT
    USING (true);

-- Create policy untuk insert/update (anon key bisa write)
CREATE POLICY "Allow anon insert" ON matches
    FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Allow anon update" ON matches
    FOR UPDATE
    USING (true)
    WITH CHECK (true);

-- ============================================
-- OPTIONAL: Create leagues table untuk cache
-- ============================================

CREATE TABLE IF NOT EXISTS leagues (
    id INTEGER PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20),
    logo TEXT,
    country VARCHAR(100),
    country_code VARCHAR(10),
    country_flag TEXT,
    is_popular BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert popular leagues
INSERT INTO leagues (id, name, country, is_popular) VALUES
    (39, 'Premier League', 'England', true),
    (140, 'La Liga', 'Spain', true),
    (135, 'Serie A', 'Italy', true),
    (78, 'Bundesliga', 'Germany', true),
    (61, 'Ligue 1', 'France', true),
    (2, 'UEFA Champions League', 'World', true),
    (3, 'UEFA Europa League', 'World', true),
    (848, 'UEFA Conference League', 'World', true),
    (88, 'Eredivisie', 'Netherlands', true),
    (94, 'Primeira Liga', 'Portugal', true),
    (274, 'Liga 1', 'Indonesia', true),
    (262, 'Liga 2', 'Indonesia', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS for leagues
ALTER TABLE leagues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read leagues" ON leagues
    FOR SELECT
    USING (true);

-- ============================================
-- USEFUL QUERIES
-- ============================================

-- Get today's matches
-- SELECT * FROM matches WHERE date::date = CURRENT_DATE ORDER BY date;

-- Get live matches
-- SELECT * FROM matches WHERE is_live = true;

-- Get matches by league
-- SELECT * FROM matches WHERE league_id = 39 AND date::date = CURRENT_DATE;

-- Get matches grouped by league
-- SELECT league_name, COUNT(*) FROM matches WHERE date::date = CURRENT_DATE GROUP BY league_name;
