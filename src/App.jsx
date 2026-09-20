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

import {
  searchHadith,
  searchQuran,
  searchWeb,
  loadHadithEdition,
} from "./services/api";

import { semanticRank } from "./services/semantic";
import { topics } from "./data/topics";

/*
 * ============================================================
 * NUR SEARCH — MAIN APPLICATION COMPONENT
 * ============================================================
 *
 * This file contains the main React application and the reusable
 * UI components used by the application.
 *
 * Nur Search is a frontend-only Quran and Sunnah search interface.
 *
 * Main responsibilities of this component:
 *
 * - Manage search input and search results.
 * - Search Quran sources.
 * - Search Hadith data.
 * - Search the web.
 * - Optionally rank results using browser-based semantic AI.
 * - Manage Quran/Hadith/Web filters.
 * - Manage dark/light theme.
 * - Store bookmarks in localStorage.
 * - Store search history in localStorage.
 * - Display topics for quick discovery.
 * - Display source and technology information.
 *
 * The application does not require its own backend server.
 * It can therefore be deployed as a static application such as
 * GitHub Pages.
 */
export default function App() {
  /*
   * ============================================================
   * SEARCH STATE
   * ============================================================
   */

  // Current text inside the search input.
  const [query, setQuery] = useState("");

  // The query that was actually submitted by the user.
  // Keeping this separate allows the UI to distinguish between
  // typing and an executed search.
  const [submittedQuery, setSubmittedQuery] = useState("");

  /*
   * Search source filter.
   *
   * Possible values:
   * - all
   * - quran
   * - hadith
   * - web
   */
  const [filter, setFilter] = useState("all");

  /*
   * Search ranking mode.
   *
   * hybrid:
   * Uses the normal search results.
   *
   * semantic:
   * Uses browser-based semantic ranking after retrieving results.
   */
  const [mode, setMode] = useState("hybrid");

  // Stores the combined search results displayed on the page.
  const [results, setResults] = useState([]);

  // Indicates whether the main search operation is running.
  const [loading, setLoading] = useState(false);

  // Indicates whether browser AI is currently ranking results.
  const [aiLoading, setAiLoading] = useState(false);

  // Stores a user-friendly search error message.
  const [error, setError] = useState("");

  /*
   * ============================================================
   * USER PREFERENCES
   * ============================================================
   *
   * These values are stored in localStorage because the application
   * does not use a backend database.
   *
   * The function passed to useState runs only during initialization.
   */
  const [theme, setTheme] = useState(
    () => localStorage.getItem("nur-theme") || "dark"
  );

  /*
   * Load saved bookmarks when the application starts.
   *
   * If no bookmarks exist, use an empty array.
   */
  const [bookmarks, setBookmarks] = useState(() =>
    JSON.parse(localStorage.getItem("nur-bookmarks") || "[]")
  );

  /*
   * Load recent search history from localStorage.
   *
   * Search history is intentionally kept inside the user's browser.
   */
  const [history, setHistory] = useState(() =>
    JSON.parse(localStorage.getItem("nur-history") || "[]")
  );

  // Controls the mobile navigation menu.
  const [menuOpen, setMenuOpen] = useState(false);

  // Stores the ID of the result that was most recently copied.
  // This allows the UI to temporarily display a check icon.
  const [copiedId, setCopiedId] = useState("");

  /*
   * ============================================================
   * THEME PERSISTENCE
   * ============================================================
   *
   * Whenever the theme changes:
   *
   * 1. Update the HTML document's data-theme attribute.
   * 2. Save the preference to localStorage.
   *
   * CSS can then use:
   *
   * html[data-theme="dark"]
   * html[data-theme="light"]
   */
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("nur-theme", theme);
  }, [theme]);

  /*
   * ============================================================
   * BOOKMARK PERSISTENCE
   * ============================================================
   *
   * Bookmarks are saved locally so that they remain available
   * after refreshing the page.
   *
   * They are not uploaded to a server.
   */
  useEffect(() => {
    localStorage.setItem("nur-bookmarks", JSON.stringify(bookmarks));
  }, [bookmarks]);

  /*
   * ============================================================
   * SEARCH HISTORY PERSISTENCE
   * ============================================================
   *
   * The user's recent searches are stored locally.
   */
  useEffect(() => {
    localStorage.setItem("nur-history", JSON.stringify(history));
  }, [history]);

  /*
   * ============================================================
   * POPULAR SEARCHES
   * ============================================================
   *
   * useMemo keeps this array stable between renders.
   *
   * These buttons provide quick examples for users who do not
   * know what to search for.
   */
  const popularSearches = useMemo(
    () => ["patience", "prayer", "mercy", "charity", "anger"],
    []
  );

  /*
   * ============================================================
   * MAIN SEARCH FUNCTION
   * ============================================================
   *
   * This function coordinates all search sources.
   *
   * Depending on the selected filter, it can search:
   *
   * - Quran
   * - Hadith
   * - Web
   *
   * Multiple sources are requested concurrently using Promise.all()
   * so the application does not have to wait for each source
   * sequentially.
   */
  async function runSearch(
    nextQuery = query,
    nextFilter = filter,
    nextMode = mode
  ) {
    /*
     * Remove unnecessary whitespace from the query.
     *
     * Do nothing if the user submits an empty search.
     */
    const clean = nextQuery.trim();

    if (!clean) return;

    // Show the loading state.
    setLoading(true);

    // Remove any previous error.
    setError("");

    // Save the submitted query for the results heading.
    setSubmittedQuery(clean);

    // Keep the search input synchronized with the submitted query.
    setQuery(clean);

    // Close the mobile menu after starting a search.
    setMenuOpen(false);

    /*
     * ==========================================================
     * UPDATE SEARCH HISTORY
     * ==========================================================
     *
     * Add the newest search to the beginning.
     *
     * filter(item => item !== clean)
     * prevents duplicate history entries.
     *
     * slice(0, 8)
     * keeps only the latest eight searches.
     */
    setHistory((previous) =>
      [clean, ...previous.filter((item) => item !== clean)].slice(0, 8)
    );

    try {
      /*
       * Each search source is added to this array as a Promise.
       */
      const tasks = [];

      /*
       * ========================================================
       * QURAN SEARCH
       * ========================================================
       *
       * Only search Quran when:
       *
       * - All sources are selected, or
       * - Quran filter is selected.
       *
       * If the Quran request fails, return an empty array instead
       * of stopping the entire search.
       */
      if (nextFilter === "all" || nextFilter === "quran") {
        tasks.push(searchQuran(clean).catch(() => []));
      } else {
        tasks.push(Promise.resolve([]));
      }

      /*
       * ========================================================
       * HADITH SEARCH
       * ========================================================
       *
       * The Bukhari dataset is loaded on demand.
       *
       * This helps avoid downloading the Hadith dataset until
       * the user actually needs it.
       */
      if (nextFilter === "all" || nextFilter === "hadith") {
        tasks.push(
          loadHadithEdition("eng-bukhari")
            .then((data) => searchHadith(data, clean))
            .catch(() => [])
        );
      } else {
        tasks.push(Promise.resolve([]));
      }

      /*
       * ========================================================
       * WEB SEARCH
       * ========================================================
       *
       * Web discovery is kept as a separate result type so users
       * can visually distinguish general web material from
       * Quran and Hadith sources.
       */
      if (nextFilter === "all" || nextFilter === "web") {
        tasks.push(searchWeb(clean).catch(() => []));
      } else {
        tasks.push(Promise.resolve([]));
      }

      /*
       * ========================================================
       * WAIT FOR ALL SEARCH SOURCES
       * ========================================================
       *
       * Promise.all() waits for:
       *
       * 1. Quran
       * 2. Hadith
       * 3. Web
       *
       * Each source returns an array.
       */
      const [quranResults, hadithResults, webResults] =
        await Promise.all(tasks);

      /*
       * Combine all source arrays into one result array.
       */
      let combined = [
        ...quranResults,
        ...hadithResults,
        ...webResults,
      ];

      /*
       * ========================================================
       * OPTIONAL SEMANTIC AI RANKING
       * ========================================================
       *
       * Normal/hybrid mode keeps the normal result ordering.
       *
       * Semantic mode sends the first eight results to the
       * browser-based semantic ranking function.
       *
       * This allows the application to find results based on
       * meaning rather than only exact keywords.
       */
      if (nextMode === "semantic" && combined.length) {
        setAiLoading(true);

        try {
          combined = await semanticRank(clean, combined.slice(0, 8));
        } finally {
          // Always remove the AI loading state.
          setAiLoading(false);
        }
      }

      /*
       * Display the final result list.
       */
      setResults(combined);
    } catch (searchError) {
      /*
       * ========================================================
       * SEARCH ERROR HANDLING
       * ========================================================
       *
       * If an unexpected error reaches this point, display a
       * friendly message instead of breaking the application.
       */
      setError(
        searchError.message || "Search failed. Please try again."
      );

      setResults([]);
      setAiLoading(false);
    } finally {
      /*
       * Search has finished regardless of success or failure.
       */
      setLoading(false);
    }
  }

  /*
   * ============================================================
   * BOOKMARK HANDLER
   * ============================================================
   *
   * Clicking the bookmark button toggles the selected result.
   *
   * If the result already exists:
   *     remove it.
   *
   * Otherwise:
   *     add it.
   */
  function toggleBookmark(result) {
    setBookmarks((previous) => {
      const exists = previous.some(
        (item) => item.id === result.id
      );

      return exists
        ? previous.filter((item) => item.id !== result.id)
        : [...previous, result];
    });
  }

  /*
   * ============================================================
   * COPY RESULT HANDLER
   * ============================================================
   *
   * Copies the source text, reference, and source name to the
   * user's clipboard.
   */
  async function copyResult(result) {
    const text = `${result.text}\n\n— ${
      result.reference || result.title
    }\nSource: ${result.source}`;

    await navigator.clipboard.writeText(text);

    /*
     * Store the copied result ID so its button can display a
     * temporary checkmark.
     */
    setCopiedId(result.id);

    /*
     * Return the icon to its normal state after 1.4 seconds.
     */
    window.setTimeout(() => setCopiedId(""), 1400);
  }

  /*
   * ============================================================
   * TOPIC SELECTION
   * ============================================================
   *
   * Topic cards provide predefined search queries.
   *
   * Example:
   * "Patience" -> search for "patience"
   */
  function chooseTopic(topic) {
    setQuery(topic.query);
    runSearch(topic.query, "all", "hybrid");
  }

  /*
   * ============================================================
   * APPLICATION UI
   * ============================================================
   */

  return (
    <div className="app-shell">

      {/* Decorative blurred background element. */}
      <div className="ambient ambient-one" />

      {/* Second decorative background element. */}
      <div className="ambient ambient-two" />

      {/*
       * Decorative star field.
       *
       * aria-hidden="true" tells screen readers to ignore these
       * purely visual elements.
       */}
      <div className="star-field" aria-hidden="true">
        {Array.from({ length: 26 }).map((_, index) => (
          <span
            key={index}
            className="star"
            style={{ "--i": index }}
          />
        ))}
      </div>

      {/* ======================================================
          HEADER / NAVIGATION
          ====================================================== */}

      <header className="site-header">

        {/* Application logo and brand name. */}
        <a
          className="brand"
          href="#"
          onClick={() =>
            window.scrollTo({
              top: 0,
              behavior: "smooth",
            })
          }
        >
          <span className="brand-mark">☾</span>

          <span>
            <strong>Nur Search</strong>
            <small>Quran &amp; Sunnah</small>
          </span>
        </a>

        {/* Main navigation links. */}
        <nav className={`nav-links ${menuOpen ? "open" : ""}`}>
          <a href="#search">Search</a>
          <a href="#topics">Topics</a>
          <a href="#sources">Sources</a>
          <a href="#about">About</a>
        </nav>

        {/* Header action buttons. */}
        <div className="header-actions">

          {/* Dark/light theme switch. */}
          <button
            className="icon-button"
            aria-label="Toggle theme"
            onClick={() =>
              setTheme(
                theme === "dark" ? "light" : "dark"
              )
            }
          >
            {theme === "dark" ? (
              <Sun size={18} />
            ) : (
              <Moon size={18} />
            )}
          </button>

          {/* Mobile navigation menu button. */}
          <button
            className="icon-button mobile-menu"
            aria-label="Open menu"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? (
              <X size={20} />
            ) : (
              <Menu size={20} />
            )}
          </button>
        </div>
      </header>

      <main>

        {/* ====================================================
            HERO / SEARCH SECTION
            ==================================================== */}

        <section className="hero" id="search">

          {/* Decorative hero symbol. */}
          <div className="hero-ornament">✦</div>

          {/* Small descriptive label. */}
          <p className="eyebrow">
            <Sparkles size={15} />
            Source-first Islamic search
          </p>

          {/* Main application heading. */}
          <h1>
            Search the light of
            <br />
            <span>Quran &amp; Sunnah.</span>
          </h1>

          {/* Application description. */}
          <p className="hero-copy">
            Explore Quran verses, hadith and live web discovery
            with a calm, source-focused interface and optional
            browser AI.
          </p>

          {/* Main search input. */}
          <SearchBox
            query={query}
            setQuery={setQuery}
            onSubmit={() => runSearch()}
            loading={loading}
          />

          {/* ==================================================
              POPULAR SEARCHES
              ================================================== */}

          <div className="popular-row">
            <span>Explore:</span>

            {popularSearches.map((item) => (
              <button
                key={item}
                onClick={() =>
                  chooseTopic({ query: item })
                }
              >
                {item}
              </button>
            ))}
          </div>

          {/* ==================================================
              FEATURE / CAPABILITY SUMMARY
              ================================================== */}

          <div className="hero-stats">

            <div>
              <strong>Quran</strong>
              <span>Live search</span>
            </div>

            <div>
              <strong>Hadith</strong>
              <span>Browser dataset</span>
            </div>

            <div>
              <strong>AI</strong>
              <span>Optional semantic mode</span>
            </div>

            <div>
              <strong>Web</strong>
              <span>Live discovery</span>
            </div>

          </div>
        </section>

        {/* ====================================================
            SEARCH WORKSPACE
            ==================================================== */}

        <section className="search-workspace">

          {/* Search result heading. */}
          <div className="workspace-head">

            <div>
              <p className="section-kicker">
                Discovery
              </p>

              <h2>
                {submittedQuery
                  ? `Results for “${submittedQuery}”`
                  : "Begin your search"}
              </h2>
            </div>

            {/* Clear button only appears after a search. */}
            {submittedQuery && (
              <button
                className="clear-button"
                onClick={() => {
                  setSubmittedQuery("");
                  setResults([]);
                }}
              >
                Clear results
              </button>
            )}

          </div>

          {/* ==================================================
              SOURCE FILTERS AND SEARCH MODES
              ================================================== */}

          <div className="filter-row">

            {/* Source filters. */}
            {[
              ["all", "All"],
              ["quran", "Quran"],
              ["hadith", "Hadith"],
              ["web", "Web"],
            ].map(([value, label]) => (
              <button
                key={value}
                className={`filter-chip ${
                  filter === value ? "active" : ""
                }`}
                onClick={() => {
                  setFilter(value);

                  /*
                   * If a query has already been submitted,
                   * immediately rerun it using the new filter.
                   */
                  if (submittedQuery) {
                    runSearch(
                      submittedQuery,
                      value,
                      mode
                    );
                  }
                }}
              >
                {label}
              </button>
            ))}

            {/* Visual divider between source and ranking controls. */}
            <span className="filter-divider" />

            {/* Search ranking modes. */}
            {[
              ["hybrid", "Smart"],
              ["semantic", "AI Semantic"],
            ].map(([value, label]) => (
              <button
                key={value}
                className={`mode-chip ${
                  mode === value ? "active" : ""
                }`}
                onClick={() => {
                  setMode(value);

                  /*
                   * If results already exist, rerun the current
                   * query using the newly selected mode.
                   */
                  if (submittedQuery) {
                    runSearch(
                      submittedQuery,
                      filter,
                      value
                    );
                  }
                }}
              >
                <Sparkles size={14} />
                {label}
              </button>
            ))}
          </div>

          {/* ==================================================
              AI STATUS
              ================================================== */}

          {aiLoading && (
            <div className="ai-status">
              <Sparkles size={16} />
              Browser AI is ranking the results…
            </div>
          )}

          {/* ==================================================
              ERROR MESSAGE
              ================================================== */}

          {error && (
            <div className="error-box">
              {error}
            </div>
          )}

          {/* ==================================================
              RESULT DISPLAY
              ==================================================
              
              Three states are possible:
              
              1. Loading
              2. Results available
              3. Empty state
              */}

          {loading ? (
            /*
             * Display placeholder cards while external APIs
             * are responding.
             */
            <div className="result-grid">
              {[1, 2, 3].map((item) => (
                <SkeletonCard key={item} />
              ))}
            </div>
          ) : results.length ? (
            /*
             * Display actual search results.
             */
            <div className="result-grid">
              {results.map((result) => (
                <ResultCard
                  key={result.id}
                  result={result}
                  bookmarked={bookmarks.some(
                    (item) => item.id === result.id
                  )}
                  copied={copiedId === result.id}
                  onBookmark={() =>
                    toggleBookmark(result)
                  }
                  onCopy={() =>
                    copyResult(result)
                  }
                />
              ))}
            </div>
          ) : (
            /*
             * Nothing to display yet or no results were found.
             */
            <EmptyState
              submitted={submittedQuery}
              history={history}
              onSearch={runSearch}
            />
          )}
        </section>

        {/* ====================================================
            TOPIC DISCOVERY SECTION
            ==================================================== */}

        <section
          className="topics-section"
          id="topics"
        >
          <div className="section-heading">

            <p className="section-kicker">
              Explore by meaning
            </p>

            <h2>Topics for reflection</h2>

            <p>
              Start with a theme and let the search engine
              discover related sources.
            </p>
          </div>

          {/* Topic cards are generated from the topics data file. */}
          <div className="topic-grid">
            {topics.map((topic) => (
              <button
                className="topic-card"
                key={topic.title}
                onClick={() => chooseTopic(topic)}
              >
                <span className="topic-icon">
                  <Star size={18} />
                </span>

                <span>
                  <strong>{topic.title}</strong>
                  <small>{topic.description}</small>
                </span>

                <ChevronRight size={18} />
              </button>
            ))}
          </div>
        </section>

        {/* ====================================================
            ABOUT / FEATURES SECTION
            ==================================================== */}

        <section
          className="features-section"
          id="about"
        >
          <div className="feature-panel">

            {/* Main explanation of the application's philosophy. */}
            <div>

              <p className="section-kicker">
                Built for clarity
              </p>

              <h2>
                AI helps find sources.
                <br />
                <span>
                  Sources remain the authority.
                </span>
              </h2>

              <p>
                Nur Search separates primary source results from
                web discovery and keeps generated search
                intelligence visibly distinct from source text.
              </p>

            </div>

            {/* Application feature list. */}
            <div className="feature-list">

              <Feature
                icon={<Search />}
                title="Hybrid search"
                text="Keyword, source and semantic discovery in one workflow."
              />

              <Feature
                icon={<BookOpen />}
                title="Source-first results"
                text="Reference, collection and external source information stay visible."
              />

              <Feature
                icon={<Languages />}
                title="Multilingual-ready"
                text="The UI is prepared for Arabic, English and Urdu expansion."
              />

              <Feature
                icon={<Bookmark />}
                title="Private bookmarks"
                text="Bookmarks and history stay in the user's browser."
              />

            </div>
          </div>
        </section>

        {/* ====================================================
            SOURCES AND TECHNOLOGY SECTION
            ==================================================== */}

        <section
          className="sources-section"
          id="sources"
        >
          <div className="section-heading">

            <p className="section-kicker">
              Transparency
            </p>

            <h2>
              Data &amp; technology sources
            </h2>

          </div>

          {/* External APIs and technologies used by the application. */}
          <div className="source-grid">

            <SourceBox
              title="Al Quran Cloud"
              text="Live Quran REST API used for keyword search and verse references."
              href="https://alquran.cloud/api"
            />

            <SourceBox
              title="Fawaz Hadith API"
              text="Open Hadith dataset delivered through jsDelivr for browser-side search."
              href="https://github.com/fawazahmed0/hadith-api"
            />

            <SourceBox
              title="Transformers.js"
              text="Optional browser-side semantic embeddings using an open sentence-transformer model."
              href="https://huggingface.co/docs/transformers.js"
            />

            <SourceBox
              title="Wikipedia API"
              text="Live general web discovery layer, kept visually separate from primary sources."
              href="https://www.mediawiki.org/wiki/API:Search"
            />

          </div>
        </section>
      </main>

      {/* ======================================================
          FOOTER
          ====================================================== */}

      <footer className="site-footer">

        <div>
          <span className="brand-mark small">
            ☾
          </span>
          {" "}Nur Search
        </div>

        <span>
          Frontend-only • GitHub Pages ready • No application backend
        </span>

      </footer>
    </div>
  );
}


/*
 * ============================================================
 * SEARCH BOX COMPONENT
 * ============================================================
 *
 * Responsibilities:
 *
 * - Display search icon.
 * - Manage the input value through React state.
 * - Submit the search when the user presses Enter.
 * - Disable the button while searching.
 * - Prevent empty searches.
 *
 * Keeping this logic in its own component makes the main App
 * component easier to understand and maintain.
 */
function SearchBox({
  query,
  setQuery,
  onSubmit,
  loading,
}) {
  return (
    <form
      className="search-box"
      onSubmit={(event) => {
        /*
         * Prevent the browser from performing a traditional
         * full-page form submission.
         */
        event.preventDefault();

        // Start the React search workflow.
        onSubmit();
      }}
    >
      {/* Search icon. */}
      <Search size={22} />

      {/* Main search input. */}
      <input
        value={query}
        onChange={(event) =>
          setQuery(event.target.value)
        }
        placeholder="What are you seeking?"
        aria-label="Search Quran and Sunnah"
      />

      {/* Search submit button. */}
      <button
        type="submit"
        disabled={loading || !query.trim()}
      >
        {loading ? "Searching…" : "Search"}
      </button>
    </form>
  );
}


/*
 * ============================================================
 * RESULT CARD COMPONENT
 * ============================================================
 *
 * Displays one search result.
 *
 * The result can come from:
 *
 * - Quran
 * - Hadith
 * - Web
 *
 * Each result type receives a visual type label so users can
 * distinguish primary-source material from general web results.
 */
function ResultCard({
  result,
  bookmarked,
  copied,
  onBookmark,
  onCopy,
}) {
  /*
   * Convert the internal result type into a user-friendly label.
   */
  const typeLabel =
    result.type === "quran"
      ? "QURAN"
      : result.type === "hadith"
        ? "HADITH"
        : "WEB";

  /*
   * Convert the semantic score into a percentage.
   *
   * semanticScore normally contains a decimal value such as:
   *
   * 0.87
   *
   * which becomes:
   *
   * 87%
   *
   * If no semantic score exists, fall back to the normal
   * result score.
   */
  const semanticPercent = result.semanticScore
    ? Math.round(result.semanticScore * 100)
    : result.score || 0;

  return (
    <article
      className={`result-card ${result.type}`}
    >

      {/* ======================================================
          RESULT HEADER
          ====================================================== */}

      <div className="result-topline">

        {/* Quran/Hadith/Web badge. */}
        <span className="source-badge">
          {typeLabel}
        </span>

        {/* Reference number/title. */}
        <span className="result-reference">
          {result.reference || result.title}
        </span>

      </div>

      {/* Result title. */}
      <h3>{result.title}</h3>

      {/* Optional secondary title/subtitle. */}
      {result.subtitle && (
        <p className="result-subtitle">
          {result.subtitle}
        </p>
      )}

      {/* Optional Arabic text. */}
      {result.arabic && (
        <p
          className="arabic-text"
          dir="rtl"
        >
          {result.arabic}
        </p>
      )}

      {/* Main result text. */}
      <p className="result-text">
        {result.text}
      </p>

      {/* ======================================================
          RESULT METADATA
          ====================================================== */}

      <div className="result-meta">

        {/* Source name. */}
        <span>{result.source}</span>

        {/* Semantic/normal match score when available. */}
        {semanticPercent > 0 && (
          <span>
            Match {semanticPercent}%
          </span>
        )}

      </div>

      {/* ======================================================
          RESULT ACTIONS
          ====================================================== */}

      <div className="result-actions">

        {/* Open the original source in a new tab. */}
        <a
          href={result.sourceUrl}
          target="_blank"
          rel="noreferrer"
        >
          Open source
          <ExternalLink size={14} />
        </a>

        {/* Copy result to clipboard. */}
        <button
          onClick={onCopy}
          aria-label="Copy result"
        >
          {copied ? (
            <Check size={16} />
          ) : (
            <Copy size={16} />
          )}
        </button>

        {/* Bookmark/unbookmark result. */}
        <button
          className={
            bookmarked ? "bookmarked" : ""
          }
          onClick={onBookmark}
          aria-label="Bookmark result"
        >
          <Bookmark
            size={16}
            fill={
              bookmarked
                ? "currentColor"
                : "none"
            }
          />
        </button>

      </div>
    </article>
  );
}


/*
 * ============================================================
 * EMPTY STATE COMPONENT
 * ============================================================
 *
 * Displays useful information when there are no search results.
 *
 * There are two main situations:
 *
 * 1. The user has previous searches.
 * 2. The user has not searched yet or no results were found.
 */
function EmptyState({
  submitted,
  history,
  onSearch,
}) {
  /*
   * If there is no current search but search history exists,
   * show the recent searches.
   */
  if (!submitted && history.length) {
    return (
      <div className="empty-state">

        <History size={28} />

        <h3>
          Continue exploring
        </h3>

        <p>
          Your recent searches are stored privately
          in this browser.
        </p>

        {/* Recent search buttons. */}
        <div className="history-list">
          {history.slice(0, 5).map((item) => (
            <button
              key={item}
              onClick={() => onSearch(item)}
            >
              {item}
            </button>
          ))}
        </div>

      </div>
    );
  }

  /*
   * Default empty state.
   *
   * The message changes depending on whether a search was
   * submitted.
   */
  return (
    <div className="empty-state">

      <span className="empty-moon">
        ☾
      </span>

      <h3>
        {submitted
          ? "No results found"
          : "Your search begins here"}
      </h3>

      <p>
        {submitted
          ? "Try another phrase, a shorter keyword, or a broader topic."
          : "Search a word, question or topic above."}
      </p>

    </div>
  );
}


/*
 * ============================================================
 * SKELETON LOADING COMPONENT
 * ============================================================
 *
 * These placeholder cards are displayed while the application
 * waits for external APIs.
 *
 * This provides visual feedback instead of showing a completely
 * blank result area.
 */
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


/*
 * ============================================================
 * FEATURE COMPONENT
 * ============================================================
 *
 * Reusable component for the feature list in the About section.
 *
 * Props:
 *
 * icon  - Lucide icon component
 * title - Feature heading
 * text  - Feature description
 */
function Feature({
  icon,
  title,
  text,
}) {
  return (
    <div className="feature-item">

      {/* Feature icon. */}
      <span>{icon}</span>

      {/* Feature title and description. */}
      <div>
        <strong>{title}</strong>
        <small>{text}</small>
      </div>

    </div>
  );
}


/*
 * ============================================================
 * SOURCE BOX COMPONENT
 * ============================================================
 *
 * Displays information about an external API or technology.
 *
 * Each source is presented as a clickable card that opens the
 * relevant documentation in a new browser tab.
 */
function SourceBox({
  title,
  text,
  href,
}) {
  return (
    <a
      className="source-box"
      href={href}
      target="_blank"
      rel="noreferrer"
    >

      {/* Source/technology name. */}
      <strong>{title}</strong>

      {/* Explanation of how the source is used. */}
      <p>{text}</p>

      {/* Documentation link indicator. */}
      <span>
        View documentation
        <ExternalLink size={14} />
      </span>

    </a>
  );
}

