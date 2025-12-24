# ⚽ Livescore Backend

Backend API untuk livescore menggunakan API-Football.

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd livescore-backend
npm install
```

### 2. Setup Environment

Copy `.env.example` ke `.env` dan isi credentials:

```bash
cp .env.example .env
```

Edit `.env`:
```env
API_FOOTBALL_KEY=your_api_key_here
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
PORT=3001
CORS_ORIGINS=http://localhost:5173
```

### 3. Setup Database (Optional)

Jalankan `supabase-schema.sql` di Supabase SQL Editor untuk membuat table.

### 4. Run Server

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

## 📡 API Endpoints

### Health & Status

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Server health check |
| `GET /api/status` | API-Football status & quota |

### Matches

| Endpoint | Description |
|----------|-------------|
| `GET /api/matches` | Get today's matches |
| `GET /api/matches?live=true` | Get live matches only |
| `GET /api/matches?date=2024-01-15` | Get matches by date |
| `GET /api/matches/:id` | Get match detail |
| `GET /api/matches/:id?stats=true&events=true&lineups=true` | Get match with full detail |
| `GET /api/matches/date/:date` | Get matches by date |
| `GET /api/matches/league/:leagueId` | Get matches by league |

### Leagues

| Endpoint | Description |
|----------|-------------|
| `GET /api/leagues` | Get all leagues |
| `GET /api/leagues/popular` | Get popular leagues |
| `GET /api/leagues/:id` | Get league detail |

## 📊 Response Format

### Matches Response

```json
{
  "success": true,
  "count": 45,
  "matches": [
    {
      "id": 1234567,
      "date": "2024-01-15T19:45:00+00:00",
      "status": "live",
      "status_short": "2H",
      "elapsed": 67,
      "is_live": true,
      "league_id": 39,
      "league_name": "Premier League",
      "league_country": "England",
      "league_logo": "https://...",
      "home_team_id": 33,
      "home_team_name": "Manchester United",
      "home_team_logo": "https://...",
      "away_team_id": 40,
      "away_team_name": "Liverpool",
      "away_team_logo": "https://...",
      "home_score": 2,
      "away_score": 1
    }
  ],
  "grouped": [...],
  "lastUpdated": "2024-01-15T20:30:00.000Z"
}
```

## ⏰ Cron Jobs

Backend menjalankan cron jobs otomatis:

- **Live Sync**: Setiap 1 menit - update skor live matches
- **Daily Sync**: Setiap 15 menit - sync semua matches hari ini
- **Quota Check**: Setiap jam - cek API quota

## 🎨 Frontend Integration

### React Hook

Copy `frontend/useLivescore.js` ke project React lo:

```jsx
import { useLivescore, useLiveMatches } from './hooks/useLivescore';

function MatchList() {
  const { matches, loading, error, refresh, serverStatus } = useLivescore({
    autoFetch: true,
    refreshInterval: 60000
  });

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      {matches.map(match => (
        <div key={match.id}>
          {match.home_team_name} {match.home_score} - {match.away_score} {match.away_team_name}
        </div>
      ))}
    </div>
  );
}
```

### Environment Variable

Tambah di `.env` frontend:

```env
VITE_API_BASE_URL=http://localhost:3001
```

## 📋 Popular Leagues

Backend secara default fetch liga-liga populer:

- 🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League (39)
- 🇪🇸 La Liga (140)
- 🇮🇹 Serie A (135)
- 🇩🇪 Bundesliga (78)
- 🇫🇷 Ligue 1 (61)
- 🏆 Champions League (2)
- 🏆 Europa League (3)
- 🇮🇩 Liga 1 Indonesia (274)

## 🔧 Customization

### Tambah Liga

Edit `src/services/apiFootball.js`:

```js
const POPULAR_LEAGUES = [
  39,   // Premier League
  140,  // La Liga
  // ... tambah league ID baru disini
];
```

### Ubah Refresh Interval

Edit `src/jobs/cronJobs.js`:

```js
// Live sync setiap 30 detik
cron.schedule('*/30 * * * * *', async () => {
  // ...
});
```

## 📝 License

MIT

## 🙏 Credits

- [API-Football](https://www.api-football.com/) - Football data provider
- [Supabase](https://supabase.com/) - Database
