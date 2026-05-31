import { absoluteUrl } from "./site-url";

export function websiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "billionaire",
    url: absoluteUrl(""),
    description: "AI 与数字生活的无限可能",
    potentialAction: {
      "@type": "SearchAction",
      target: absoluteUrl("/search?q={search_term_string}"),
      "query-input": "required name=search_term_string",
    },
  };
}

export function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "billionaire",
    url: absoluteUrl(""),
  };
}

