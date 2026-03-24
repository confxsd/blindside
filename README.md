# blindside

A free, web-based couples game where both partners answer the same questions independently — then reveal their answers together. No app download required.

**Play now**: [blindside.to](https://blindside.to)

## What is it?

blindside asks both partners the same relationship questions without seeing each other's answers. When both are done, answers are revealed side by side — sparking genuine conversations about how well you really know each other.

- 30+ question packs (couples, friends, coworkers, solo quizzes)
- 3 game modes: Partner, Solo, Blind Guess
- Available in English, Turkish, and Thai
- Works on any device with a browser

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla JavaScript, HTML5, CSS3 |
| Hosting | Cloudflare Pages |
| Serverless | Cloudflare Workers |
| Database | Cloudflare D1 (SQLite) |
| Backend API | External REST API |
| Blog | Auto-generated with Claude API |
| Analytics | First-party, privacy-respecting |

## Project Structure

```
├── app.js               # Main application logic
├── index.html           # Landing page + SPA shell
├── lang.js              # i18n system (en, tr, th)
├── t.js                 # Analytics
├── packs.js             # Pack metadata loader
├── css/                 # Modular stylesheets
├── functions/           # Cloudflare Worker functions
│   ├── _middleware.js   # OG tags for social sharing
│   └── api/             # Packs & questions endpoints
├── db/                  # D1 schema & seed scripts
├── data/                # Question packs (JSON per language)
├── scripts/             # Blog generation & automation
├── blog/                # Generated blog articles
└── analytics/           # Analytics dashboard
```

## Getting Started

### Prerequisites

- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) for Cloudflare deployment
- Node.js for running scripts

### Local Development

```bash
# Start local dev server with D1
wrangler pages dev .

# Seed the database
node db/seed.js
wrangler d1 execute blindside --file=db/seed.sql --local
```

### Deploy

```bash
wrangler pages deploy .
```

### Blog Generation

```bash
# Add a topic to the queue
node scripts/add-topic.js

# Generate articles from queue
ANTHROPIC_API_KEY=sk-... node scripts/generate-blog.js
```

## Game Modes

**Partner Mode** — Both players answer the same questions independently, then reveal answers together. Includes couples, best friends, coworkers packs and more.

**Solo Mode** — Single-player personality quizzes like Attachment Style, Love Language, Emotional Age, and Shadow Self.

**Blind Guess** — Answer a question AND predict what your partner will say. Double the stakes.

## Features

- Dark/light theme with accent color customization
- Real-time multiplayer session management
- Social sharing with dynamic OG tags
- SEO-optimized with structured data and auto-generated blog
- Privacy-respecting analytics (honors Do Not Track)
- Static fallbacks for all API endpoints

## License

All rights reserved.
