import type { MetadataRoute } from "next";
import { publicSiteOrigin } from "@/lib/site-address";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", disallow: ["/api/", "/admin", "/wallet", "/contracts"] },
    sitemap: `${publicSiteOrigin}/sitemap.xml`,
  };
}
