import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Server-only helper: resolves downloaded artwork for an asset id.
 * Art lives under public/assets/ (fetched by scripts/fetch-assets.ts,
 * gitignored — Rockstar IP, private use).
 */
const CANDIDATE_DIRS = ["assets/properties", "assets/gear", "assets/heists"];

const cache = new Map<string, string | null>();

export function assetArt(assetId: string): string | null {
  if (cache.has(assetId)) return cache.get(assetId)!;
  let found: string | null = null;
  for (const dir of CANDIDATE_DIRS) {
    const rel = `${dir}/${assetId}.png`;
    if (existsSync(join(process.cwd(), "public", rel))) {
      found = `/${rel}`;
      break;
    }
    const relJpg = `${dir}/${assetId}.jpg`;
    if (existsSync(join(process.cwd(), "public", relJpg))) {
      found = `/${relJpg}`;
      break;
    }
  }
  cache.set(assetId, found);
  return found;
}
