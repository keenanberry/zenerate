import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo/metadata";

// Crawl what a signed-out visitor can open; keep crawlers off the account
// pages, which only redirect to /login, and off the API.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/discover", "/meditation/", "/terms", "/privacy"],
      disallow: ["/dashboard", "/create", "/collections", "/api/", "/login", "/auth/"],
    },
    sitemap: new URL("/sitemap.xml", siteUrl).href,
  };
}
