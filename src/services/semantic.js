// Browser semantic search is optional because downloading an embedding model can be several hundred MB.
// The application gracefully falls back to keyword search if the model cannot load.

let extractorPromise = null;

// Create the feature-extraction pipeline lazily so the initial page remains fast.
async function getExtractor() {
  if (!extractorPromise) {
    extractorPromise = import("@huggingface/transformers").then(({ pipeline, env }) => {
      // Transformers.js uses the browser cache and remote model hub by default.
      env.allowLocalModels = false;
      return pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", {
        quantized: true,
      });
    });
  }
  return extractorPromise;
}

// Produce one normalized embedding vector for a query.
export async function embedQuery(text) {
  const extractor = await getExtractor();
  const output = await extractor(text, { pooling: "mean", normalize: true });
  return Array.from(output.data);
}

// Cosine similarity is used because normalized sentence embeddings can be compared efficiently.
export function cosineSimilarity(a, b) {
  if (!a?.length || !b?.length || a.length !== b.length) return 0;

  let sum = 0;
  for (let index = 0; index < a.length; index += 1) {
    sum += a[index] * b[index];
  }
  return sum;
}

// Rank arbitrary text candidates with the browser model.
// For a larger production corpus, precomputed embeddings should be stored in static JSON.
export async function semanticRank(query, candidates) {
  const queryVector = await embedQuery(query);

  const ranked = [];
  for (const candidate of candidates) {
    const text = `${candidate.title || ""} ${candidate.text || ""}`;
    const vector = await embedQuery(text);
    ranked.push({
      ...candidate,
      semanticScore: Math.max(0, Math.min(1, cosineSimilarity(queryVector, vector))),
    });
  }

  return ranked.sort((a, b) => b.semanticScore - a.semanticScore);
}