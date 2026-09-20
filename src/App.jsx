/*
 * ============================================================
 * NUR SEARCH — MAIN APPLICATION
 * ============================================================
 *
 * Nur Search is a frontend-only Quran and Sunnah search engine.
 *
 * Main features:
 *
 * - Quran search
 * - Hadith search
 * - Wikipedia web discovery
 * - Optional semantic AI ranking
 * - Quran/Hadith/Web filtering
 * - Search history
 * - Local bookmarks
 * - Dark/light theme
 * - Topic discovery
 * - Responsive interface
 * - GitHub Pages deployment
 *
 * This file contains:
 *
 * - Main App component
 * - SearchBox
 * - ResultCard
 * - EmptyState
 * - SkeletonCard
 * - Feature
 * - SourceBox
 *
 * External data/API logic is intentionally kept inside:
 *
 * src/services/api.js
 *
 * This separation keeps the UI and data-fetching logic easier
 * to maintain.
 * ============================================================
 */

import {
  useEffect,
  useMemo,
  useState,
} from "react";

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
 * SAFE LOCAL STORAGE HELPERS
 * ============================================================
 *
 * Browser localStorage is normally reliable, but malformed
 * stored JSON can cause JSON.parse() to throw.
 *
 * These helpers prevent corrupted localStorage data from
 * crashing the entire React application.
 */


/*
 * Read a JSON value safely from localStorage.
 *
 * @param {string} key - localStorage key.
 * @param {*} fallback - Value to use when reading fails.
 * @returns {*} Parsed value or fallback.
 */
function readStorage(
  key,
  fallback
) {
  try {
    const value =
      localStorage.getItem(key);

    if (!value) {
      return fallback;
    }

    return JSON.parse(value);
  } catch {
    /*
     * If the saved value is invalid JSON, remove it and return
     * the safe fallback.
     */
    try {
      localStorage.removeItem(key);
    } catch {
      // Ignore localStorage cleanup errors.
    }

    return fallback;
  }
}


/*
 * Write a JSON value safely to localStorage.
 *
 * If browser storage is unavailable, the application continues
 * working without persistence.
 *
 * @param {string} key - localStorage key.
 * @param {*} value - Value to store.
 */
function writeStorage(
  key,
  value
) {
  try {
    localStorage.setItem(
      key,
      JSON.stringify(value)
    );
  } catch {
    /*
     * Storage errors should never break the search interface.
     *
     * This can happen if browser storage is disabled or full.
     */
  }
}


/*
 * ============================================================
 * MAIN APPLICATION COMPONENT
 * ============================================================
 */
export default function App() {
  /*
   * ============================================================
   * SEARCH STATE
   * ============================================================
   */

  /*
   * Current value inside the search box.
   */
  const [query, setQuery] =
    useState("");

  /*
   * Query that was actually submitted.
   *
   * Keeping this separate from query allows the user to type
   * without changing the current result heading until Search
   * is actually submitted.
   */
  const [submittedQuery, setSubmittedQuery] =
    useState("");

  /*
   * Search source filter.
   *
   * Available values:
   *
   * all
   * quran
   * hadith
   * web
   */
  const [filter, setFilter] =
    useState("all");

  /*
   * Search ranking mode.
   *
   * hybrid:
   * Normal keyword/source search.
   *
   * semantic:
   * Browser AI semantic ranking.
   */
  const [mode, setMode] =
    useState("hybrid");

  /*
   * Combined search results.
   */
  const [results, setResults] =
    useState([]);

  /*
   * Main network/search loading state.
   */
  const [loading, setLoading] =
    useState(false);

  /*
   * Browser AI ranking loading state.
   */
  const [aiLoading, setAiLoading] =
    useState(false);

  /*
   * Friendly error message displayed to the user.
   */
  const [error, setError] =
    useState("");

  /*
   * ============================================================
   * USER PREFERENCES
   * ============================================================
   */

  /*
   * Load saved theme safely.
   */
  const [theme, setTheme] =
    useState(() => {
      try {
        return (
          localStorage.getItem("nur-theme") ||
          "dark"
        );
      } catch {
        return "dark";
      }
    });

  /*
   * Load saved bookmarks safely.
   */
  const [bookmarks, setBookmarks] =
    useState(() => {
      const saved =
        readStorage(
          "nur-bookmarks",
          []
        );

      return Array.isArray(saved)
        ? saved
        : [];
    });

  /*
   * Load search history safely.
   */
  const [history, setHistory] =
    useState(() => {
      const saved =
        readStorage(
          "nur-history",
          []
        );

      return Array.isArray(saved)
        ? saved
        : [];
    });

  /*
   * Mobile navigation state.
   */
  const [menuOpen, setMenuOpen] =
    useState(false);

  /*
   * ID of the result that was most recently copied.
   */
  const [copiedId, setCopiedId] =
    useState("");


  /*
   * ============================================================
   * THEME PERSISTENCE
   * ============================================================
   *
   * Keep the HTML document synchronized with the selected theme.
   */
  useEffect(() => {
    /*
     * Update the HTML data-theme attribute.
     */
    document.documentElement.dataset.theme =
      theme;

    /*
     * Save the preference.
     */
    try {
      localStorage.setItem(
        "nur-theme",
        theme
      );
    } catch {
      // Continue without persistence if storage is unavailable.
    }
  }, [theme]);


  /*
   * ============================================================
   * BOOKMARK PERSISTENCE
   * ============================================================
   */
  useEffect(() => {
    writeStorage(
      "nur-bookmarks",
      bookmarks
    );
  }, [bookmarks]);


  /*
   * ============================================================
   * SEARCH HISTORY PERSISTENCE
   * ============================================================
   */
  useEffect(() => {
    writeStorage(
      "nur-history",
      history
    );
  }, [history]);


  /*
   * ============================================================
   * POPULAR SEARCHES
   * ============================================================
   *
   * useMemo keeps this static array stable between renders.
   */
  const popularSearches =
    useMemo(
      () => [
        "patience",
        "prayer",
        "mercy",
        "charity",
        "anger",
      ],
      []
    );


  /*
   * ============================================================
   * MAIN SEARCH FUNCTION
   * ============================================================
   *
   * This function:
   *
   * 1. Validates the query.
   * 2. Updates the UI.
   * 3. Starts the required source searches.
   * 4. Waits for successful/failed sources independently.
   * 5. Combines available results.
   * 6. Optionally performs semantic AI ranking.
   * 7. Displays results.
   *
   * A failure in one external source must NEVER blank the
   * complete application.
   */
  async function runSearch(
    nextQuery = query,
    nextFilter = filter,
    nextMode = mode
  ) {
    /*
     * Safely convert the supplied query to a string.
     */
    const clean =
      String(nextQuery || "").trim();

    /*
     * Ignore empty searches.
     */
    if (!clean) {
      return;
    }

    /*
     * Start the loading state.
     */
    setLoading(true);

    /*
     * Clear previous errors.
     */
    setError("");

    /*
     * Clear previous results immediately so stale results are
     * not displayed while the new search is running.
     */
    setResults([]);

    /*
     * Store the submitted query.
     */
    setSubmittedQuery(clean);

    /*
     * Keep the search input synchronized.
     */
    setQuery(clean);

    /*
     * Close the mobile navigation menu.
     */
    setMenuOpen(false);

    /*
     * ========================================================
     * UPDATE SEARCH HISTORY
     * ========================================================
     */

    setHistory(
      (previous) =>
        [
          clean,
          ...previous.filter(
            (item) => item !== clean
          ),
        ].slice(0, 8)
    );


    try {
      /*
       * ========================================================
       * BUILD SEARCH TASKS
       * ========================================================
       *
       * Each source is represented by a Promise.
       *
       * We intentionally do NOT use Promise.all() here.
       *
       * Promise.all() rejects the entire group when one promise
       * rejects unexpectedly.
       *
       * Promise.allSettled() allows Quran, Hadith and Web to
       * succeed or fail independently.
       */

      const tasks = [];


      /*
       * --------------------------------------------------------
       * QURAN TASK
       * --------------------------------------------------------
       */
      if (
        nextFilter === "all" ||
        nextFilter === "quran"
      ) {
        tasks.push({
          source: "Quran",
          promise:
            searchQuran(clean),
        });
      }


      /*
       * --------------------------------------------------------
       * HADITH TASK
       * --------------------------------------------------------
       *
       * Download Bukhari only when the selected filter requires
       * Hadith.
       */
      if (
        nextFilter === "all" ||
        nextFilter === "hadith"
      ) {
        tasks.push({
          source: "Hadith",
          promise:
            loadHadithEdition(
              "eng-bukhari"
            ).then(
              (data) =>
                searchHadith(
                  data,
                  clean
                )
            ),
        });
      }


      /*
       * --------------------------------------------------------
       * WEB TASK
       * --------------------------------------------------------
       */
      if (
        nextFilter === "all" ||
        nextFilter === "web"
      ) {
        tasks.push({
          source: "Web",
          promise:
            searchWeb(clean),
        });
      }


      /*
       * ========================================================
       * WAIT FOR ALL SOURCES
       * ========================================================
       */
      const settled =
        await Promise.allSettled(
          tasks.map(
            (task) => task.promise
          )
        );


      /*
       * ========================================================
       * COLLECT RESULTS
       * ========================================================
       */

      let combined = [];

      /*
       * Keep track of sources that failed.
       *
       * This allows the UI to show a useful message without
       * hiding successful results from other sources.
       */
      const failedSources = [];


      settled.forEach(
        (result, index) => {
          /*
           * Successful source.
           */
          if (
            result.status ===
            "fulfilled"
          ) {
            /*
             * Make sure the returned value is actually an array.
             */
            if (
              Array.isArray(
                result.value
              )
            ) {
              combined.push(
                ...result.value
              );
            }

            return;
          }

          /*
           * Failed source.
           */
          failedSources.push(
            tasks[index]?.source ||
              "Search source"
          );
        }
      );


      /*
       * ========================================================
       * REMOVE INVALID RESULTS
       * ========================================================
       *
       * This additional safety check prevents a malformed source
       * record from causing rendering problems.
       */
      combined =
        combined.filter(
          (result) =>
            result &&
            typeof result === "object" &&
            result.id &&
            (
              result.text ||
              result.title
            )
        );


      /*
       * ========================================================
       * OPTIONAL SEMANTIC AI RANKING
       * ========================================================
       *
       * AI ranking is intentionally isolated from the primary
       * search process.
       *
       * If the browser AI model cannot load, the normal search
       * results remain available.
       */
      if (
        nextMode === "semantic" &&
        combined.length
      ) {
        /*
         * Show AI loading state.
         */
        setAiLoading(true);

        try {
          /*
           * Only send a manageable number of results to the
           * semantic ranking layer.
           */
          const semanticInput =
            combined.slice(0, 8);

          /*
           * Try browser-based semantic ranking.
           */
          const ranked =
            await semanticRank(
              clean,
              semanticInput
            );

          /*
           * Only replace the results if semanticRank actually
           * returned a valid array.
           */
          if (
            Array.isArray(ranked)
          ) {
            combined = ranked;
          }
        } catch {
          /*
           * IMPORTANT:
           *
           * Semantic AI is optional.
           *
           * If Transformers.js, the model, browser storage,
           * WebGPU/WASM or network loading fails, continue with
           * the normal keyword results.
           */
          setError(
            "Semantic AI was unavailable, so standard search results are shown instead."
          );
        } finally {
          /*
           * Always stop the AI loading state.
           */
          setAiLoading(false);
        }
      }


      /*
       * ========================================================
       * DISPLAY RESULTS
       * ========================================================
       */

      setResults(combined);


      /*
       * ========================================================
       * SOURCE FAILURE MESSAGE
       * ========================================================
       *
       * If at least one source failed but another source returned
       * results, show a non-blocking informational message.
       */
      if (
        failedSources.length &&
        combined.length
      ) {
        setError(
          `${failedSources.join(
            ", "
          )} ${
            failedSources.length === 1
              ? "source was"
              : "sources were"
          } temporarily unavailable. Showing available results.`
        );
      }


      /*
       * If every requested source failed, provide a clear error
       * instead of leaving the user wondering why the screen is
       * empty.
       */
      if (
        tasks.length > 0 &&
        failedSources.length ===
          tasks.length
      ) {
        setError(
          "Search services are temporarily unavailable. Please check your internet connection and try again."
        );
      }
    } catch (searchError) {
      /*
       * ========================================================
       * UNEXPECTED SEARCH ERROR
       * ========================================================
       *
       * This is a final safety net.
       *
       * Even if an unexpected programming/runtime error occurs
       * during the search process, the React UI should remain
       * usable.
       */

      console.error(
        "Nur Search error:",
        searchError
      );

      /*
       * Clear potentially invalid results.
       */
      setResults([]);

      /*
       * Display a friendly error.
       */
      setError(
        searchError?.message ||
          "Search failed unexpectedly. Please try again."
      );

      /*
       * Make sure AI loading is stopped.
       */
      setAiLoading(false);
    } finally {
      /*
       * Always stop the main loading state.
       */
      setLoading(false);
    }
  }


  /*
   * ============================================================
   * BOOKMARK HANDLER
   * ============================================================
   */
  function toggleBookmark(result) {
    /*
     * Ignore invalid results.
     */
    if (!result?.id) {
      return;
    }

    setBookmarks(
      (previous) => {
        /*
         * Determine whether this result is already bookmarked.
         */
        const exists =
          previous.some(
            (item) =>
              item?.id === result.id
          );

        /*
         * Remove an existing bookmark.
         */
        if (exists) {
          return previous.filter(
            (item) =>
              item?.id !== result.id
          );
        }

        /*
         * Add a new bookmark.
         */
        return [
          ...previous,
          result,
        ];
      }
    );
  }


  /*
   * ============================================================
   * COPY RESULT HANDLER
   * ============================================================
   */
  async function copyResult(result) {
    /*
     * Build the text that should be copied.
     */
    const text =
      `${result?.text || ""}\n\n` +
      `— ${
        result?.reference ||
        result?.title ||
        "Nur Search"
      }\n` +
      `Source: ${
        result?.source ||
        "Unknown"
      }`;

    try {
      /*
       * Clipboard API may be unavailable in some browsers or
       * insecure contexts.
       */
      if (
        !navigator.clipboard ||
        !navigator.clipboard.writeText
      ) {
        throw new Error(
          "Clipboard access is unavailable."
        );
      }

      /*
       * Copy the result.
       */
      await navigator.clipboard.writeText(
        text
      );

      /*
       * Display the copied state.
       */
      setCopiedId(
        result.id
      );

      /*
       * Restore the normal icon after a short delay.
       */
      window.setTimeout(
        () =>
          setCopiedId(""),
        1400
      );
    } catch (copyError) {
      /*
       * Log the error for debugging without breaking the app.
       */
      console.warn(
        "Unable to copy result:",
        copyError
      );

      /*
       * Show a useful UI error.
       */
      setError(
        "Unable to copy this result. Please copy the text manually."
      );
    }
  }


  /*
   * ============================================================
   * TOPIC SELECTION
   * ============================================================
   */
  function chooseTopic(topic) {
    /*
     * Verify the topic contains a usable query.
     */
    const topicQuery =
      String(
        topic?.query || ""
      ).trim();

    if (!topicQuery) {
      return;
    }

    /*
     * Update the visible search box.
     */
    setQuery(topicQuery);

    /*
     * Immediately search the selected topic.
     */
    runSearch(
      topicQuery,
      "all",
      "hybrid"
    );
  }


  /*
   * ============================================================
   * MAIN UI
   * ============================================================
   */

  return (
    <div className="app-shell">

      {/* Decorative blurred background element. */}
      <div
        className="ambient ambient-one"
        aria-hidden="true"
      />

      {/* Second decorative background element. */}
      <div
        className="ambient ambient-two"
        aria-hidden="true"
      />

      {/* Decorative star field. */}
      <div
        className="star-field"
        aria-hidden="true"
      >
        {Array.from({
          length: 26,
        }).map((_, index) => (
          <span
            key={index}
            className="star"
            style={{
              "--i": index,
            }}
          />
        ))}
      </div>


      {/* ======================================================
          HEADER
          ====================================================== */}

      <header className="site-header">

        {/* Application brand. */}
        <a
          className="brand"
          href="#"
          onClick={(event) => {
            /*
             * Prevent the browser from changing the page hash.
             */
            event.preventDefault();

            /*
             * Scroll back to the top.
             */
            window.scrollTo({
              top: 0,
              behavior: "smooth",
            });

            /*
             * Close the mobile menu if it is open.
             */
            setMenuOpen(false);
          }}
        >
          <span className="brand-mark">
            ☾
          </span>

          <span>
            <strong>
              Nur Search
            </strong>

            <small>
              Quran &amp; Sunnah
            </small>
          </span>
        </a>


        {/* Main navigation. */}
        <nav
          className={`nav-links ${
            menuOpen ? "open" : ""
          }`}
        >
          <a href="#search">
            Search
          </a>

          <a href="#topics">
            Topics
          </a>

          <a href="#sources">
            Sources
          </a>

          <a href="#about">
            About
          </a>
        </nav>


        {/* Header controls. */}
        <div className="header-actions">

          {/* Theme switch. */}
          <button
            className="icon-button"
            aria-label="Toggle theme"
            onClick={() =>
              setTheme(
                (previous) =>
                  previous ===
                  "dark"
                    ? "light"
                    : "dark"
              )
            }
          >
            {theme === "dark" ? (
              <Sun size={18} />
            ) : (
              <Moon size={18} />
            )}
          </button>


          {/* Mobile navigation button. */}
          <button
            className="icon-button mobile-menu"
            aria-label={
              menuOpen
                ? "Close menu"
                : "Open menu"
            }
            onClick={() =>
              setMenuOpen(
                (previous) =>
                  !previous
              )
            }
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
            HERO SECTION
            ==================================================== */}

        <section
          className="hero"
          id="search"
        >

          {/* Decorative symbol. */}
          <div
            className="hero-ornament"
            aria-hidden="true"
          >
            ✦
          </div>


          {/* Section label. */}
          <p className="eyebrow">
            <Sparkles size={15} />
            Source-first Islamic search
          </p>


          {/* Main heading. */}
          <h1>
            Search the light of
            <br />
            <span>
              Quran &amp; Sunnah.
            </span>
          </h1>


          {/* Application description. */}
          <p className="hero-copy">
            Explore Quran verses,
            hadith and live web
            discovery with a calm,
            source-focused interface
            and optional browser AI.
          </p>


          {/* Main search form. */}
          <SearchBox
            query={query}
            setQuery={setQuery}
            onSubmit={() =>
              runSearch()
            }
            loading={loading}
          />


          {/* Popular searches. */}
          <div className="popular-row">
            <span>
              Explore:
            </span>

            {popularSearches.map(
              (item) => (
                <button
                  key={item}
                  onClick={() =>
                    chooseTopic({
                      query: item,
                    })
                  }
                >
                  {item}
                </button>
              )
            )}
          </div>


          {/* Feature summary. */}
          <div className="hero-stats">

            <div>
              <strong>
                Quran
              </strong>
              <span>
                Live search
              </span>
            </div>

            <div>
              <strong>
                Hadith
              </strong>
              <span>
                Browser dataset
              </span>
            </div>

            <div>
              <strong>
                AI
              </strong>
              <span>
                Optional semantic mode
              </span>
            </div>

            <div>
              <strong>
                Web
              </strong>
              <span>
                Live discovery
              </span>
            </div>

          </div>
        </section>


        {/* ====================================================
            SEARCH WORKSPACE
            ==================================================== */}

        <section className="search-workspace">

          {/* Results heading. */}
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


            {/* Clear results button. */}
            {submittedQuery && (
              <button
                className="clear-button"
                onClick={() => {
                  /*
                   * Reset all search-related display state.
                   */
                  setSubmittedQuery("");
                  setResults([]);
                  setError("");
                  setAiLoading(false);
                }}
              >
                Clear results
              </button>
            )}

          </div>


          {/* ==================================================
              FILTERS
              ================================================== */}

          <div className="filter-row">

            {/* Source filters. */}
            {[
              ["all", "All"],
              ["quran", "Quran"],
              ["hadith", "Hadith"],
              ["web", "Web"],
            ].map(
              ([value, label]) => (
                <button
                  key={value}
                  className={`filter-chip ${
                    filter === value
                      ? "active"
                      : ""
                  }`}
                  onClick={() => {
                    /*
                     * Update the selected filter.
                     */
                    setFilter(value);

                    /*
                     * If a query is already active, search it
                     * immediately with the new filter.
                     */
                    if (
                      submittedQuery
                    ) {
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
              )
            )}


            {/* Divider. */}
            <span className="filter-divider" />


            {/* Search ranking modes. */}
            {[
              ["hybrid", "Smart"],
              [
                "semantic",
                "AI Semantic",
              ],
            ].map(
              ([value, label]) => (
                <button
                  key={value}
                  className={`mode-chip ${
                    mode === value
                      ? "active"
                      : ""
                  }`}
                  onClick={() => {
                    /*
                     * Update selected mode.
                     */
                    setMode(value);

                    /*
                     * Rerun the current query when results already
                     * exist.
                     */
                    if (
                      submittedQuery
                    ) {
                      runSearch(
                        submittedQuery,
                        filter,
                        value
                      );
                    }
                  }}
                >
                  <Sparkles
                    size={14}
                  />

                  {label}
                </button>
              )
            )}

          </div>


          {/* ==================================================
              AI STATUS
              ================================================== */}

          {aiLoading && (
            <div className="ai-status">
              <Sparkles size={16} />
              Browser AI is ranking
              the results…
            </div>
          )}


          {/* ==================================================
              ERROR / INFORMATION MESSAGE
              ================================================== */}

          {error && (
            <div
              className="error-box"
              role="status"
            >
              {error}
            </div>
          )}


          {/* ==================================================
              RESULTS
              ==================================================
              
              The interface always displays one of:
              
              1. Loading skeleton
              2. Search results
              3. Empty state
              */}

          {loading ? (
            <div className="result-grid">

              {[1, 2, 3].map(
                (item) => (
                  <SkeletonCard
                    key={item}
                  />
                )
              )}

            </div>
          ) : results.length ? (
            <div className="result-grid">

              {results.map(
                (result) => (
                  <ResultCard
                    key={result.id}
                    result={result}
                    bookmarked={bookmarks.some(
                      (item) =>
                        item?.id ===
                        result.id
                    )}
                    copied={
                      copiedId ===
                      result.id
                    }
                    onBookmark={() =>
                      toggleBookmark(
                        result
                      )
                    }
                    onCopy={() =>
                      copyResult(
                        result
                      )
                    }
                  />
                )
              )}

            </div>
          ) : (
            <EmptyState
              submitted={
                submittedQuery
              }
              history={history}
              onSearch={(
                value
              ) =>
                runSearch(
                  value,
                  filter,
                  mode
                )
              }
            />
          )}

        </section>


        {/* ====================================================
            TOPICS
            ==================================================== */}

        <section
          className="topics-section"
          id="topics"
        >

          <div className="section-heading">

            <p className="section-kicker">
              Explore by meaning
            </p>

            <h2>
              Topics for reflection
            </h2>

            <p>
              Start with a theme and
              let the search engine
              discover related sources.
            </p>

          </div>


          <div className="topic-grid">

            {topics.map(
              (topic) => (
                <button
                  className="topic-card"
                  key={topic.title}
                  onClick={() =>
                    chooseTopic(
                      topic
                    )
                  }
                >

                  <span className="topic-icon">
                    <Star size={18} />
                  </span>

                  <span>
                    <strong>
                      {topic.title}
                    </strong>

                    <small>
                      {topic.description}
                    </small>
                  </span>

                  <ChevronRight
                    size={18}
                  />

                </button>
              )
            )}

          </div>
        </section>


        {/* ====================================================
            ABOUT / FEATURES
            ==================================================== */}

        <section
          className="features-section"
          id="about"
        >

          <div className="feature-panel">

            <div>

              <p className="section-kicker">
                Built for clarity
              </p>

              <h2>
                AI helps find sources.
                <br />
                <span>
                  Sources remain the
                  authority.
                </span>
              </h2>

              <p>
                Nur Search separates
                primary source results
                from web discovery and
                keeps generated search
                intelligence visibly
                distinct from source text.
              </p>

            </div>


            <div className="feature-list">

              <Feature
                icon={
                  <Search />
                }
                title="Hybrid search"
                text="Keyword, source and semantic discovery in one workflow."
              />

              <Feature
                icon={
                  <BookOpen />
                }
                title="Source-first results"
                text="Reference, collection and external source information stay visible."
              />

              <Feature
                icon={
                  <Languages />
                }
                title="Multilingual-ready"
                text="The UI is prepared for Arabic, English and Urdu expansion."
              />

              <Feature
                icon={
                  <Bookmark />
                }
                title="Private bookmarks"
                text="Bookmarks and history stay in the user's browser."
              />

            </div>

          </div>
        </section>


        {/* ====================================================
            SOURCES
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
              Data &amp; technology
              sources
            </h2>

          </div>


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
          Frontend-only • GitHub Pages
          ready • No application backend
        </span>

      </footer>

    </div>
  );
}


/*
 * ============================================================
 * SEARCH BOX
 * ============================================================
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
         * Prevent normal browser form submission/reload.
         */
        event.preventDefault();

        /*
         * Do not submit an empty query.
         */
        if (!String(query || "").trim()) {
          return;
        }

        /*
         * Start the React search process.
         */
        onSubmit();
      }}
    >

      {/* Search icon. */}
      <Search size={22} />

      {/* Search input. */}
      <input
        value={query}
        onChange={(event) =>
          setQuery(
            event.target.value
          )
        }
        placeholder="What are you seeking?"
        aria-label="Search Quran and Sunnah"
        autoComplete="off"
      />

      {/* Search button. */}
      <button
        type="submit"
        disabled={
          loading ||
          !String(
            query || ""
          ).trim()
        }
      >
        {loading
          ? "Searching…"
          : "Search"}
      </button>

    </form>
  );
}


/*
 * ============================================================
 * RESULT CARD
 * ============================================================
 */
function ResultCard({
  result,
  bookmarked,
  copied,
  onBookmark,
  onCopy,
}) {
  /*
   * Convert internal result types into user-friendly labels.
   */
  const typeLabel =
    result.type === "quran"
      ? "QURAN"
      : result.type === "hadith"
        ? "HADITH"
        : "WEB";


  /*
   * Calculate the displayed match percentage.
   *
   * Semantic score:
   * 0.87 -> 87%
   *
   * Normal score is used as a fallback.
   */
  const semanticPercent =
    typeof result.semanticScore ===
      "number"
      ? Math.round(
          result.semanticScore *
            100
        )
      : Number(
          result.score || 0
        );


  return (
    <article
      className={`result-card ${result.type}`}
    >

      {/* Result header. */}
      <div className="result-topline">

        <span className="source-badge">
          {typeLabel}
        </span>

        <span className="result-reference">
          {result.reference ||
            result.title ||
            "Source"}
        </span>

      </div>


      {/* Result title. */}
      <h3>
        {result.title ||
          "Search result"}
      </h3>


      {/* Optional subtitle. */}
      {result.subtitle && (
        <p className="result-subtitle">
          {result.subtitle}
        </p>
      )}


      {/* Optional Arabic/source text. */}
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
        {result.text ||
          "No text available."}
      </p>


      {/* Result metadata. */}
      <div className="result-meta">

        <span>
          {result.source ||
            "Unknown source"}
        </span>

        {semanticPercent > 0 && (
          <span>
            Match{" "}
            {semanticPercent}%
          </span>
        )}

      </div>


      {/* Result action buttons. */}
      <div className="result-actions">

        {/* Open original source. */}
        {result.sourceUrl ? (
          <a
            href={result.sourceUrl}
            target="_blank"
            rel="noreferrer"
          >
            Open source
            <ExternalLink
              size={14}
            />
          </a>
        ) : (
          <span>
            Source unavailable
          </span>
        )}


        {/* Copy button. */}
        <button
          type="button"
          onClick={onCopy}
          aria-label="Copy result"
        >
          {copied ? (
            <Check size={16} />
          ) : (
            <Copy size={16} />
          )}
        </button>


        {/* Bookmark button. */}
        <button
          type="button"
          className={
            bookmarked
              ? "bookmarked"
              : ""
          }
          onClick={onBookmark}
          aria-label={
            bookmarked
              ? "Remove bookmark"
              : "Bookmark result"
          }
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
 * EMPTY STATE
 * ============================================================
 */
function EmptyState({
  submitted,
  history,
  onSearch,
}) {
  /*
   * When there is no active search but history exists,
   * show recent searches.
   */
  if (
    !submitted &&
    history.length
  ) {
    return (
      <div className="empty-state">

        <History size={28} />

        <h3>
          Continue exploring
        </h3>

        <p>
          Your recent searches are
          stored privately in this
          browser.
        </p>


        <div className="history-list">

          {history
            .slice(0, 5)
            .map((item) => (
              <button
                key={item}
                onClick={() =>
                  onSearch(item)
                }
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
 * SKELETON CARD
 * ============================================================
 *
 * Displayed while APIs are being queried.
 */
function SkeletonCard() {
  return (
    <div
      className="result-card skeleton"
      aria-hidden="true"
    >
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
 */
function Feature({
  icon,
  title,
  text,
}) {
  return (
    <div className="feature-item">

      {/* Feature icon. */}
      <span>
        {icon}
      </span>

      {/* Feature content. */}
      <div>
        <strong>
          {title}
        </strong>

        <small>
          {text}
        </small>
      </div>

    </div>
  );
}


/*
 * ============================================================
 * SOURCE BOX
 * ============================================================
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

      {/* Source name. */}
      <strong>
        {title}
      </strong>

      {/* Source explanation. */}
      <p>
        {text}
      </p>

      {/* Documentation link indicator. */}
      <span>
        View documentation
        <ExternalLink
          size={14}
        />
      </span>

    </a>
  );
}