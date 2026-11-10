import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

// Public landing pages only for now. When authenticated dashboards / admin routes
// appear, add them to `disallow` (robots.txt is not access control — keep server-side checks).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
