// API helpers are kept separate from the UI components.
// This makes the application easier to maintain because React components
// only need to call functions such as searchQuran(), searchHadith(), and searchWeb().

// Public Quran search endpoint provided by Al Quran Cloud.
const QURAN_SEARCH_URL = "https://api.alquran.cloud/v1/search";

// Base URL for the public Hadith dataset.
// The files are served through jsDelivr, which allows the frontend
// to download the dataset directly without requiring an application backend.
const HADITH_BASE_URL =
  "https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions";

/**
 * Search the Quran using the Al Quran Cloud REST API.
 *
 * The API returns matching Quran verses. We transform those API records
 * into the common result format used by the Nur Search result cards.
 *
 * @param {string} query - Text entered by the user.
 * @returns {Promise<Array>} Normalized Quran search results.
 */
export async function searchQuran(query) {
  // Remove unnecessary whitespace and safely encode the query
  // so it can be included in the API URL.
  const encoded = encodeURIComponent(query.trim());

  // Search all Quran content using the Sahih International English translation.
  const response = await fetch(
    `${QURAN_SEARCH_URL}/${encoded}/all/en.sahih`
  );

  // fetch() only rejects automatically for network failures.
  // Therefore, we explicitly check the HTTP response status.
  if (!response.ok) {
    throw new Error("The Quran search service did not respond.");
  }

  // Convert the HTTP response body into a JavaScript object.
  const payload = await response.json();

  // Normalize the API response into the format expected by ResultCard.
  // Only the first 10 matches are displayed to keep the interface focused.
  return (payload.data?.matches || []).slice(0, 10).map((item) => ({
    // Create a stable ID based on the Quran verse number.
    id: `quran-${item.number}`,

    // Used by the UI to visually identify this as a Quran result.
    type: "quran",

    // Human-readable Quran reference, for example:
    // "Al-Baqarah 2:255".
    reference: `${
      item.surah?.englishName || "Quran"
    } ${item.surah?.number}:${item.numberInSurah}`,

    // Surah name displayed as the main result title.
    title: item.surah?.englishName || "Quran",

    // English translation name displayed below the title.
    subtitle:
      item.surah?.englishNameTranslation || "Quran verse",

    // Keep the returned verse text available as Arabic/source text.
    arabic: item.text,

    // The same text is used as the main searchable result content.
    text: item.text,

    // Human-readable source label shown in the result metadata.
    source: "Al Quran Cloud",

    // Direct link to the corresponding Quran verse.
    sourceUrl: `https://alquran.cloud/ayah/${item.surah?.number}:${item.numberInSurah}`,

    // Quran API results do not receive a local relevance score here.
    // Semantic mode can calculate a separate semantic score later.
    score: 0,
  }));
}

/**
 * Download a Hadith edition from the public Hadith dataset.
 *
 * The dataset is loaded only when the user searches Hadith.
 * This keeps the initial application lighter than downloading the
 * complete Hadith collection during page load.
 *
 * @param {string} edition - Hadith edition identifier.
 * @returns {Promise<Object>} Downloaded Hadith edition data.
 */
export async function loadHadithEdition(edition = "eng-bukhari") {
  // Build the URL for the requested Hadith edition.
  const response = await fetch(`${HADITH_BASE_URL}/${edition}.json`);

  // Explicitly handle HTTP errors returned by the CDN.
  if (!response.ok) {
    throw new Error("The Hadith dataset could not be loaded.");
  }

  // Return the complete dataset to the calling function.
  // searchHadith() will perform the actual browser-side search.
  return response.json();
}

/**
 * Search a downloaded Hadith edition locally in the browser.
 *
 * No private API key or application backend is required.
 * The function performs a simple keyword relevance calculation:
 * every search term found in a Hadith increases its hit count.
 *
 * @param {Object} editionData - Hadith edition downloaded from the API/CDN.
 * @param {string} query - Search query entered by the user.
 * @returns {Array} Normalized and ranked Hadith results.
 */
export function searchHadith(editionData, query) {
  // Convert the search query into lowercase individual words.
  // Empty values are removed so only useful search terms remain.
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  // Make sure the expected Hadith array exists before searching it.
  const rows = Array.isArray(editionData?.hadiths)
    ? editionData.hadiths
    : [];

  return (
    rows

      // Calculate how many search terms appear in each Hadith.
      .map((item) => {
        // Convert the Hadith text to a string to avoid unexpected
        // errors if a dataset record has missing text.
        const text = String(item.text || "");

        // Lowercase the text to make matching case-insensitive.
        const lower = text.toLowerCase();

        // Count how many search terms occur in this Hadith.
        const hits = terms.reduce(
          (count, term) =>
            count + (lower.includes(term) ? 1 : 0),
          0
        );

        // Keep both the original Hadith record and its relevance count.
        return { item, hits };
      })

      // Remove Hadith records that contain none of the search terms.
      .filter(({ hits }) => hits > 0)

      // Show the most keyword-relevant Hadith records first.
      .sort((a, b) => b.hits - a.hits)

      // Limit the number of results displayed in the UI.
      .slice(0, 10)

      // Convert each Hadith record into Nur Search's common result format.
      .map(({ item, hits }) => ({
        // Prefer the official Hadith number for the result ID.
        // The reference is used as a fallback if the number is unavailable.
        id: `hadith-${
          item.hadithnumber ||
          item.reference ||
          Math.random()
        }`,

        // Used by the UI to identify this as a Hadith result.
        type: "hadith",

        // Display the Hadith number when available.
        reference: `Hadith ${item.hadithnumber || ""}`.trim(),

        // Display the name of the downloaded Hadith collection.
        title:
          editionData.metadata?.name ||
          "Hadith Collection",

        // Additional collection/reference information.
        subtitle:
          item.reference ||
          "Hadith reference",

        // Actual Hadith text.
        text: item.text || "",

        // Source displayed in the result metadata.
        source: "Fawaz Hadith API dataset",

        // External link allowing the user to inspect the source dataset.
        sourceUrl:
          "https://github.com/fawazahmed0/hadith-api",

        // Convert keyword hits into a simple relevance score.
        // The score is capped at 99 so it does not look like a
        // guaranteed percentage of correctness or authenticity.
        score: Math.min(99, 55 + hits * 12),
      }))
  );
}

/**
 * Search Wikipedia as a live web-discovery layer.
 *
 * Wikipedia results are intentionally classified as "web" results.
 * This prevents general web content from visually appearing equivalent
 * to Quran or Hadith source material in the application.
 *
 * @param {string} query - Search query entered by the user.
 * @returns {Promise<Array>} Normalized web search results.
 */
export async function searchWeb(query) {
  // Wikipedia's API supports browser requests through origin=*.
  // The search query is URL encoded before being added to the request.
  const url =
    `https://en.wikipedia.org/w/api.php` +
    `?action=query` +
    `&list=search` +
    `&srsearch=${encodeURIComponent(query)}` +
    `&format=json` +
    `&origin=*` +
    `&srlimit=6`;

  // Send the live search request to Wikipedia.
  const response = await fetch(url);

  // Handle HTTP-level failures explicitly.
  if (!response.ok) {
    throw new Error("Web discovery is temporarily unavailable.");
  }

  // Parse Wikipedia's JSON response.
  const payload = await response.json();

  // Convert Wikipedia search records into the common application result format.
  return (payload.query?.search || []).map((item) => ({
    // Wikipedia provides a page ID that works well as a result identifier.
    id: `web-${item.pageid}`,

    // Used by the UI to classify this as a web result.
    type: "web",

    // Wikipedia page title.
    title: item.title,

    // Wikipedia search snippets can contain HTML markup.
    // stripHtml() converts the snippet into plain text before rendering.
    text: stripHtml(item.snippet),

    // Human-readable source label.
    source: "Wikipedia",

    // Direct link to the corresponding Wikipedia article.
    sourceUrl:
      `https://en.wikipedia.org/?curid=${item.pageid}`,

    // Web results are not assigned a local relevance score here.
    score: 0,
  }));
}

/**
 * Remove HTML markup from a search snippet.
 *
 * Wikipedia's API may return snippets containing tags such as <span>
 * around highlighted search terms. Rendering those tags directly is
 * unnecessary, so this helper converts the snippet to plain text.
 *
 * @param {string} value - HTML-containing text.
 * @returns {string} Plain-text version of the supplied value.
 */
function stripHtml(value) {
  // Create a temporary DOM element that can parse the HTML string.
  const element = document.createElement("div");

  // Insert the API-provided snippet as HTML.
  element.innerHTML = value || "";

  // Return only the text content, removing HTML tags.
  return element.textContent || "";
}