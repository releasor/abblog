import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/api/", "/settings/", "/messages/", "/notifications/", "/login/", "/register/", "/series/manage/"],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
