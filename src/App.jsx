// ============================================================================
// Nur Search — Quran & Sunnah Search Engine
// ============================================================================
//
// Main React application component.
//
// This file is responsible for:
//   1. Search interface
//   2. Quran / Hadith / Web filters
//   3. Search execution
//   4. Search history
//   5. Bookmarks
//   6. Theme switching
//   7. Result rendering
//   8. Loading and error states
//   9. Topic suggestions
//
// IMPORTANT ARCHITECTURE NOTE
// ---------------------------
// The actual API/data logic is kept inside:
//
//   src/services/api.js
//
// This component only calls those functions and displays their results.
//
// The optional semantic-AI feature is NOT executed during the normal
// search flow. This is intentional.
//
// A browser-side AI model should never be allowed to crash the core
// Quran/Hadith/Web search experience.
//
// ============================================================================

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Bookmark,
  BookOpen,
  Check,
  ChevronDown,
  Clock3,
  Copy,
  ExternalLink,
  Heart,
  History,
  Info,
  Menu,
  Moon,
  Search,
  Sparkles,
  Sun,
  X,
} from "lucide-react";

import {
  loadHadithEdition,
  searchHadith,
  searchQuran,
  searchWeb,
} from "./services/api";

import { topics } from "./data/topics";


// ============================================================================
// CONSTANTS
// ============================================================================

// localStorage keys are centralized here so that we do not accidentally
// use different names in different parts of the application.
const STORAGE_KEYS = {
  bookmarks: "nur-search-bookmarks",
  history: "nur-search-history",
  theme: "nur-search-theme",
};


// ============================================================================
// SAFE LOCAL STORAGE HELPERS
// ============================================================================
//
// localStorage normally works in the browser, but it can sometimes contain:
//
//   - invalid JSON
//   - old data from an earlier application version
//   - corrupted values
//   - values written by another version of the application
//
// Calling JSON.parse() directly during React initialization can crash
// the entire React application and result in a blank/black page.
//
// These helpers make localStorage failures non-fatal.
// ============================================================================

/**
 * Safely read an array from localStorage.
 *
 * @param {string} key - localStorage key.
 * @returns {Array} Stored array or an empty array.
 */
function readStorageArray(key) {
  try {
    const value = window.localStorage.getItem(key);

    // No stored value.
    if (!value) {
      return [];
    }

    // Convert JSON text into JavaScript.
    const parsed = JSON.parse(value);

    // Only accept arrays.
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn(
      `Nur Search: unable to read localStorage key "${key}".`,
      error
    );

    // Never allow storage errors to crash the application.
    return [];
  }
}


/**
 * Safely read the saved theme.
 *
 * @returns {"light"|"dark"} Valid theme.
 */
function readStoredTheme() {
  try {
    const value = window.localStorage.getItem(
      STORAGE_KEYS.theme
    );

    return value === "dark" ? "dark" : "light";
  } catch (error) {
    console.warn(
      "Nur Search: unable to read saved theme.",
      error
    );

    return "light";
  }
}


/**
 * Safely write JSON data to localStorage.
 *
 * @param {string} key - Storage key.
 * @param {*} value - Data to serialize.
 */
function writeStorage(key, value) {
  try {
    window.localStorage.setItem(
      key,
      JSON.stringify(value)
    );
  } catch (error) {
    // Storage errors should not break the UI.
    console.warn(
      `Nur Search: unable to save "${key}".`,
      error
    );
  }
}


// ============================================================================
// TEXT HELPERS
// ============================================================================

/**
 * Convert an unknown value into safe display text.
 *
 * @param {*} value - Any JavaScript value.
 * @param {string} fallback - Text used when the value is empty.
 * @returns {string}
 */
function safeText(value, fallback = "") {
  if (value === null || value === undefined) {
    return fallback;
  }

  const text = String(value).trim();

  return text || fallback;
}


/**
 * Safely create a short preview of result text.
 *
 * @param {*} value - Original text.
 * @param {number} length - Maximum number of characters.
 * @returns {string}
 */
function createPreview(value, length = 420) {
  const text = safeText(value);

  if (text.length <= length) {
    return text;
  }

  return `${text.slice(0, length).trim()}…`;
}


// ============================================================================
// RESULT TYPE HELPERS
// ============================================================================

/**
 * Return the human-readable name for a result type.
 *
 * @param {string} type - Result type.
 * @returns {string}
 */
function getResultTypeName(type) {
  switch (type) {
    case "quran":
      return "Quran";

    case "hadith":
      return "Hadith";

    case "web":
      return "Web";

    default:
      return "Source";
  }
}


/**
 * Return a suitable icon for a result type.
 *
 * @param {string} type - Result type.
 * @returns {JSX.Element}
 */
function ResultTypeIcon({ type }) {
  if (type === "quran") {
    return <BookOpen size={15} />;
  }

  if (type === "hadith") {
    return <BookOpen size={15} />;
  }

  return <ExternalLink size={15} />;
}


// ============================================================================
// MAIN APPLICATION
// ============================================================================

export default function App() {
  // --------------------------------------------------------------------------
  // SEARCH STATE
  // --------------------------------------------------------------------------

  // Current text inside the search input.
  const [query, setQuery] = useState("");

  // Query that was actually submitted.
  //
  // This is separate from "query" so typing does not immediately change
  // the displayed "results for..." heading.
  const [submittedQuery, setSubmittedQuery] = useState("");

  // Current source filter.
  //
  // Possible values:
  //   all
  //   quran
  //   hadith
  //   web
  const [filter, setFilter] = useState("all");

  // Search mode.
  //
  // "hybrid" is retained for the UI because the project can later add
  // semantic search again.
  //
  // IMPORTANT:
  // The basic search does not depend on an AI model.
  const [mode, setMode] = useState("hybrid");

  // Search result records.
  const [results, setResults] = useState([]);

  // Indicates that a search is currently running.
  const [loading, setLoading] = useState(false);

  // Kept as a separate state for compatibility with the application's
  // AI/semantic UI. It remains false during the stable basic-search flow.
  const [aiLoading, setAiLoading] = useState(false);

  // Error/warning message displayed above the results.
  const [error, setError] = useState("");

  // --------------------------------------------------------------------------
  // APPLICATION STATE
  // --------------------------------------------------------------------------

  // Theme is loaded safely from browser storage.
  const [theme, setTheme] = useState(readStoredTheme);

  // Saved result IDs.
  const [bookmarks, setBookmarks] = useState(() =>
    readStorageArray(STORAGE_KEYS.bookmarks)
  );

  // Recent search queries.
  const [history, setHistory] = useState(() =>
    readStorageArray(STORAGE_KEYS.history)
  );

  // Mobile navigation menu state.
  const [menuOpen, setMenuOpen] = useState(false);

  // ID of the result that was most recently copied.
  //
  // This lets us temporarily change the Copy button to "Copied".
  const [copiedId, setCopiedId] = useState(null);

  // --------------------------------------------------------------------------
  // SEARCH REQUEST CONTROL
  // --------------------------------------------------------------------------
  //
  // Imagine this sequence:
  //
  //   Search A starts
  //   Search B starts before Search A finishes
  //   Search A finishes
  //
  // Without protection, Search A could overwrite Search B's results.
  //
  // The ref stores the ID of the newest search request.
  // --------------------------------------------------------------------------

  const searchRequestId = useRef(0);


  // ==========================================================================
  // EFFECTS
  // ==========================================================================

  /**
   * Apply the selected theme to the document.
   *
   * The CSS can use:
   *
   *   .dark
   *
   * or:
   *
   *   [data-theme="dark"]
   *
   * depending on the project's stylesheet.
   */
  useEffect(() => {
    document.documentElement.setAttribute(
      "data-theme",
      theme
    );

    document.documentElement.classList.toggle(
      "dark",
      theme === "dark"
    );

    // Save the preference safely.
    try {
      window.localStorage.setItem(
        STORAGE_KEYS.theme,
        theme
      );
    } catch (error) {
      console.warn(
        "Nur Search: unable to save theme.",
        error
      );
    }
  }, [theme]);


  /**
   * Save bookmarks whenever they change.
   */
  useEffect(() => {
    writeStorage(
      STORAGE_KEYS.bookmarks,
      bookmarks
    );
  }, [bookmarks]);


  /**
   * Save search history whenever it changes.
   */
  useEffect(() => {
    writeStorage(
      STORAGE_KEYS.history,
      history
    );
  }, [history]);


  // ==========================================================================
  // DERIVED DATA
  // ==========================================================================

  /**
   * Filter results on the client side.
   *
   * This provides an additional safety layer even though the API search
   * already tries to request only the selected sources.
   */
  const visibleResults = useMemo(() => {
    if (!Array.isArray(results)) {
      return [];
    }

    if (filter === "all") {
      return results;
    }

    return results.filter(
      (result) => result?.type === filter
    );
  }, [results, filter]);


  /**
   * Count results by source.
   */
  const resultCounts = useMemo(() => {
    const counts = {
      all: 0,
      quran: 0,
      hadith: 0,
      web: 0,
    };

    if (!Array.isArray(results)) {
      return counts;
    }

    results.forEach((result) => {
      counts.all += 1;

      if (result?.type === "quran") {
        counts.quran += 1;
      }

      if (result?.type === "hadith") {
        counts.hadith += 1;
      }

      if (result?.type === "web") {
        counts.web += 1;
      }
    });

    return counts;
  }, [results]);


  // ==========================================================================
  // SEARCH FUNCTION
  // ==========================================================================

  /**
   * Execute a search.
   *
   * This is intentionally designed so that a failure in one source
   * does NOT crash the entire application.
   *
   * For example:
   *
   *   Quran     -> success
   *   Hadith    -> timeout
   *   Wikipedia -> success
   *
   * The user still receives Quran + Wikipedia results.
   */
  const runSearch = async (
    value = query,
    nextFilter = filter,
    nextMode = mode
  ) => {
    // Always normalize the search text.
    const cleanQuery = safeText(value);

    // Empty search should simply do nothing.
    if (!cleanQuery) {
      setError("Please enter something to search.");

      return;
    }

    // Create an ID for this search.
    const requestId = ++searchRequestId.current;

    // Update UI immediately.
    setQuery(cleanQuery);
    setSubmittedQuery(cleanQuery);
    setFilter(nextFilter);
    setMode(nextMode);

    setLoading(true);
    setAiLoading(false);
    setError("");
    setResults([]);
    setMenuOpen(false);
    setCopiedId(null);


    // ------------------------------------------------------------------------
    // SAVE SEARCH HISTORY
    // ------------------------------------------------------------------------

    setHistory((previous) => {
      // Make sure old storage data cannot break this operation.
      const previousHistory = Array.isArray(previous)
        ? previous
        : [];

      // Remove duplicate versions of this search.
      const withoutDuplicate = previousHistory.filter(
        (item) =>
          safeText(item).toLowerCase() !==
          cleanQuery.toLowerCase()
      );

      // Put newest search at the beginning.
      return [
        cleanQuery,
        ...withoutDuplicate,
      ].slice(0, 10);
    });


    // ------------------------------------------------------------------------
    // BUILD SOURCE TASKS
    // ------------------------------------------------------------------------

    const sourceTasks = [];

    // Quran search.
    if (
      nextFilter === "all" ||
      nextFilter === "quran"
    ) {
      sourceTasks.push({
        name: "Quran",

        run: () => searchQuran(cleanQuery),
      });
    }


    // Hadith search.
    if (
      nextFilter === "all" ||
      nextFilter === "hadith"
    ) {
      sourceTasks.push({
        name: "Hadith",

        run: async () => {
          // Download the Bukhari English dataset.
          const edition = await loadHadithEdition(
            "eng-bukhari"
          );

          // Search the downloaded dataset locally.
          return searchHadith(
            edition,
            cleanQuery
          );
        },
      });
    }


    // Wikipedia/web search.
    if (
      nextFilter === "all" ||
      nextFilter === "web"
    ) {
      sourceTasks.push({
        name: "Web",

        run: () => searchWeb(cleanQuery),
      });
    }


    // ------------------------------------------------------------------------
    // EXECUTE ALL SOURCES
    // ------------------------------------------------------------------------
    //
    // Each source has its own try/catch.
    //
    // This is extremely important for reliability.
    //
    // A failure from one external service will not reject the entire search.
    // ------------------------------------------------------------------------

    try {
      const settled = await Promise.all(
        sourceTasks.map(async (source) => {
          try {
            const sourceResults = await source.run();

            return {
              name: source.name,

              results: Array.isArray(sourceResults)
                ? sourceResults
                : [],

              error: null,
            };
          } catch (sourceError) {
            // Log the real technical error for debugging.
            console.error(
              `Nur Search: ${source.name} search failed.`,
              sourceError
            );

            return {
              name: source.name,

              results: [],

              error:
                sourceError instanceof Error
                  ? sourceError.message
                  : "Unknown error",
            };
          }
        })
      );


      // ----------------------------------------------------------------------
      // PREVENT OLD SEARCHES FROM OVERWRITING NEW SEARCHES
      // ----------------------------------------------------------------------

      if (
        requestId !== searchRequestId.current
      ) {
        return;
      }


      // ----------------------------------------------------------------------
      // COMBINE RESULTS
      // ----------------------------------------------------------------------

      const combinedResults = settled.flatMap(
        (source) => source.results
      );


      // ----------------------------------------------------------------------
      // REMOVE DUPLICATE RESULT IDs
      // ----------------------------------------------------------------------

      const uniqueResults = Array.from(
        new Map(
          combinedResults.map(
            (result, index) => [
              result?.id ||
                `${result?.type || "result"}-${index}`,

              result,
            ]
          )
        ).values()
      );


      // ----------------------------------------------------------------------
      // STORE RESULTS
      // ----------------------------------------------------------------------

      setResults(uniqueResults);


      // ----------------------------------------------------------------------
      // HANDLE SOURCE ERRORS
      // ----------------------------------------------------------------------

      const failedSources = settled.filter(
        (source) => source.error
      );


      if (failedSources.length > 0) {
        const failedNames = failedSources
          .map((source) => source.name)
          .join(", ");


        if (uniqueResults.length > 0) {
          // Some services failed, but useful results exist.
          setError(
            `${failedNames} search is temporarily unavailable. ` +
              "Showing results from the available sources."
          );
        } else {
          // Everything failed.
          setError(
            `Search services are unavailable: ${failedNames}. ` +
              "Please check your internet connection and try again."
          );
        }
      } else {
        // No API errors.
        setError("");
      }
    } catch (searchError) {
      // Final safety net.
      //
      // This should almost never be reached because every source already
      // has its own error handling, but it protects the React UI from
      // unexpected failures.
      console.error(
        "Nur Search: unexpected search error.",
        searchError
      );


      if (
        requestId === searchRequestId.current
      ) {
        setResults([]);

        setError(
          searchError instanceof Error
            ? searchError.message
            : "Search failed. Please try again."
        );
      }
    } finally {
      // Only the newest search request is allowed to control loading state.
      if (
        requestId === searchRequestId.current
      ) {
        setLoading(false);
        setAiLoading(false);
      }
    }
  };


  // ==========================================================================
  // FORM SUBMISSION
  // ==========================================================================

  /**
   * Handle the main search form.
   */
  const handleSearchSubmit = (event) => {
    // Prevent browser page reload.
    event.preventDefault();

    // Run the current search.
    runSearch(
      query,
      filter,
      mode
    );
  };


  // ==========================================================================
  // FILTER HANDLING
  // ==========================================================================

  /**
   * Change search source filter.
   *
   * If a search has already been performed, immediately run the same query
   * against the newly selected source.
   */
  const handleFilterChange = (nextFilter) => {
    setFilter(nextFilter);

    if (submittedQuery) {
      runSearch(
        submittedQuery,
        nextFilter,
        mode
      );
    }
  };


  // ==========================================================================
  // TOPIC HANDLING
  // ==========================================================================

  /**
   * Search a predefined topic.
   *
   * The topic data is loaded from src/data/topics.js.
   */
  const chooseTopic = (topic) => {
    // Support both:
    //
    //   topic.query
    //
    // and a plain string if the data file uses strings.
    const topicQuery =
      typeof topic === "string"
        ? topic
        : topic?.query || topic?.title || "";

    if (!topicQuery) {
      return;
    }

    setQuery(topicQuery);

    // Search all supported sources.
    runSearch(
      topicQuery,
      "all",
      "hybrid"
    );
  };


  // ==========================================================================
  // BOOKMARK HANDLING
  // ==========================================================================

  /**
   * Add/remove a result from bookmarks.
   */
  const toggleBookmark = (resultId) => {
    if (!resultId) {
      return;
    }

    setBookmarks((previous) => {
      const current = Array.isArray(previous)
        ? previous
        : [];

      if (current.includes(resultId)) {
        return current.filter(
          (id) => id !== resultId
        );
      }

      return [
        ...current,
        resultId,
      ];
    });
  };


  /**
   * Check whether a result is bookmarked.
   */
  const isBookmarked = (resultId) => {
    return bookmarks.includes(resultId);
  };


  // ==========================================================================
  // COPY HANDLING
  // ==========================================================================

  /**
   * Copy result text to clipboard.
   *
   * navigator.clipboard is not available in every environment.
   * GitHub Pages normally runs under HTTPS, but we still provide a fallback.
   */
  const copyResult = async (result) => {
    const text = [
      result?.title,
      result?.reference,
      result?.text,
      result?.source
        ? `Source: ${result.source}`
        : "",
    ]
      .filter(Boolean)
      .join("\n\n");


    if (!text) {
      return;
    }


    try {
      // Modern browser clipboard API.
      if (
        navigator.clipboard &&
        typeof navigator.clipboard.writeText ===
          "function"
      ) {
        await navigator.clipboard.writeText(text);
      } else {
        // Older-browser fallback.
        const textarea =
          document.createElement("textarea");

        textarea.value = text;

        textarea.setAttribute(
          "readonly",
          ""
        );

        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";

        document.body.appendChild(textarea);

        textarea.select();

        const copied =
          document.execCommand("copy");

        document.body.removeChild(textarea);

        if (!copied) {
          throw new Error(
            "Clipboard operation was rejected."
          );
        }
      }


      // Show temporary success state.
      setCopiedId(result.id);

      window.setTimeout(() => {
        setCopiedId((current) =>
          current === result.id
            ? null
            : current
        );
      }, 1800);
    } catch (copyError) {
      console.error(
        "Nur Search: copy failed.",
        copyError
      );

      setError(
        "The result could not be copied. " +
          "Please select and copy the text manually."
      );
    }
  };


  // ==========================================================================
  // HISTORY HANDLING
  // ==========================================================================

  /**
   * Search a previous query from history.
   */
  const searchHistoryItem = (historyItem) => {
    const value = safeText(historyItem);

    if (!value) {
      return;
    }

    setQuery(value);

    runSearch(
      value,
      "all",
      "hybrid"
    );
  };


  /**
   * Clear all saved search history.
   */
  const clearHistory = () => {
    setHistory([]);
  };


  // ==========================================================================
  // THEME
  // ==========================================================================

  /**
   * Toggle light/dark mode.
   */
  const toggleTheme = () => {
    setTheme((current) =>
      current === "dark"
        ? "light"
        : "dark"
    );
  };


  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <div
      className={`app-shell ${
        theme === "dark"
          ? "theme-dark"
          : "theme-light"
      }`}
    >

      {/* ================================================================== */}
      {/* HEADER                                                             */}
      {/* ================================================================== */}

      <header className="site-header">
        <div className="container header-inner">

          {/* Logo / brand */}
          <button
            type="button"
            className="brand"
            onClick={() => {
              setQuery("");
              setSubmittedQuery("");
              setResults([]);
              setError("");
              setFilter("all");
              setMenuOpen(false);
            }}
            aria-label="Nur Search home"
          >
            <span className="brand-icon">
              <BookOpen size={22} />
            </span>

            <span className="brand-text">
              <strong>Nur Search</strong>
              <small>Quran &amp; Sunnah</small>
            </span>
          </button>


          {/* Desktop navigation */}
          <nav className="desktop-nav">
            <a href="#search">Search</a>
            <a href="#topics">Topics</a>
            <a href="#features">Features</a>
            <a href="#about">About</a>
          </nav>


          {/* Header actions */}
          <div className="header-actions">

            {/* Theme button */}
            <button
              type="button"
              className="icon-button"
              onClick={toggleTheme}
              aria-label={
                theme === "dark"
                  ? "Switch to light mode"
                  : "Switch to dark mode"
              }
              title={
                theme === "dark"
                  ? "Light mode"
                  : "Dark mode"
              }
            >
              {theme === "dark" ? (
                <Sun size={19} />
              ) : (
                <Moon size={19} />
              )}
            </button>


            {/* Mobile menu button */}
            <button
              type="button"
              className="icon-button mobile-menu-button"
              onClick={() =>
                setMenuOpen((current) => !current)
              }
              aria-label="Open menu"
            >
              {menuOpen ? (
                <X size={21} />
              ) : (
                <Menu size={21} />
              )}
            </button>

          </div>

        </div>


        {/* Mobile navigation */}
        {menuOpen && (
          <nav className="mobile-nav">

            <a
              href="#search"
              onClick={() => setMenuOpen(false)}
            >
              Search
            </a>

            <a
              href="#topics"
              onClick={() => setMenuOpen(false)}
            >
              Topics
            </a>

            <a
              href="#features"
              onClick={() => setMenuOpen(false)}
            >
              Features
            </a>

            <a
              href="#about"
              onClick={() => setMenuOpen(false)}
            >
              About
            </a>

          </nav>
        )}

      </header>


      {/* ================================================================== */}
      {/* HERO / SEARCH SECTION                                              */}
      {/* ================================================================== */}

      <main>

        <section
          id="search"
          className="hero-section"
        >
          <div className="container hero-content">

            {/* Small spiritual/brand label */}
            <div className="eyebrow">
              <Sparkles size={15} />
              <span>Knowledge • Reflection • Discovery</span>
            </div>


            {/* Main heading */}
            <h1>
              Search the Quran
              <br />
              <span>&amp; Sunnah</span>
            </h1>


            {/* Hero description */}
            <p className="hero-description">
              Explore Quran verses, Hadith references,
              and helpful web resources from one simple
              search interface.
            </p>


            {/* ============================================================ */}
            {/* SEARCH FORM                                                   */}
            {/* ============================================================ */}

            <form
              className="search-form"
              onSubmit={handleSearchSubmit}
            >

              <div className="search-input-wrapper">

                <Search
                  size={21}
                  className="search-input-icon"
                  aria-hidden="true"
                />

                <input
                  type="search"
                  value={query}
                  onChange={(event) =>
                    setQuery(event.target.value)
                  }
                  placeholder="Search Quran, Hadith, topics..."
                  aria-label="Search Quran and Hadith"
                  autoComplete="off"
                />


                {/* Clear input button */}
                {query && (
                  <button
                    type="button"
                    className="clear-search-button"
                    onClick={() =>
                      setQuery("")
                    }
                    aria-label="Clear search"
                    title="Clear"
                  >
                    <X size={18} />
                  </button>
                )}


                {/* Search button */}
                <button
                  type="submit"
                  className="search-submit-button"
                  disabled={
                    loading ||
                    !query.trim()
                  }
                >
                  <Search size={18} />

                  <span>
                    {loading
                      ? "Searching..."
                      : "Search"}
                  </span>
                </button>

              </div>

            </form>


            {/* ============================================================ */}
            {/* FILTER BUTTONS                                                */}
            {/* ============================================================ */}

            <div className="filter-row">

              <FilterButton
                label="All"
                count={resultCounts.all}
                active={filter === "all"}
                onClick={() =>
                  handleFilterChange("all")
                }
              />

              <FilterButton
                label="Quran"
                count={resultCounts.quran}
                active={filter === "quran"}
                onClick={() =>
                  handleFilterChange("quran")
                }
              />

              <FilterButton
                label="Hadith"
                count={resultCounts.hadith}
                active={filter === "hadith"}
                onClick={() =>
                  handleFilterChange("hadith")
                }
              />

              <FilterButton
                label="Web"
                count={resultCounts.web}
                active={filter === "web"}
                onClick={() =>
                  handleFilterChange("web")
                }
              />

            </div>


            {/* ============================================================ */}
            {/* SEARCH MODE                                                   */}
            {/* ============================================================ */}

            <div className="search-mode-row">

              <span className="search-mode-label">
                <Sparkles size={15} />
                Search mode
              </span>


              <div className="search-mode-buttons">

                <button
                  type="button"
                  className={
                    mode === "hybrid"
                      ? "mode-button active"
                      : "mode-button"
                  }
                  onClick={() =>
                    setMode("hybrid")
                  }
                >
                  Hybrid
                </button>

                <button
                  type="button"
                  className={
                    mode === "keyword"
                      ? "mode-button active"
                      : "mode-button"
                  }
                  onClick={() =>
                    setMode("keyword")
                  }
                >
                  Keyword
                </button>

              </div>

            </div>


            {/* AI status is intentionally informational.
                Basic search does not depend on the AI model. */}
            {aiLoading && (
              <div className="ai-status">
                <Sparkles size={16} />
                <span>
                  Preparing semantic search...
                </span>
              </div>
            )}

          </div>
        </section>


        {/* ================================================================== */}
        {/* RESULTS SECTION                                                    */}
        {/* ================================================================== */}

        {(submittedQuery || loading) && (
          <section className="results-section">

            <div className="container">

              {/* Results heading */}
              <div className="results-header">

                <div>
                  <span className="section-kicker">
                    Search results
                  </span>

                  <h2>
                    {loading
                      ? "Searching..."
                      : submittedQuery
                        ? `Results for "${submittedQuery}"`
                        : "Results"}
                  </h2>
                </div>


                {/* Result count */}
                {!loading &&
                  submittedQuery && (
                    <div className="result-count">
                      {visibleResults.length}{" "}
                      {visibleResults.length === 1
                        ? "result"
                        : "results"}
                    </div>
                  )}

              </div>


              {/* ========================================================== */}
              {/* ERROR / INFORMATION BOX                                    */}
              {/* ========================================================== */}

              {error && (
                <div
                  className="error-box"
                  role="status"
                >
                  <Info size={18} />

                  <span>{error}</span>
                </div>
              )}


              {/* ========================================================== */}
              {/* LOADING STATE                                               */}
              {/* ========================================================== */}

              {loading ? (
                <div className="results-list">

                  <SkeletonCard />
                  <SkeletonCard />
                  <SkeletonCard />

                </div>
              ) : visibleResults.length > 0 ? (

                /* ======================================================== */
                /* RESULTS                                                   */
                /* ======================================================== */

                <div className="results-list">

                  {visibleResults.map(
                    (result, index) => (
                      <ResultCard
                        key={
                          result?.id ||
                          `${result?.type || "result"}-${index}`
                        }
                        result={result}
                        bookmarked={isBookmarked(
                          result?.id
                        )}
                        copied={
                          copiedId ===
                          result?.id
                        }
                        onBookmark={
                          toggleBookmark
                        }
                        onCopy={
                          copyResult
                        }
                      />
                    )
                  )}

                </div>

              ) : (

                /* ======================================================== */
                /* EMPTY STATE                                              */
                /* ======================================================== */

                <EmptyState
                  query={submittedQuery}
                  onSearch={runSearch}
                />

              )}

            </div>

          </section>
        )}


        {/* ================================================================== */}
        {/* SEARCH HISTORY                                                     */}
        {/* ================================================================== */}

        {!submittedQuery &&
          history.length > 0 && (
            <section className="history-section">

              <div className="container">

                <div className="section-heading-row">

                  <div>
                    <span className="section-kicker">
                      Your searches
                    </span>

                    <h2>Recent history</h2>
                  </div>

                  <button
                    type="button"
                    className="text-button"
                    onClick={clearHistory}
                  >
                    Clear history
                  </button>

                </div>


                <div className="history-list">

                  {history.map(
                    (historyItem, index) => (
                      <button
                        type="button"
                        className="history-item"
                        key={`${historyItem}-${index}`}
                        onClick={() =>
                          searchHistoryItem(
                            historyItem
                          )
                        }
                      >
                        <Clock3 size={16} />

                        <span>
                          {historyItem}
                        </span>

                        <Search
                          size={15}
                        />
                      </button>
                    )
                  )}

                </div>

              </div>

            </section>
          )}


        {/* ================================================================== */}
        {/* TOPICS                                                             */}
        {/* ================================================================== */}

        <section
          id="topics"
          className="topics-section"
        >
          <div className="container">

            <div className="section-heading">

              <span className="section-kicker">
                Explore
              </span>

              <h2>
                Search popular topics
              </h2>

              <p>
                Start with a topic and explore relevant
                Quran, Hadith, and web results.
              </p>

            </div>


            <div className="topics-grid">

              {Array.isArray(topics) &&
                topics.map((topic, index) => (
                  <TopicCard
                    key={
                      topic?.id ||
                      topic?.query ||
                      topic?.title ||
                      index
                    }
                    topic={topic}
                    onClick={() =>
                      chooseTopic(topic)
                    }
                  />
                ))}

            </div>

          </div>
        </section>


        {/* ================================================================== */}
        {/* FEATURES                                                           */}
        {/* ================================================================== */}

        <section
          id="features"
          className="features-section"
        >
          <div className="container">

            <div className="section-heading">

              <span className="section-kicker">
                Built for discovery
              </span>

              <h2>
                Simple, focused, and useful
              </h2>

              <p>
                Nur Search combines several public
                sources into one clean search experience.
              </p>

            </div>


            <div className="features-grid">

              <Feature
                icon={<BookOpen size={22} />}
                title="Quran Search"
                description={
                  "Search Quran verses using the " +
                  "Al Quran Cloud public API."
                }
              />

              <Feature
                icon={<Heart size={22} />}
                title="Hadith Search"
                description={
                  "Search the downloaded Hadith " +
                  "dataset directly in your browser."
                }
              />

              <Feature
                icon={<ExternalLink size={22} />}
                title="Web Discovery"
                description={
                  "Use Wikipedia as an additional " +
                  "background and discovery source."
                }
              />

              <Feature
                icon={<Bookmark size={22} />}
                title="Bookmarks"
                description={
                  "Save useful search results locally " +
                  "for quick access later."
                }
              />

              <Feature
                icon={<History size={22} />}
                title="Search History"
                description={
                  "Quickly repeat recent searches " +
                  "without typing them again."
                }
              />

              <Feature
                icon={<Sparkles size={22} />}
                title="AI-Ready Architecture"
                description={
                  "The application structure can later " +
                  "support browser-based semantic search."
                }
              />

            </div>

          </div>
        </section>


        {/* ================================================================== */}
        {/* ABOUT                                                              */}
        {/* ================================================================== */}

        <section
          id="about"
          className="about-section"
        >
          <div className="container">

            <div className="about-card">

              <div className="about-icon">
                <BookOpen size={27} />
              </div>

              <div className="about-content">

                <span className="section-kicker">
                  About Nur Search
                </span>

                <h2>
                  A frontend-first Islamic
                  search experience
                </h2>

                <p>
                  Nur Search is designed as a lightweight
                  browser application for discovering
                  Quran verses, Hadith references, and
                  additional educational information.
                </p>

                <p>
                  The application does not require a
                  custom backend for its basic search
                  functionality. Public data services are
                  accessed directly from the browser.
                </p>

              </div>

            </div>

          </div>
        </section>


        {/* ================================================================== */}
        {/* DATA SOURCES                                                       */}
        {/* ================================================================== */}

        <section className="sources-section">

          <div className="container">

            <div className="section-heading">

              <span className="section-kicker">
                Data sources
              </span>

              <h2>
                Where search results come from
              </h2>

            </div>


            <div className="sources-grid">

              <SourceBox
                icon={<BookOpen size={21} />}
                title="Al Quran Cloud"
                description={
                  "Public Quran API used for Quran " +
                  "translation search."
                }
                href="https://alquran.cloud/"
              />

              <SourceBox
                icon={<BookOpen size={21} />}
                title="Fawaz Hadith API"
                description={
                  "Public Hadith dataset distributed " +
                  "through jsDelivr."
                }
                href="https://github.com/fawazahmed0/hadith-api"
              />

              <SourceBox
                icon={<ExternalLink size={21} />}
                title="Wikipedia"
                description={
                  "Additional web-discovery source " +
                  "for background information."
                }
                href="https://www.wikipedia.org/"
              />

            </div>

          </div>

        </section>

      </main>


      {/* ================================================================== */}
      {/* FOOTER                                                             */}
      {/* ================================================================== */}

      <footer className="site-footer">

        <div className="container footer-inner">

          <div className="footer-brand">

            <span className="brand-icon">
              <BookOpen size={19} />
            </span>

            <div>
              <strong>Nur Search</strong>

              <span>
                Quran &amp; Sunnah Search Engine
              </span>
            </div>

          </div>


          <p>
            Built as a frontend-first learning and
            discovery project.
          </p>

        </div>

      </footer>

    </div>
  );
}


// ============================================================================
// FILTER BUTTON
// ============================================================================

/**
 * Source filter button.
 *
 * @param {Object} props - Component properties.
 */
function FilterButton({
  label,
  count,
  active,
  onClick,
}) {
  return (
    <button
      type="button"
      className={
        active
          ? "filter-button active"
          : "filter-button"
      }
      onClick={onClick}
    >
      <span>{label}</span>

      {/* Only show a count when there are results. */}
      {count > 0 && (
        <span className="filter-count">
          {count}
        </span>
      )}
    </button>
  );
}


// ============================================================================
// RESULT CARD
// ============================================================================

/**
 * Display one search result.
 *
 * @param {Object} props - Component properties.
 */
function ResultCard({
  result,
  bookmarked,
  copied,
  onBookmark,
  onCopy,
}) {
  // Protect the component from malformed API records.
  const type = result?.type || "web";

  const title = safeText(
    result?.title,
    "Search result"
  );

  const reference = safeText(
    result?.reference
  );

  const subtitle = safeText(
    result?.subtitle
  );

  const text = safeText(
    result?.text,
    "No text was returned for this result."
  );

  const source = safeText(
    result?.source,
    "Unknown source"
  );

  const sourceUrl = safeText(
    result?.sourceUrl
  );

  // Semantic score is supported if a future semantic-search
  // implementation adds it.
  //
  // The stable basic search does not calculate this score.
  const semanticPercent =
    typeof result?.semanticScore ===
      "number"
      ? Math.round(
          result.semanticScore * 100
        )
      : null;


  return (
    <article className="result-card">

      {/* ================================================================ */}
      {/* RESULT HEADER                                                    */}
      {/* ================================================================ */}

      <div className="result-card-header">

        <div className="result-source-badge">

          <ResultTypeIcon
            type={type}
          />

          <span>
            {getResultTypeName(type)}
          </span>

        </div>


        <div className="result-actions">

          {/* Bookmark */}
          <button
            type="button"
            className={
              bookmarked
                ? "result-action active"
                : "result-action"
            }
            onClick={() =>
              onBookmark(result?.id)
            }
            aria-label={
              bookmarked
                ? "Remove bookmark"
                : "Bookmark result"
            }
            title={
              bookmarked
                ? "Remove bookmark"
                : "Bookmark"
            }
          >
            <Bookmark
              size={17}
              fill={
                bookmarked
                  ? "currentColor"
                  : "none"
            }
            />
          </button>


          {/* Copy */}
          <button
            type="button"
            className="result-action"
            onClick={() =>
              onCopy(result)
            }
            aria-label="Copy result"
            title="Copy"
          >
            {copied ? (
              <Check size={17} />
            ) : (
              <Copy size={17} />
            )}
          </button>

        </div>

      </div>


      {/* ================================================================ */}
      {/* RESULT TITLE                                                      */}
      {/* ================================================================ */}

      <div className="result-heading">

        <h3>
          {title}
        </h3>

        {reference && (
          <span className="result-reference">
            {reference}
          </span>
        )}

      </div>


      {/* ================================================================ */}
      {/* RESULT SUBTITLE                                                   */}
      {/* ================================================================ */}

      {subtitle && (
        <p className="result-subtitle">
          {subtitle}
        </p>
      )}


      {/* ================================================================ */}
      {/* RESULT TEXT                                                       */}
      {/* ================================================================ */}

      <p className="result-text">
        {createPreview(text)}
      </p>


      {/* ================================================================ */}
      {/* RESULT FOOTER                                                     */}
      {/* ================================================================ */}

      <div className="result-card-footer">

        <div className="result-meta">

          <span>
            Source: {source}
          </span>

          {semanticPercent !== null && (
            <span>
              Semantic match:{" "}
              {semanticPercent}%
            </span>
          )}

        </div>


        {/* Open original source */}
        {sourceUrl && (
          <a
            className="source-link"
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open source
            <ExternalLink size={14} />
          </a>
        )}

      </div>

    </article>
  );
}


// ============================================================================
// EMPTY STATE
// ============================================================================

/**
 * Displayed when a search completes without matching results.
 */
function EmptyState({
  query,
  onSearch,
}) {
  return (
    <div className="empty-state">

      <div className="empty-state-icon">
        <Search size={25} />
      </div>

      <h3>
        No results found
      </h3>

      <p>
        We could not find a matching result for{" "}
        <strong>
          "{query || "your search"}"
        </strong>
        .
      </p>

      <p>
        Try a shorter keyword, another spelling,
        or one of the suggested topics below.
      </p>


      {/* Quick search examples */}
      <div className="empty-suggestions">

        <button
          type="button"
          onClick={() =>
            onSearch(
              "patience",
              "all",
              "hybrid"
            )
          }
        >
          patience
        </button>

        <button
          type="button"
          onClick={() =>
            onSearch(
              "prayer",
              "all",
              "hybrid"
            )
          }
        >
          prayer
        </button>

        <button
          type="button"
          onClick={() =>
            onSearch(
              "mercy",
              "all",
              "hybrid"
            )
          }
        >
          mercy
        </button>

      </div>

    </div>
  );
}


// ============================================================================
// SKELETON CARD
// ============================================================================

/**
 * Loading placeholder.
 *
 * Keeping a dedicated component makes the loading UI easier to maintain.
 */
function SkeletonCard() {
  return (
    <div
      className="result-card skeleton-card"
      aria-hidden="true"
    >

      <div className="skeleton-line skeleton-small" />

      <div className="skeleton-line skeleton-title" />

      <div className="skeleton-line" />

      <div className="skeleton-line" />

      <div className="skeleton-line skeleton-medium" />

    </div>
  );
}


// ============================================================================
// TOPIC CARD
// ============================================================================

/**
 * Topic suggestion card.
 */
function TopicCard({
  topic,
  onClick,
}) {
  // Support different topic object shapes.
  const title =
    typeof topic === "string"
      ? topic
      : safeText(
          topic?.title,
          "Explore topic"
        );

  const description =
    typeof topic === "string"
      ? `Search for ${topic}`
      : safeText(
          topic?.description,
          `Search ${title}`
        );

  const query =
    typeof topic === "string"
      ? topic
      : safeText(
          topic?.query,
          title
        );


  return (
    <button
      type="button"
      className="topic-card"
      onClick={onClick}
    >

      <div className="topic-card-icon">
        <Sparkles size={18} />
      </div>

      <div className="topic-card-content">

        <strong>
          {title}
        </strong>

        <span>
          {description}
        </span>

        <small>
          Search: {query}
        </small>

      </div>

      <ChevronDown
        size={17}
        className="topic-card-arrow"
      />

    </button>
  );
}


// ============================================================================
// FEATURE CARD
// ============================================================================

/**
 * Application feature card.
 */
function Feature({
  icon,
  title,
  description,
}) {
  return (
    <article className="feature-card">

      <div className="feature-icon">
        {icon}
      </div>

      <h3>
        {title}
      </h3>

      <p>
        {description}
      </p>

    </article>
  );
}


// ============================================================================
// SOURCE BOX
// ============================================================================

/**
 * Data-source information card.
 */
function SourceBox({
  icon,
  title,
  description,
  href,
}) {
  return (
    <article className="source-box">

      <div className="source-box-icon">
        {icon}
      </div>

      <div className="source-box-content">

        <h3>
          {title}
        </h3>

        <p>
          {description}
        </p>

        {href && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
          >
            Visit source
            <ExternalLink size={14} />
          </a>
        )}

      </div>

    </article>
  );
}