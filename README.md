# ☾ Nur Search — Quran & Sunnah Search Engine

A modern, responsive, **frontend-only** Quran and Sunnah search engine designed to run on **GitHub Pages**.

Nur Search combines a calm Islamic visual experience with a source-first search workflow. It can search the Quran through a public Quran API, search a public Hadith dataset directly in the browser, discover general web material, and optionally use browser-side AI embeddings for semantic ranking.

> **Important:** This project is an educational/portfolio frontend. It is not a fatwa service and the AI/search layer must not be treated as an authority. Always verify religious material against the cited primary source and qualified scholarship where appropriate.

---

## Features

### Search

- Quran keyword search
- Hadith keyword search
- Live general web discovery
- All / Quran / Hadith / Web filters
- Smart/hybrid search mode
- Optional semantic AI ranking
- Search history stored locally
- Loading and error states
- Source links on every result

### Quran

- Live Quran search using Al Quran Cloud
- Surah and ayah reference display
- Arabic text when supplied by the API
- Direct source links

### Sunnah / Hadith

- Browser-side Hadith search
- Sahih al-Bukhari dataset loaded on demand
- Dataset delivered through jsDelivr from the open hadith-api project
- No private API key required by this frontend

### AI

- Optional Transformers.js browser inference
- `Xenova/all-MiniLM-L6-v2` sentence embeddings
- Semantic similarity ranking
- AI is used for discovery/ranking, not presented as religious authority

### UX

- Islamic-inspired emerald / midnight / gold design
- Subtle geometric pattern
- Ambient stars and glow
- Dark and light themes
- Responsive desktop/tablet/mobile layouts
- Arabic-friendly RTL result styling
- Accessible reduced-motion support
- Bookmark results with localStorage
- Copy citations
- Mobile navigation

### GitHub Pages

- Vite static build
- GitHub Actions deployment
- No application backend
- No database
- No server-side API routes
- No secret API keys

---

# Architecture

```text
                         USER
                           |
                           v
                  +------------------+
                  | React + Vite UI  |
                  +--------+---------+
                           |
             +-------------+-------------+
             |             |             |
             v             v             v
       Quran Search    Hadith Search   Web Search
             |             |             |
             v             v             v
       Al Quran Cloud   jsDelivr       Wikipedia
          REST API      Hadith JSON       API
             |             |             |
             +-------------+-------------+
                           |
                           v
                    Result Normalizer
                           |
                           v
                   Hybrid / AI Ranking
                           |
                           v
                  Source-first UI cards
```

### Browser AI architecture

```text
Search query
     |
     v
Transformers.js
     |
     v
Sentence embedding
     |
     v
Similarity comparison
     |
     v
Ranked search candidates
```

The model is downloaded on demand by the browser. The first AI search can therefore take longer and use more memory than a normal keyword search.

### Deployment architecture

```text
Developer
   |
   | git push
   v
GitHub Repository
   |
   v
GitHub Actions
   |
   | npm run build
   v
Vite /dist
   |
   v
GitHub Pages
   |
   v
Public website
```

---

# Technologies

| Technology | Purpose |
|---|---|
| React | UI application |
| Vite | Frontend build tool |
| JavaScript | Application logic |
| CSS | Responsive Islamic visual system |
| Lucide React | UI icons |
| Transformers.js | Browser-side AI embeddings |
| Hugging Face model | Semantic text representation |
| Al Quran Cloud API | Live Quran search |
| Fawaz Hadith API dataset | Browser-side Hadith data |
| Wikipedia API | Live general web discovery |
| localStorage | Bookmarks, theme and history |
| GitHub Actions | Automatic deployment |
| GitHub Pages | Static hosting |

---

# Project structure

```text
quran-sunnah-search/
├── .github/
│   └── workflows/
│       └── deploy.yml
├── public/
├── src/
│   ├── data/
│   │   └── topics.js
│   ├── services/
│   │   ├── api.js
│   │   └── semantic.js
│   ├── App.jsx
│   ├── main.jsx
│   └── styles.css
├── .gitignore
├── index.html
├── package.json
├── vite.config.js
└── README.md
```

---

# Run locally

Requirements:

- Node.js 20+
- npm
- Git

Install dependencies:

```bash
npm install
```

Start development server:

```bash
npm run dev
```

Build production files:

```bash
npm run build
```

Preview production build:

```bash
npm run preview
```

---

# Deploy to GitHub Pages

1. Create a new GitHub repository.
2. Put all project files in the repository.
3. Use the `main` branch.
4. Push the project:

```bash
git init
git add .
git commit -m "Initial Nur Search frontend"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
git push -u origin main
```

5. Open:

```text
Repository
→ Settings
→ Pages
```

6. Under **Build and deployment**, select **GitHub Actions**.

7. Push to `main` again if necessary.

The included workflow builds the Vite application and publishes `dist/` to GitHub Pages.

Your website will normally be available at:

```text
https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/
```

---

# Data sources

## Quran

The application uses the Al Quran Cloud REST API for live Quran keyword search.

Documentation:

https://alquran.cloud/api

Project:

https://alquran.cloud/

## Hadith

The frontend loads the English Bukhari edition from the Fawaz Hadith API project through jsDelivr.

Project:

https://github.com/fawazahmed0/hadith-api

The project supports multiple editions and languages. This application currently loads Bukhari on demand to keep the initial page smaller.

## Web discovery

The application uses the Wikipedia MediaWiki API for general live web discovery.

This is deliberately displayed as **WEB** and is not mixed visually with Quran/Hadith primary-source results.

## AI

Semantic search uses Transformers.js:

https://huggingface.co/docs/transformers.js

Default model:

```text
Xenova/all-MiniLM-L6-v2
```

The model is loaded in the browser when semantic search is selected.

---

# Why there is no backend

This project was intentionally designed for GitHub Pages.

The browser performs:

```text
API request
      ↓
JSON response
      ↓
React
      ↓
Search / ranking
      ↓
UI
```

There is no:

- Express server
- Node backend
- Python backend
- PostgreSQL
- Supabase
- Serverless function
- API gateway

This makes the project simple to publish and easy to demonstrate as a portfolio project.

---

# Important frontend-only limitations

A static website cannot safely hide a private API secret.

Therefore this project does **not** put private API keys in JavaScript.

Also, a frontend-only application cannot automatically treat the entire Internet as a trusted religious knowledge base.

The application intentionally separates:

```text
QURAN
HADITH
WEB
```

and shows the source for each result.

For a future production system, a backend could provide:

- authenticated APIs
- database indexing
- large-scale vector search
- trusted-source crawling
- server-side caching
- stronger ranking
- protected API credentials

Those are deliberately outside this GitHub Pages version.

---

# Search modes

## Smart / Hybrid

The default mode combines available keyword/search results from the selected sources.

## AI Semantic

The browser creates sentence embeddings and ranks a small candidate set by semantic similarity.

Example:

```text
Query:
How can I stay patient during hardship?

Potentially related concepts:
- patience
- hardship
- perseverance
- trials
- forgiveness
```

Semantic search is intended to discover related source material. It does not generate a religious ruling.

---

# Privacy

No application account is required.

The application stores only local UI data such as:

```text
Bookmarks
Search history
Theme
```

using browser `localStorage`.

External searches are sent to the selected public services because those services are required to provide live search results.

---

# Design philosophy

Nur Search follows three principles:

### 1. Source first

The original source and reference should remain visible.

### 2. AI assists discovery

AI helps understand a query and rank related material. It should not be presented as a replacement for Quran, Hadith or qualified scholarship.

### 3. Calm interface

The interface uses:

- midnight backgrounds
- emerald tones
- restrained gold accents
- geometric Islamic-inspired patterns
- subtle stars
- readable typography
- responsive layouts

The visual design should remain respectful and readable rather than becoming an overly decorative animation.

---

# Future roadmap

## Version 1

- Quran search
- Hadith search
- Web discovery
- Responsive UI
- GitHub Pages

## Version 2

- Arabic search
- Urdu translations
- More Hadith collections
- Better source filters
- Surah browser
- Hadith collection browser

## Version 3

- Pre-computed semantic embeddings
- Faster AI search
- Topic clustering
- Related ayahs
- Related hadith

## Version 4

- Tafsir sources
- Audio recitation
- Reading mode
- Shareable verse cards
- Advanced citations

## Version 5

Potential backend version:

- PostgreSQL
- pgvector
- trusted-source indexing
- server-side RAG
- authenticated APIs
- larger semantic corpus

---

# Disclaimer

Nur Search is a software project for searching and organizing source material. Search ranking does not establish religious authenticity or legal/religious authority.

Always open and verify the cited source. For questions requiring a religious ruling, consult qualified scholars and authoritative source material.

---

## License

This repository's application code can be licensed according to your preferred open-source or portfolio license.

**Third-party data, translations, APIs, models and source content may have their own licenses and terms. Verify those terms before redistributing datasets or deploying a public commercial service.**
