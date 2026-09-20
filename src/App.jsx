import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Bookmark,
  Check,
  ChevronRight,
  Copy,
  ExternalLink,
  History,
  Languages,
  Menu,
  Moon,
  Search,
  Sparkles,
  Star,
  Sun,
  X,
} from "lucide-react";
import { searchHadith, searchQuran, searchWeb, loadHadithEdition } from "./services/api";
import { semanticRank } from "./services/semantic";
import { topics } from "./data/topics";

// The main application owns navigation, search state, local preferences and presentation.
export default function App() {
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [mode, setMode] = useState("hybrid");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState("");
  const [theme, setTheme] = useState(() => localStorage.getItem("nur-theme") || "dark");
  const [bookmarks, setBookmarks] = useState(() =>
    JSON.parse(localStorage.getItem("nur-bookmarks") || "[]")
  );
  const [history, setHistory] = useState(() =>
    JSON.parse(localStorage.getItem("nur-history") || "[]")
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [copiedId, setCopiedId] = useState("");

  // Persist the user's visual preference locally because there is no backend.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("nur-theme", theme);
  }, [theme]);

  // Persist bookmarks locally so they survive page refreshes and GitHub Pages deployments.
  useEffect(() => {
    localStorage.setItem("nur-bookmarks", JSON.stringify(bookmarks));
  }, [bookmarks]);

  // Persist a small search history locally.
  useEffect(() => {
    localStorage.setItem("nur-history", JSON.stringify(history));
  }, [history]);

  const popularSearches = useMemo(
    () => ["patience", "prayer", "mercy", "charity", "anger"],
    []
  );

  async function runSearch(nextQuery = query, nextFilter = filter, nextMode = mode) {
    const clean = nextQuery.trim();
    if (!clean) return;

    setLoading(true);
    setError("");
    setSubmittedQuery(clean);
    setQuery(clean);
    setMenuOpen(false);

    setHistory((previous) => [clean, ...previous.filter((item) => item !== clean)].slice(0, 8));

    try {
      const tasks = [];

      if (nextFilter === "all" || nextFilter === "quran") {
        tasks.push(searchQuran(clean).catch(() => []));
      } else {
        tasks.push(Promise.resolve([]));
      }

      if (nextFilter === "all" || nextFilter === "hadith") {
        // Bukhari is loaded on demand; the result remains frontend-only.
        tasks.push(
          loadHadithEdition("eng-bukhari")
            .then((data) => searchHadith(data, clean))
            .catch(() => [])
        );
      } else {
        tasks.push(Promise.resolve([]));
      }

      if (nextFilter === "all" || nextFilter === "web") {
        tasks.push(searchWeb(clean).catch(() => []));
      } else {
        tasks.push(Promise.resolve([]));
      }

      const [quranResults, hadithResults, webResults] = await Promise.all(tasks);
      let combined = [...quranResults, ...hadithResults, ...webResults];

      // Keyword mode leaves API/dataset ordering intact.
      if (nextMode === "semantic" && combined.length) {
        setAiLoading(true);
        try {
          combined = await semanticRank(clean, combined.slice(0, 8));
        } finally {
          setAiLoading(false);
        }
      }

      setResults(combined);
    } catch (searchError) {
      setError(searchError.message || "Search failed. Please try again.");
      setResults([]);
      setAiLoading(false);
    } finally {
      setLoading(false);
    }
  }

  function toggleBookmark(result) {
    setBookmarks((previous) => {
      const exists = previous.some((item) => item.id === result.id);
      return exists ? previous.filter((item) => item.id !== result.id) : [...previous, result];
    });
  }

  async function copyResult(result) {
    const text = `${result.text}\n\n— ${result.reference || result.title}\nSource: ${result.source}`;
    await navigator.clipboard.writeText(text);
    setCopiedId(result.id);
    window.setTimeout(() => setCopiedId(""), 1400);
  }

  function chooseTopic(topic) {
    setQuery(topic.query);
    runSearch(topic.query, "all", "hybrid");
  }

  return (
    <div className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <div className="star-field" aria-hidden="true">
        {Array.from({ length: 26 }).map((_, index) => (
          <span key={index} className="star" style={{ "--i": index }} />
        ))}
      </div>

      <header className="site-header">
        <a className="brand" href="#" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          <span className="brand-mark">☾</span>
          <span>
            <strong>Nur Search</strong>
            <small>Quran & Sunnah</small>
          </span>
        </a>

        <nav className={`nav-links ${menuOpen ? "open" : ""}`}>
          <a href="#search">Search</a>
          <a href="#topics">Topics</a>
          <a href="#sources">Sources</a>
          <a href="#about">About</a>
        </nav>

        <div className="header-actions">
          <button
            className="icon-button"
            aria-label="Toggle theme"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button className="icon-button mobile-menu" aria-label="Open menu" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      <main>
        <section className="hero" id="search">
          <div className="hero-ornament">✦</div>
          <p className="eyebrow"><Sparkles size={15} /> Source-first Islamic search</p>
          <h1>Search the light of<br /><span>Quran & Sunnah.</span></h1>
          <p className="hero-copy">
            Explore Quran verses, hadith and live web discovery with a calm,
            source-focused interface and optional browser AI.
          </p>

          <SearchBox
            query={query}
            setQuery={setQuery}
            onSubmit={() => runSearch()}
            loading={loading}
          />

          <div className="popular-row">
            <span>Explore:</span>
            {popularSearches.map((item) => (
              <button key={item} onClick={() => chooseTopic({ query: item })}>
                {item}
              </button>
            ))}
          </div>

          <div className="hero-stats">
            <div><strong>Quran</strong><span>Live search</span></div>
            <div><strong>Hadith</strong><span>Browser dataset</span></div>
            <div><strong>AI</strong><span>Optional semantic mode</span></div>
            <div><strong>Web</strong><span>Live discovery</span></div>
          </div>
        </section>

        <section className="search-workspace">
          <div className="workspace-head">
            <div>
              <p className="section-kicker">Discovery</p>
              <h2>{submittedQuery ? `Results for “${submittedQuery}”` : "Begin your search"}</h2>
            </div>
            {submittedQuery && (
              <button className="clear-button" onClick={() => { setSubmittedQuery(""); setResults([]); }}>
                Clear results
              </button>
            )}
          </div>

          <div className="filter-row">
            {[
              ["all", "All"],
              ["quran", "Quran"],
              ["hadith", "Hadith"],
              ["web", "Web"],
            ].map(([value, label]) => (
              <button
                key={value}
                className={`filter-chip ${filter === value ? "active" : ""}`}
                onClick={() => {
                  setFilter(value);
                  if (submittedQuery) runSearch(submittedQuery, value, mode);
                }}
              >
                {label}
              </button>
            ))}
            <span className="filter-divider" />
            {[
              ["hybrid", "Smart"],
              ["semantic", "AI Semantic"],
            ].map(([value, label]) => (
              <button
                key={value}
                className={`mode-chip ${mode === value ? "active" : ""}`}
                onClick={() => {
                  setMode(value);
                  if (submittedQuery) runSearch(submittedQuery, filter, value);
                }}
              >
                <Sparkles size={14} /> {label}
              </button>
            ))}
          </div>

          {aiLoading && (
            <div className="ai-status"><Sparkles size={16} /> Browser AI is ranking the results…</div>
          )}

          {error && <div className="error-box">{error}</div>}

          {loading ? (
            <div className="result-grid">
              {[1, 2, 3].map((item) => <SkeletonCard key={item} />)}
            </div>
          ) : results.length ? (
            <div className="result-grid">
              {results.map((result) => (
                <ResultCard
                  key={result.id}
                  result={result}
                  bookmarked={bookmarks.some((item) => item.id === result.id)}
                  copied={copiedId === result.id}
                  onBookmark={() => toggleBookmark(result)}
                  onCopy={() => copyResult(result)}
                />
              ))}
            </div>
          ) : (
            <EmptyState submitted={submittedQuery} history={history} onSearch={runSearch} />
          )}
        </section>

        <section className="topics-section" id="topics">
          <div className="section-heading">
            <p className="section-kicker">Explore by meaning</p>
            <h2>Topics for reflection</h2>
            <p>Start with a theme and let the search engine discover related sources.</p>
          </div>
          <div className="topic-grid">
            {topics.map((topic) => (
              <button className="topic-card" key={topic.title} onClick={() => chooseTopic(topic)}>
                <span className="topic-icon"><Star size={18} /></span>
                <span>
                  <strong>{topic.title}</strong>
                  <small>{topic.description}</small>
                </span>
                <ChevronRight size={18} />
              </button>
            ))}
          </div>
        </section>

        <section className="features-section" id="about">
          <div className="feature-panel">
            <div>
              <p className="section-kicker">Built for clarity</p>
              <h2>AI helps find sources.<br /><span>Sources remain the authority.</span></h2>
              <p>
                Nur Search separates primary source results from web discovery and
                keeps generated search intelligence visibly distinct from source text.
              </p>
            </div>
            <div className="feature-list">
              <Feature icon={<Search />} title="Hybrid search" text="Keyword, source and semantic discovery in one workflow." />
              <Feature icon={<BookOpen />} title="Source-first results" text="Reference, collection and external source information stay visible." />
              <Feature icon={<Languages />} title="Multilingual-ready" text="The UI is prepared for Arabic, English and Urdu expansion." />
              <Feature icon={<Bookmark />} title="Private bookmarks" text="Bookmarks and history stay in the user's browser." />
            </div>
          </div>
        </section>

        <section className="sources-section" id="sources">
          <div className="section-heading">
            <p className="section-kicker">Transparency</p>
            <h2>Data & technology sources</h2>
          </div>
          <div className="source-grid">
            <SourceBox title="Al Quran Cloud" text="Live Quran REST API used for keyword search and verse references." href="https://alquran.cloud/api" />
            <SourceBox title="Fawaz Hadith API" text="Open Hadith dataset delivered through jsDelivr for browser-side search." href="https://github.com/fawazahmed0/hadith-api" />
            <SourceBox title="Transformers.js" text="Optional browser-side semantic embeddings using an open sentence-transformer model." href="https://huggingface.co/docs/transformers.js" />
            <SourceBox title="Wikipedia API" text="Live general web discovery layer, kept visually separate from primary sources." href="https://www.mediawiki.org/wiki/API:Search" />
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div><span className="brand-mark small">☾</span> Nur Search</div>
        <span>Frontend-only • GitHub Pages ready • No application backend</span>
      </footer>
    </div>
  );
}

// Search input component keeps keyboard interaction and accessibility concerns together.
function SearchBox({ query, setQuery, onSubmit, loading }) {
  return (
    <form className="search-box" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
      <Search size={22} />
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="What are you seeking?"
        aria-label="Search Quran and Sunnah"
      />
      <button type="submit" disabled={loading || !query.trim()}>
        {loading ? "Searching…" : "Search"}
      </button>
    </form>
  );
}

// Search results are deliberately categorized so web material never looks like primary scripture.
function ResultCard({ result, bookmarked, copied, onBookmark, onCopy }) {
  const typeLabel = result.type === "quran" ? "QURAN" : result.type === "hadith" ? "HADITH" : "WEB";
  const semanticPercent = result.semanticScore ? Math.round(result.semanticScore * 100) : result.score || 0;

  return (
    <article className={`result-card ${result.type}`}>
      <div className="result-topline">
        <span className="source-badge">{typeLabel}</span>
        <span className="result-reference">{result.reference || result.title}</span>
      </div>

      <h3>{result.title}</h3>
      {result.subtitle && <p className="result-subtitle">{result.subtitle}</p>}
      {result.arabic && <p className="arabic-text" dir="rtl">{result.arabic}</p>}
      <p className="result-text">{result.text}</p>

      <div className="result-meta">
        <span>{result.source}</span>
        {semanticPercent > 0 && <span>Match {semanticPercent}%</span>}
      </div>

      <div className="result-actions">
        <a href={result.sourceUrl} target="_blank" rel="noreferrer">
          Open source <ExternalLink size={14} />
        </a>
        <button onClick={onCopy} aria-label="Copy result">{copied ? <Check size={16} /> : <Copy size={16} />}</button>
        <button className={bookmarked ? "bookmarked" : ""} onClick={onBookmark} aria-label="Bookmark result">
          <Bookmark size={16} fill={bookmarked ? "currentColor" : "none"} />
        </button>
      </div>
    </article>
  );
}

// Empty state keeps the search page useful before and after the first query.
function EmptyState({ submitted, history, onSearch }) {
  if (!submitted && history.length) {
    return (
      <div className="empty-state">
        <History size={28} />
        <h3>Continue exploring</h3>
        <p>Your recent searches are stored privately in this browser.</p>
        <div className="history-list">
          {history.slice(0, 5).map((item) => (
            <button key={item} onClick={() => onSearch(item)}>{item}</button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="empty-state">
      <span className="empty-moon">☾</span>
      <h3>{submitted ? "No results found" : "Your search begins here"}</h3>
      <p>{submitted ? "Try another phrase, a shorter keyword, or a broader topic." : "Search a word, question or topic above."}</p>
    </div>
  );
}

// Small loading cards avoid a blank screen while external sources respond.
function SkeletonCard() {
  return (
    <div className="result-card skeleton">
      <span />
      <span />
      <span />
      <span />
    </div>
  );
}

// Feature item used in the architecture/value section.
function Feature({ icon, title, text }) {
  return (
    <div className="feature-item">
      <span>{icon}</span>
      <div><strong>{title}</strong><small>{text}</small></div>
    </div>
  );
}

// Source cards make external dependencies visible to users.
function SourceBox({ title, text, href }) {
  return (
    <a className="source-box" href={href} target="_blank" rel="noreferrer">
      <strong>{title}</strong>
      <p>{text}</p>
      <span>View documentation <ExternalLink size={14} /></span>
    </a>
  );
}