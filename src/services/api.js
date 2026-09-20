// API helpers are isolated from the UI so the search components stay easy to maintain.

const QURAN_SEARCH_URL = "https://api.alquran.cloud/v1/search";
const HADITH_BASE_URL = "https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions";

// Search the Quran through Al Quran Cloud's public REST API.
export async function searchQuran(query) {
  const encoded = encodeURIComponent(query.trim());
  const response = await fetch(`${QURAN_SEARCH_URL}/${encoded}/all/en.sahih`);

  if (!response.ok) {
    throw new Error("The Quran search service did not respond.");
  }

  const payload = await response.json();
  return (payload.data?.matches || []).slice(0, 10).map((item) => ({
    id: `quran-${item.number}`,
    type: "quran",
    reference: `${item.surah?.englishName || "Quran"} ${item.surah?.number}:${item.numberInSurah}`,
    title: item.surah?.englishName || "Quran",
    subtitle: item.surah?.englishNameTranslation || "Quran verse",
    arabic: item.text,
    text: item.text,
    source: "Al Quran Cloud",
    sourceUrl: `https://alquran.cloud/ayah/${item.surah?.number}:${item.numberInSurah}`,
    score: 0,
  }));
}

// Load a complete hadith edition only when the user searches Hadith.
// The public dataset is delivered through jsDelivr and therefore works from static hosting.
export async function loadHadithEdition(edition = "eng-bukhari") {
  const response = await fetch(`${HADITH_BASE_URL}/${edition}.json`);

  if (!response.ok) {
    throw new Error("The Hadith dataset could not be loaded.");
  }

  return response.json();
}

// Search the downloaded hadith edition locally in the browser.
// This avoids a private API key and keeps the application backend-free.
export function searchHadith(editionData, query) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const rows = Array.isArray(editionData?.hadiths) ? editionData.hadiths : [];

  return rows
    .map((item) => {
      const text = String(item.text || "");
      const lower = text.toLowerCase();
      const hits = terms.reduce((count, term) => count + (lower.includes(term) ? 1 : 0), 0);
      return { item, hits };
    })
    .filter(({ hits }) => hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 10)
    .map(({ item, hits }) => ({
      id: `hadith-${item.hadithnumber || item.reference || Math.random()}`,
      type: "hadith",
      reference: `Hadith ${item.hadithnumber || ""}`.trim(),
      title: editionData.metadata?.name || "Hadith Collection",
      subtitle: item.reference || "Hadith reference",
      text: item.text || "",
      source: "Fawaz Hadith API dataset",
      sourceUrl: "https://github.com/fawazahmed0/hadith-api",
      score: Math.min(99, 55 + hits * 12),
    }));
}

// Use Wikipedia's public search endpoint as a genuinely live, browser-accessible web discovery layer.
// Web results are deliberately separated from primary Quran/Hadith results in the UI.
export async function searchWeb(query) {
  const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
    query
  )}&format=json&origin=*&srlimit=6`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Web discovery is temporarily unavailable.");
  }

  const payload = await response.json();

  return (payload.query?.search || []).map((item) => ({
    id: `web-${item.pageid}`,
    type: "web",
    title: item.title,
    text: stripHtml(item.snippet),
    source: "Wikipedia",
    sourceUrl: `https://en.wikipedia.org/?curid=${item.pageid}`,
    score: 0,
  }));
}

// Remove snippets' HTML markup before displaying them.
function stripHtml(value) {
  const element = document.createElement("div");
  element.innerHTML = value || "";
  return element.textContent || "";
}