import os from "os";
import path from "path";

// Lazy import keeps the heavy onnxruntime dependency out of cold paths
// (entry CRUD without search never pays the model-load cost).
type Extractor = (
  text: string,
  opts: { pooling: "mean"; normalize: boolean },
) => Promise<{ data: Float32Array }>;

let extractorPromise: Promise<Extractor> | null = null;

async function getExtractor(): Promise<Extractor> {
  if (!extractorPromise) {
    extractorPromise = (async () => {
      const { pipeline, env } = await import("@huggingface/transformers");
      // The container runs as a non-root user whose cwd may not be writable
      env.cacheDir =
        process.env.TRANSFORMERS_CACHE ??
        path.join(os.tmpdir(), "transformers-cache");
      return (await pipeline(
        "feature-extraction",
        "Xenova/all-MiniLM-L6-v2",
      )) as unknown as Extractor;
    })();
    extractorPromise.catch(() => {
      extractorPromise = null;
    });
  }
  return extractorPromise;
}

export const EMBEDDING_DIM = 384;

export async function embedText(text: string): Promise<number[]> {
  const extractor = await getExtractor();
  const output = await extractor(text.replaceAll("\n", " "), {
    pooling: "mean",
    normalize: true,
  });
  return Array.from(output.data);
}

export function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

// Best-effort: entry CRUD must never fail because the embedding model is
// unavailable — the search route backfills any rows left without one.
export async function storeEntryEmbedding(
  id: string,
  text: string,
): Promise<void> {
  try {
    const { prisma } = await import("@/lib/prisma");
    const vec = toVectorLiteral(await embedText(text));
    await prisma.$executeRaw`UPDATE "Entry" SET "embedding" = ${vec}::vector WHERE "id" = ${id}`;
  } catch (err) {
    console.error(`Failed to embed entry ${id}:`, err);
  }
}
