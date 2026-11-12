import type { MetadataRoute } from "next";
import { publicSiteOrigin, publicSitePaths } from "@/lib/site-address";

export default function sitemap(): MetadataRoute.Sitemap {
  return publicSitePaths.map(path => ({ url: new URL(path, publicSiteOrigin).href }));
}
