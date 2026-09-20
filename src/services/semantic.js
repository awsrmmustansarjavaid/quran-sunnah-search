//
// Nur Search — Browser Semantic Search
// -------------------------------------
// This module provides optional AI-powered semantic search directly
// inside the user's browser.
//
// Important:
// - No application backend is required.
// - The embedding model is downloaded only when semantic search is used.
// - The model can be relatively large, so normal keyword search remains
//   available without loading the AI model.
// - If model loading fails, App.jsx can handle the failure and continue
//   using the normal search workflow.
//

// Store the model-loading Promise so the Transformers.js pipeline
// is created only once during the lifetime of the browser session.
//
// Keeping the Promise instead of only the loaded model also prevents
// multiple simultaneous searches from starting multiple model downloads.
let extractorPromise = null;

/**
 * Create and return the browser-side feature extraction pipeline.
 *
 * The model is loaded lazily, meaning it is NOT downloaded when the
 * application initially opens. It is loaded only when semantic search
 * actually needs it.
 *
 * @returns {Promise<Function>} Transformers.js feature-extraction pipeline.
 */
async function getExtractor() {
  // If the model has not started loading yet, create the pipeline.
  if (!extractorPromise) {
    extractorPromise = import("@huggingface/transformers").then(
      ({ pipeline, env }) => {
        // Do not look for a locally installed model.
        // The model is downloaded from the configured remote model source.
        env.allowLocalModels = false;

        // Create a feature-extraction pipeline.
        //
        // all-MiniLM-L6-v2 is a sentence-embedding model commonly used
        // for comparing the semantic similarity of text.
        //
        // quantized: true reduces the model's resource requirements
        // compared with a full-precision model.
        return pipeline(
          "feature-extraction",
          "Xenova/all-MiniLM-L6-v2",
          {
            quantized: true,
          }
        );
      }
    );
  }

  // Return the same loading Promise/model for subsequent requests.
  return extractorPromise;
}

/**
 * Convert text into a normalized embedding vector.
 *
 * An embedding represents text as a numerical vector. Similar pieces
 * of text can then be compared mathematically even when they do not
 * contain exactly the same keywords.
 *
 * @param {string} text - Text that should be converted into an embedding.
 * @returns {Promise<number[]>} Normalized embedding vector.
 */
export async function embedQuery(text) {
  // Get the lazily initialized Transformers.js model.
  const extractor = await getExtractor();

  // Generate an embedding for the supplied text.
  //
  // pooling: "mean" combines token representations into one vector.
  // normalize: true normalizes the vector, making cosine similarity
  // especially efficient for comparing embeddings.
  const output = await extractor(text, {
    pooling: "mean",
    normalize: true,
  });

  // Transformers.js returns typed-array data.
  // Convert it into a normal JavaScript array so it is easy to process.
  return Array.from(output.data);
}

/**
 * Calculate cosine similarity between two vectors.
 *
 * Because embedQuery() returns normalized vectors, the cosine similarity
 * can be calculated using their dot product.
 *
 * The returned value is normally close to:
 * - 1  -> very similar direction
 * - 0  -> little/no similarity
 * - -1 -> opposite direction
 *
 * @param {number[]} a - First embedding vector.
 * @param {number[]} b - Second embedding vector.
 * @returns {number} Cosine similarity score.
 */
export function cosineSimilarity(a, b) {
  // Invalid or incompatible vectors cannot be compared.
  if (
    !a?.length ||
    !b?.length ||
    a.length !== b.length
  ) {
    return 0;
  }

  // Accumulate the dot product of the two vectors.
  let sum = 0;

  for (let index = 0; index < a.length; index += 1) {
    sum += a[index] * b[index];
  }

  // Since both vectors are normalized, this dot product represents
  // their cosine similarity.
  return sum;
}

/**
 * Rank search candidates according to semantic similarity.
 *
 * The query is embedded once. Each candidate result is then converted
 * into an embedding and compared with the query embedding.
 *
 * For a large production dataset, calculating embeddings for every
 * candidate during every search would be expensive. A better approach
 * would be to precompute candidate embeddings and store them in static
 * JSON or another searchable data source.
 *
 * @param {string} query - User's search query.
 * @param {Array<Object>} candidates - Search results to rank.
 * @returns {Promise<Array<Object>>} Candidates sorted by semantic score.
 */
export async function semanticRank(query, candidates) {
  // Convert the user's query into a semantic vector.
  const queryVector = await embedQuery(query);

  // Store candidates together with their calculated semantic scores.
  const ranked = [];

  // Process each search result individually.
  for (const candidate of candidates) {
    // Combine the most useful searchable fields into one text string.
    //
    // This allows the model to consider both the result title
    // and the actual result content.
    const text = `${candidate.title || ""} ${
      candidate.text || ""
    }`;

    // Convert the candidate's text into an embedding vector.
    const vector = await embedQuery(text);

    // Calculate semantic similarity between the query and candidate.
    const similarity = cosineSimilarity(
      queryVector,
      vector
    );

    // Store the original result plus its semantic score.
    //
    // Clamping protects the UI from unexpected floating-point values
    // outside the expected 0–1 display range.
    ranked.push({
      ...candidate,
      semanticScore: Math.max(
        0,
        Math.min(1, similarity)
      ),
    });
  }

  // Highest semantic similarity appears first.
  return ranked.sort(
    (a, b) => b.semanticScore - a.semanticScore
  );
}