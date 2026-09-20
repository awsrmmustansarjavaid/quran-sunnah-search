# Nur Search — Architecture Notes

## 1. Frontend architecture

```text
React
  |
  +-- App.jsx
  |     |
  |     +-- SearchBox
  |     +-- ResultCard
  |     +-- TopicCard
  |     +-- SourceBox
  |
  +-- services/
  |     +-- api.js
  |     +-- semantic.js
  |
  +-- data/
        +-- topics.js
```

The UI layer does not directly know the details of each external API. `services/api.js` normalizes external responses into a common result structure.

## 2. Result contract

All sources are converted to a similar object:

```js
{
  id: "unique-id",
  type: "quran | hadith | web",
  reference: "source reference",
  title: "display title",
  subtitle: "secondary information",
  text: "searchable/display text",
  source: "source name",
  sourceUrl: "source URL",
  score: 0
}
```

This makes it possible for one React result card to display multiple source types.

## 3. Search pipeline

```text
User query
   |
   v
Filter selection
   |
   +---- Quran -> Al Quran Cloud
   |
   +---- Hadith -> jsDelivr dataset -> browser search
   |
   +---- Web -> Wikipedia API
   |
   v
Normalized results
   |
   +---- Smart mode -> source/search ordering
   |
   +---- Semantic mode -> Transformers.js
   |
   v
Result cards
```

## 4. Browser AI

The model is loaded lazily.

That means the home page does not immediately download the AI model.

Only when semantic ranking is requested does the application import Transformers.js and load:

```text
Xenova/all-MiniLM-L6-v2
```

For a larger corpus, pre-compute embeddings during a build process and ship those vectors as static assets instead of embedding every candidate at query time.

## 5. Storage

`localStorage` stores:

```text
nur-theme
nur-bookmarks
nur-history
```

No personal information is intentionally sent to an application server because there is no application server.

## 6. Deployment

GitHub Actions performs:

```text
checkout
   ↓
setup Node
   ↓
npm ci
   ↓
npm run build
   ↓
upload dist
   ↓
deploy GitHub Pages
```

The repository name is passed as `VITE_BASE_PATH` so project-page routing works correctly.

## 7. Security model

Never put private credentials into:

```text
src/
public/
.env committed to Git
```

Anything shipped to a browser is visible to users.

If an external service requires a secret API key, use a backend or a serverless function in a future architecture.

## 8. Source separation

The interface intentionally uses separate result types:

```text
QURAN
HADITH
WEB
```

This prevents a general web result from visually appearing to be scripture or a hadith.

## 9. Scaling path

The static version is appropriate for a portfolio/MVP.

A larger production architecture could evolve into:

```text
React frontend
      |
      v
API / server
      |
      +---- PostgreSQL
      |
      +---- pgvector
      |
      +---- trusted source index
      |
      +---- RAG pipeline
      |
      v
Source-cited results
```

The static architecture should remain the starting point because it matches the GitHub Pages requirement.
