import "server-only";
import { revalidateTag, unstable_cache } from "next/cache";

export const PUBLIC_COMPETITION_TAG = "public-competition-v1";
export const PUBLIC_HOME_TAG = "public-home-v1";

// Only anonymous/public projections belong here, never profile contacts, rooms,
// registrations, balances or authorization decisions. HTTP responses stay uncached
// so a successful mutation can immediately invalidate the shared server cache.
export function cachePublicRead<Args extends unknown[], Result>(read: (...args: Args) => Promise<Result>, key: string, tag: string) {
  return unstable_cache(read, [key], { revalidate: 30, tags: [tag] });
}

export function invalidatePublicData() {
  // Mutations have committed already. A cache service failure must not turn a
  // successful write into a failed save; the 30-second lifetime is the fallback.
  try {
    revalidateTag(PUBLIC_COMPETITION_TAG, { expire: 0 });
    revalidateTag(PUBLIC_HOME_TAG, { expire: 0 });
  } catch (error) {
    console.error("Public data cache invalidation failed", error);
  }
}
