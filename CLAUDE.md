# blindside

Couples game — both partners answer same questions blindly, then reveal together.

**Live**: https://blindside.to
**API Backend**: https://api.rome.markets

## Tech Stack

- **Frontend**: Vanilla JS, HTML5, CSS3 (no framework)
- **Hosting**: Cloudflare Pages + Workers + D1 (SQLite)
- **Backend API**: External at api.rome.markets
- **Blog**: Auto-generated via Claude API (scripts/generate-blog.js)
- **i18n**: 3 languages (en, tr, th) — all in lang.js

## Project Structure

```
app.js              # Main SPA logic (screens, sessions, auth, quiz flow)
index.html          # Landing page + SPA shell
lang.js             # i18n translations + language switching
t.js                # First-party analytics (sendBeacon)
packs.js            # Pack metadata loader with static fallback
style.css           # Global styles
css/                # Modular CSS (base, animations, components, packs, quiz, reveal, home, seo)
functions/          # Cloudflare Worker functions
  _middleware.js    # OG tag injection for social sharing
  api/packs.js     # GET /api/packs (from D1, fallback to static)
  api/questions.js  # GET /api/questions?pack=X&lang=Y
db/                 # D1 schema + seed scripts
  schema.sql        # 6 tables: packs, categories, collections, collection_packs, questions, (results implied)
  seed.js           # Generates seed.sql from data/
  seed.sql          # Generated SQL inserts
data/               # Question content
  packs.json        # Pack definitions (metadata, categories, collections)
  en/ tr/ th/       # Questions per language (JSON files per pack)
  en/results/       # Solo quiz result definitions
scripts/            # Automation
  generate-blog.js  # Claude API blog generation
  add-topic.js      # Add blog topics to queue
  topics.json       # Blog topic queue
blog/               # Generated blog articles
analytics/          # Analytics dashboard
```

## Key Patterns

### API Calls (Frontend → Backend)
All backend calls go to `https://api.rome.markets/api/blind/...`:
- Auth: `/auth`, `/auth/check`, `/auth/guest`, `/auth/upgrade`
- Sessions: `/sessions` (CRUD), `/sessions/{code}/join`, `/sessions/{code}/answers`, `/sessions/{code}/results`
- Analytics: `/api/analytics/collect`

### Cloudflare Worker API (D1)
- `GET /api/packs` — pack metadata with 5min cache, static fallback
- `GET /api/questions?pack=X&lang=Y` — questions with language fallback to en

### D1 Database
- Binding: `DB`, database: `blindside`
- Tables: packs, categories, collections, collection_packs, questions
- Seeded from `data/` via `db/seed.js`

### i18n
- All translations in `lang.js` → `i18n.translations` object
- Keys follow `feature_action` pattern (e.g., `pack_couples`, `home_all`)
- `i18n.t('key', {placeholder: value})` for lookups
- Language stored in localStorage

### Theme System
- Light/dark mode + 6 accent colors
- CSS variables in `css/base.css`
- Stored in localStorage

### Game Modes
- **Partner**: Both players answer, compare results (couples, friends, coworkers)
- **Solo**: Single player quizzes (attachment, love language, etc.)
- **Blind Guess**: Answer + predict partner's answer

### Question Formats
- `bubble` (multi-select), `vs` (head-to-head), `swipe`, `blindguess`, default (single choice)

## Commands

```bash
# Seed database
node db/seed.js              # Generates seed.sql from data/
wrangler d1 execute blindside --file=db/seed.sql

# Generate blog articles
node scripts/generate-blog.js

# Add blog topic
node scripts/add-topic.js

# Deploy
wrangler pages deploy .
```

## Rules

- No build step — everything is plain JS/HTML/CSS served directly
- Static fallbacks exist for all D1 queries (data/ directory)
- Blog generation uses Claude Sonnet API — needs ANTHROPIC_API_KEY env var
- OG tags for social sharing are injected by _middleware.js for bot user agents
- Analytics respects doNotTrack
