// ============================================================================
// Nur Search - API Service
// ============================================================================
// This file contains all external-data and browser-side search functions.
//
// The React UI should NOT directly call external APIs.
// Instead, App.jsx calls:
//   - searchQuran()
//   - loadHadithEdition()
//   - searchHadith()
//   - searchWeb()
//
// The functions below are intentionally defensive:
//   - API requests have a timeout.
//   - HTTP errors are handled.
//   - Invalid API responses do not crash React.
//   - Hadith IDs are deterministic.
//   - Search results are normalized into one common format.
// ============================================================================


// ============================================================================
// API ENDPOINTS
// ============================================================================

// Public Quran search API.
const QURAN_SEARCH_URL = "https://api.alquran.cloud/v1/search";

// Public Hadith dataset hosted through jsDelivr.
const HADITH_BASE_URL =
  "https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions";

// Request timeout.
// This prevents the UI from staying in a loading state forever.
const REQUEST_TIMEOUT_MS = 15000;


// ============================================================================
// GENERIC JSON FETCH HELPER
// ============================================================================

/**
 * Fetch JSON from an external URL safely.
 *
 * Why this helper exists:
 * fetch() does not automatically fail when a server returns
 * HTTP 400, 404, 500, etc. We therefore check response.ok ourselves.
 *
 * AbortController is also used so a slow external service cannot
 * leave the application waiting forever.
 *
 * @param {string} url - URL to request.
 * @returns {Promise<Object>} Parsed JSON response.
 */
async function fetchJson(url) {
  // Create an AbortController so the request can be cancelled.
  const controller = new AbortController();

  // Start a timer for the request timeout.
  const timeoutId = window.setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    // Send the request.
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    // fetch() does not throw for HTTP errors,
    // so explicitly handle them here.
    if (!response.ok) {
      throw new Error(
        `Request failed with HTTP ${response.status}.`
      );
    }

    // Parse the response as JSON.
    return await response.json();
  } catch (error) {
    // Convert the browser AbortError into a user-friendly message.
    if (error?.name === "AbortError") {
      throw new Error(
        "The request timed out. Please try searching again."
      );
    }

    // Convert unknown errors into a normal Error object.
    if (error instanceof Error) {
      throw error;
    }

    throw new Error("The external search service failed.");
  } finally {
    // Always clear the timeout after the request finishes.
    window.clearTimeout(timeoutId);
  }
}


// ============================================================================
// QURAN SEARCH
// ============================================================================

/**
 * Search the Quran through Al Quran Cloud.
 *
 * @param {string} query - User's search query.
 * @returns {Promise<Array>} Normalized Quran results.
 */
export async function searchQuran(query) {
  // Remove unnecessary spaces.
  const cleanQuery = String(query || "").trim();

  // Do not send an empty query to the API.
  if (!cleanQuery) {
    return [];
  }

  // URL encode the query so spaces and special characters are safe.
  const encodedQuery = encodeURIComponent(cleanQuery);

  // Request English Sahih International translation.
  const url =
    `${QURAN_SEARCH_URL}/${encodedQuery}/all/en.sahih`;

  // Fetch the API response.
  const payload = await fetchJson(url);

  // Make sure the expected API structure exists.
  const matches = Array.isArray(payload?.data?.matches)
    ? payload.data.matches
    : [];

  // Normalize Quran API records into Nur Search records.
  return matches.slice(0, 10).map((item, index) => {
    const surahNumber = item?.surah?.number ?? "";
    const verseNumber = item?.numberInSurah ?? "";
    const globalNumber = item?.number ?? index;

    return {
      // Stable ID.
      id: `quran-${globalNumber}`,

      // Result type.
      type: "quran",

      // Example:
      // Al-Baqarah 2:255
      reference:
        `${item?.surah?.englishName || "Quran"} ` +
        `${surahNumber}:${verseNumber}`,

      // Surah name.
      title: item?.surah?.englishName || "Quran",

      // Translation name.
      subtitle:
        item?.surah?.englishNameTranslation ||
        "Sahih International",

      // The selected endpoint returns the English translation.
      // Therefore we intentionally do NOT call this Arabic text.
      text: String(item?.text || ""),

      // Source label.
      source: "Al Quran Cloud",

      // Direct Quran Cloud verse URL.
      sourceUrl:
        surahNumber && verseNumber
          ? `https://alquran.cloud/ayah/${surahNumber}:${verseNumber}`
          : "https://alquran.cloud/",

      // Base API result does not have a local score.
      score: 0,
    };
  });
}


// ============================================================================
// HADITH DATASET LOADER
// ============================================================================

/**
 * Download a Hadith edition.
 *
 * The dataset is downloaded only when Hadith search is requested.
 *
 * @param {string} edition - Hadith edition identifier.
 * @returns {Promise<Object>} Hadith dataset.
 */
export async function loadHadithEdition(
  edition = "eng-bukhari"
) {
  // Make sure the edition name is safe.
  const safeEdition = String(edition || "eng-bukhari")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "");

  // Build the dataset URL.
  const url =
    `${HADITH_BASE_URL}/${safeEdition}.json`;

  // Download and return the dataset.
  return fetchJson(url);
}


// ============================================================================
// HADITH SEARCH
// ============================================================================

/**
 * Search a downloaded Hadith dataset locally.
 *
 * @param {Object} editionData - Downloaded Hadith dataset.
 * @param {string} query - User search query.
 * @returns {Array} Normalized Hadith results.
 */
export function searchHadith(editionData, query) {
  // Convert the query to a clean string.
  const cleanQuery = String(query || "")
    .trim()
    .toLowerCase();

  // Empty searches return no results.
  if (!cleanQuery) {
    return [];
  }

  // Break the query into individual words.
  const terms = cleanQuery
    .split(/\s+/)
    .filter(Boolean);

  // Verify that the dataset contains an array.
  const rows = Array.isArray(editionData?.hadiths)
    ? editionData.hadiths
    : [];

  // If there is no Hadith data, safely return an empty array.
  if (!rows.length) {
    return [];
  }

  return rows
    .map((item, index) => {
      // Always convert Hadith text to a string.
      const text = String(item?.text || "");

      // Lowercase text for case-insensitive searching.
      const lowerText = text.toLowerCase();

      // Count matching search terms.
      const hits = terms.reduce(
        (count, term) =>
          count + (lowerText.includes(term) ? 1 : 0),
        0
      );

      return {
        item,
        index,
        hits,
      };
    })

    // Only keep records containing at least one search term.
    .filter((record) => record.hits > 0)

    // More matching terms = higher position.
    .sort((a, b) => {
      if (b.hits !== a.hits) {
        return b.hits - a.hits;
      }

      // Keep ordering deterministic when hit counts are equal.
      return a.index - b.index;
    })

    // Keep the interface lightweight.
    .slice(0, 10)

    // Convert records to the common Nur Search format.
    .map(({ item, index, hits }) => {
      // Use stable fields instead of Math.random().
      const hadithNumber =
        item?.hadithnumber ||
        item?.reference ||
        index + 1;

      return {
        id: `hadith-${String(hadithNumber)}`,

        type: "hadith",

        reference:
          item?.hadithnumber
            ? `Hadith ${item.hadithnumber}`
            : `Hadith ${index + 1}`,

        title:
          editionData?.metadata?.name ||
          "Sahih al-Bukhari",

        subtitle:
          item?.reference ||
          "Hadith reference",

        text,

        source: "Fawaz Hadith API dataset",

        sourceUrl:
          "https://github.com/fawazahmed0/hadith-api",

        // Simple local relevance score.
        score: Math.min(99, 55 + hits * 12),
      };
    });
}


// ============================================================================
// WEB SEARCH
// ============================================================================

/**
 * Search Wikipedia for additional background information.
 *
 * These results are deliberately classified as "web".
 * They are not presented as Quran or Hadith source material.
 *
 * @param {string} query - User's search query.
 * @returns {Promise<Array>} Normalized web results.
 */
export async function searchWeb(query) {
  // Clean the query.
  const cleanQuery = String(query || "").trim();

  // Empty searches return nothing.
  if (!cleanQuery) {
    return [];
  }

  // Wikipedia API URL.
  const url =
    "https://en.wikipedia.org/w/api.php" +
    "?action=query" +
    "&list=search" +
    `&srsearch=${encodeURIComponent(cleanQuery)}` +
    "&format=json" +
    "&origin=*" +
    "&srlimit=6";

  // Request Wikipedia.
  const payload = await fetchJson(url);

  // Validate the response structure.
  const rows = Array.isArray(payload?.query?.search)
    ? payload.query.search
    : [];

  // Normalize Wikipedia records.
  return rows.map((item, index) => ({
    id: `web-${item?.pageid || index}`,

    type: "web",

    title: item?.title || "Wikipedia",

    text: stripHtml(item?.snippet || ""),

    source: "Wikipedia",

    sourceUrl: item?.pageid
      ? `https://en.wikipedia.org/?curid=${item.pageid}`
      : "https://en.wikipedia.org/",

    score: 0,
  }));
}


// ============================================================================
// HTML CLEANING HELPER
// ============================================================================

/**
 * Remove HTML markup from Wikipedia snippets.
 *
 * @param {string} value - HTML-containing text.
 * @returns {string} Plain text.
 */
function stripHtml(value) {
  const html = String(value || "");

  // Normally this application runs in a browser.
  if (typeof document !== "undefined") {
    const element = document.createElement("div");

    element.innerHTML = html;

    return element.textContent || "";
  }

  // Fallback for environments where document does not exist.
  return html.replace(/<[^>]*>/g, "");
}