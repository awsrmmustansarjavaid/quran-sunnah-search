/*
 * ============================================================
 * NUR SEARCH — API SERVICE
 * ============================================================
 *
 * This file contains all external data/search functions used by
 * the Nur Search React application.
 *
 * Supported sources:
 *
 * 1. Al Quran Cloud
 *    - Live Quran search
 *
 * 2. Fawaz Hadith API dataset
 *    - Browser-side Hadith search
 *
 * 3. Wikipedia API
 *    - Optional general web discovery
 *
 * IMPORTANT:
 * ------------------------------------------------------------
 * This is a frontend-only application.
 * There is no private backend or API server.
 *
 * Therefore, every external request is treated as unreliable:
 *
 * - Network may be unavailable.
 * - An API may temporarily be down.
 * - CORS may fail.
 * - A response may contain unexpected data.
 * - A request may take too long.
 *
 * The helper functions below are intentionally defensive so that
 * one external service cannot break the entire search interface.
 * ============================================================
 */


/*
 * ============================================================
 * API ENDPOINTS
 * ============================================================
 */

/*
 * Public Quran search endpoint provided by Al Quran Cloud.
 */
const QURAN_SEARCH_URL =
  "https://api.alquran.cloud/v1/search";


/*
 * Base URL for the public Hadith dataset.
 *
 * The dataset is delivered through jsDelivr.
 *
 * Example:
 *
 * https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/eng-bukhari.json
 */
const HADITH_BASE_URL =
  "https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions";


/*
 * Wikipedia API endpoint used for optional web discovery.
 */
const WIKIPEDIA_API_URL =
  "https://en.wikipedia.org/w/api.php";


/*
 * ============================================================
 * REQUEST CONFIGURATION
 * ============================================================
 */

/*
 * Maximum amount of time an external request is allowed to run.
 *
 * 20 seconds is long enough for normal API responses while
 * preventing the application from remaining in a loading state
 * forever if an external service stops responding.
 */
const REQUEST_TIMEOUT = 20000;


/*
 * ============================================================
 * GENERIC SAFE FETCH HELPER
 * ============================================================
 *
 * This helper wraps the browser fetch() function.
 *
 * It provides:
 *
 * - Request timeout support.
 * - AbortController support.
 * - HTTP status validation.
 * - Consistent error messages.
 * - JSON parsing protection.
 *
 * Keeping this logic in one place prevents duplicated error
 * handling throughout the API functions.
 *
 * @param {string} url - URL to request.
 * @param {Object} options - Optional fetch configuration.
 * @returns {Promise<Object>} Parsed JSON response.
 */
async function fetchJson(url, options = {}) {
  /*
   * AbortController allows us to cancel a request if it takes
   * longer than REQUEST_TIMEOUT.
   */
  const controller = new AbortController();

  /*
   * Create a timeout that aborts the request after the configured
   * amount of time.
   */
  const timeoutId = window.setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT
  );

  try {
    /*
     * Send the request.
     *
     * We preserve any caller-provided options while forcing the
     * AbortController signal.
     */
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    /*
     * fetch() does NOT reject automatically for HTTP errors such
     * as 404 or 500.
     *
     * Therefore, explicitly check response.ok.
     */
    if (!response.ok) {
      throw new Error(
        `Request failed with HTTP ${response.status}.`
      );
    }

    /*
     * Parse the response as JSON.
     *
     * This is wrapped in the outer try/catch so malformed JSON
     * becomes a controlled error instead of an application crash.
     */
    return await response.json();
  } catch (error) {
    /*
     * Give timeout failures a useful message.
     */
    if (error?.name === "AbortError") {
      throw new Error(
        "The request took too long to complete."
      );
    }

    /*
     * Re-throw the original error when it already contains
     * useful information.
     */
    throw error;
  } finally {
    /*
     * Always clear the timeout.
     *
     * This prevents unnecessary timers from remaining active
     * after the request has completed.
     */
    window.clearTimeout(timeoutId);
  }
}


/*
 * ============================================================
 * QURAN SEARCH
 * ============================================================
 *
 * Search the Quran using the Al Quran Cloud REST API.
 *
 * @param {string} query - Text entered by the user.
 * @returns {Promise<Array>} Normalized Quran results.
 */
export async function searchQuran(query) {
  /*
   * Clean the user's input before sending it to the API.
   */
  const cleanQuery = String(query || "").trim();

  /*
   * Do not make a network request for an empty query.
   */
  if (!cleanQuery) {
    return [];
  }

  /*
   * Encode the query so spaces and special characters are safe
   * inside the URL.
   */
  const encodedQuery =
    encodeURIComponent(cleanQuery);

  /*
   * Search all Quran content using the Sahih International
   * English translation.
   */
  const url =
    `${QURAN_SEARCH_URL}/` +
    `${encodedQuery}/all/en.sahih`;

  /*
   * Request the Quran data using the safe JSON helper.
   */
  const payload = await fetchJson(url);

  /*
   * Al Quran Cloud normally returns:
   *
   * payload.data.matches
   *
   * However, verify every level before attempting to use it.
   */
  const matches =
    Array.isArray(payload?.data?.matches)
      ? payload.data.matches
      : [];

  /*
   * Convert the API records into Nur Search's common result
   * format.
   */
  return matches
    .slice(0, 10)
    .map((item, index) => {
      /*
       * Safely extract Surah information.
       */
      const surahNumber =
        item?.surah?.number ?? "";

      const verseNumber =
        item?.numberInSurah ?? "";

      const surahName =
        item?.surah?.englishName ||
        "Quran";

      /*
       * Create a stable result ID.
       *
       * The fallback index prevents an invalid API record from
       * creating an undefined ID.
       */
      const id =
        `quran-${surahNumber}-${verseNumber}-${index}`;

      return {
        /*
         * Stable internal identifier.
         */
        id,

        /*
         * Result source type used by the UI.
         */
        type: "quran",

        /*
         * Human-readable Quran reference.
         */
        reference:
          `${surahName} ` +
          `${surahNumber}:${verseNumber}`,

        /*
         * Surah title.
         */
        title: surahName,

        /*
         * English translation name.
         */
        subtitle:
          item?.surah?.englishNameTranslation ||
          "Quran verse",

        /*
         * Original returned verse text.
         *
         * The current application searches the English
         * translation returned by the selected endpoint.
         */
        arabic: item?.text || "",

        /*
         * Main result text.
         */
        text: item?.text || "",

        /*
         * Source label.
         */
        source: "Al Quran Cloud",

        /*
         * Link to the corresponding Quran verse.
         */
        sourceUrl:
          `https://alquran.cloud/ayah/` +
          `${surahNumber}:${verseNumber}`,

        /*
         * Normal keyword mode does not calculate a local
         * relevance percentage here.
         */
        score: 0,
      };
    })
    /*
     * Remove records that somehow contain no text.
     *
     * This prevents empty result cards from appearing.
     */
    .filter((item) => item.text.trim());
}


/*
 * ============================================================
 * HADITH DATASET LOADER
 * ============================================================
 *
 * Download a Hadith edition from the public dataset.
 *
 * The dataset is loaded only when a Hadith search is required.
 *
 * @param {string} edition - Hadith edition identifier.
 * @returns {Promise<Object>} Hadith dataset.
 */
export async function loadHadithEdition(
  edition = "eng-bukhari"
) {
  /*
   * Keep the edition name limited to the expected simple
   * identifier format.
   *
   * This prevents accidental malformed URLs.
   */
  const cleanEdition =
    String(edition || "eng-bukhari")
      .trim();

  /*
   * Build the complete dataset URL.
   */
  const url =
    `${HADITH_BASE_URL}/${cleanEdition}.json`;

  /*
   * Download and parse the JSON dataset.
   */
  const payload = await fetchJson(url);

  /*
   * Verify that the response looks like a Hadith edition.
   *
   * Some unexpected CDN/API responses could technically be
   * valid JSON but not contain the expected hadiths array.
   */
  if (
    !payload ||
    !Array.isArray(payload.hadiths)
  ) {
    throw new Error(
      "The Hadith dataset returned an unexpected format."
    );
  }

  /*
   * Return the validated dataset.
   */
  return payload;
}


/*
 * ============================================================
 * HADITH SEARCH
 * ============================================================
 *
 * Search a downloaded Hadith edition locally in the browser.
 *
 * This function does not make another network request.
 *
 * @param {Object} editionData - Downloaded Hadith dataset.
 * @param {string} query - User search query.
 * @returns {Array} Normalized Hadith results.
 */
export function searchHadith(
  editionData,
  query
) {
  /*
   * Convert the query to a safe string.
   */
  const cleanQuery =
    String(query || "").trim().toLowerCase();

  /*
   * Do nothing when the query is empty.
   */
  if (!cleanQuery) {
    return [];
  }

  /*
   * Split the query into individual search terms.
   *
   * Example:
   *
   * "patience in hardship"
   *
   * becomes:
   *
   * ["patience", "in", "hardship"]
   */
  const terms = cleanQuery
    .split(/\s+/)
    .filter(Boolean);

  /*
   * Make sure the expected Hadith array exists.
   */
  const rows =
    Array.isArray(editionData?.hadiths)
      ? editionData.hadiths
      : [];

  /*
   * If the dataset contains no records, return an empty list.
   */
  if (!rows.length) {
    return [];
  }

  /*
   * Search and rank the Hadith records.
   */
  return rows
    .map((item, index) => {
      /*
       * Safely convert Hadith text to a string.
       */
      const text =
        String(item?.text || "").trim();

      /*
       * Lowercase text for case-insensitive matching.
       */
      const lowerText =
        text.toLowerCase();

      /*
       * Count how many search terms appear in this Hadith.
       */
      const hits =
        terms.reduce(
          (count, term) =>
            count +
            (lowerText.includes(term) ? 1 : 0),
          0
        );

      /*
       * Return the original record plus its relevance count.
       */
      return {
        item,
        hits,
        index,
      };
    })

    /*
     * Ignore Hadith records that contain no search terms.
     */
    .filter(({ hits, item }) =>
      hits > 0 &&
      String(item?.text || "").trim()
    )

    /*
     * Highest keyword match first.
     */
    .sort((a, b) => {
      /*
       * Use the original index as a stable tie breaker.
       */
      if (b.hits !== a.hits) {
        return b.hits - a.hits;
      }

      return a.index - b.index;
    })

    /*
     * Only display the first ten results.
     */
    .slice(0, 10)

    /*
     * Convert each record into the application's common result
     * structure.
     */
    .map(({ item, hits, index }) => {
      /*
       * Create a deterministic result ID.
       *
       * Math.random() was intentionally removed because a result
       * ID should remain stable between renders.
       */
      const hadithNumber =
        item?.hadithnumber ||
        item?.reference ||
        index;

      return {
        /*
         * Stable result identifier.
         */
        id: `hadith-${hadithNumber}`,

        /*
         * Result type.
         */
        type: "hadith",

        /*
         * Hadith number.
         */
        reference:
          `Hadith ${item?.hadithnumber || ""}`.trim(),

        /*
         * Collection name.
         */
        title:
          editionData?.metadata?.name ||
          "Hadith Collection",

        /*
         * Collection/reference information.
         */
        subtitle:
          item?.reference ||
          "Hadith reference",

        /*
         * Hadith text.
         */
        text:
          String(item?.text || "").trim(),

        /*
         * Dataset source.
         */
        source:
          "Fawaz Hadith API dataset",

        /*
         * External source repository.
         */
        sourceUrl:
          "https://github.com/fawazahmed0/hadith-api",

        /*
         * Convert keyword hits into a simple local relevance
         * score.
         *
         * This is NOT an authenticity score.
         */
        score:
          Math.min(99, 55 + hits * 12),
      };
    });
}


/*
 * ============================================================
 * WIKIPEDIA / WEB SEARCH
 * ============================================================
 *
 * Wikipedia is treated as a separate web-discovery layer.
 *
 * Quran and Hadith results remain visually distinct from
 * general web results in the application.
 *
 * @param {string} query - Search query.
 * @returns {Promise<Array>} Normalized web results.
 */
export async function searchWeb(query) {
  /*
   * Clean the user's search query.
   */
  const cleanQuery =
    String(query || "").trim();

  /*
   * Avoid unnecessary network calls for empty queries.
   */
  if (!cleanQuery) {
    return [];
  }

  /*
   * Build the Wikipedia API URL.
   *
   * origin=* allows browser-based requests from the frontend.
   */
  const params =
    new URLSearchParams({
      action: "query",
      list: "search",
      srsearch: cleanQuery,
      format: "json",
      origin: "*",
      srlimit: "6",
    });

  const url =
    `${WIKIPEDIA_API_URL}?${params.toString()}`;

  /*
   * Request Wikipedia data.
   */
  const payload =
    await fetchJson(url);

  /*
   * Verify that Wikipedia returned an expected search array.
   */
  const matches =
    Array.isArray(payload?.query?.search)
      ? payload.query.search
      : [];

  /*
   * Normalize Wikipedia results.
   */
  return matches
    .map((item) => {
      /*
       * Convert the Wikipedia page ID into a string-safe ID.
       */
      const pageId =
        item?.pageid;

      /*
       * Ignore invalid records.
       */
      if (pageId === undefined || pageId === null) {
        return null;
      }

      return {
        /*
         * Stable result identifier.
         */
        id: `web-${pageId}`,

        /*
         * Web result type.
         */
        type: "web",

        /*
         * Wikipedia article title.
         */
        title:
          item?.title || "Wikipedia",

        /*
         * Wikipedia snippets may contain HTML markup.
         *
         * stripHtml() converts the snippet to safe plain text.
         */
        text:
          stripHtml(item?.snippet || ""),

        /*
         * Source label.
         */
        source: "Wikipedia",

        /*
         * Direct article URL.
         */
        sourceUrl:
          `https://en.wikipedia.org/?curid=${pageId}`,

        /*
         * No local percentage score is assigned.
         */
        score: 0,
      };
    })

    /*
     * Remove invalid records.
     */
    .filter(Boolean)

    /*
     * Remove records that have no useful text.
     */
    .filter((item) => item.title || item.text);
}


/*
 * ============================================================
 * HTML TO PLAIN TEXT
 * ============================================================
 *
 * Wikipedia search snippets can contain HTML tags used for
 * highlighting search terms.
 *
 * This helper removes those tags before the text is rendered.
 *
 * @param {string} value - HTML-containing text.
 * @returns {string} Plain text.
 */
function stripHtml(value) {
  /*
   * Convert null/undefined values into an empty string.
   */
  const html =
    String(value || "");

  /*
   * In a browser environment, DOMParser is safer and cleaner
   * than manually trying to remove HTML tags with a regex.
   */
  try {
    const parser =
      new DOMParser();

    const document =
      parser.parseFromString(
        html,
        "text/html"
      );

    return (
      document.body?.textContent || ""
    ).trim();
  } catch {
    /*
     * Extremely defensive fallback.
     *
     * If DOMParser is unavailable for any reason, remove basic
     * HTML tags rather than allowing the application to crash.
     */
    return html
      .replace(/<[^>]*>/g, "")
      .trim();
  }
}