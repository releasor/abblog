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

export function articleSchema(post: {
  title: string;
  excerpt?: string | null;
  coverImageUrl?: string | null;
  publishedAt?: Date | null;
  updatedAt?: Date | null;
  slug: string;
  author: { name: string };
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt || undefined,
    image: post.coverImageUrl || undefined,
    datePublished: post.publishedAt?.toISOString(),
    dateModified: post.updatedAt?.toISOString(),
    author: { "@type": "Person", name: post.author.name },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": absoluteUrl(`/posts/${post.slug}`),
    },
  };
}

export function faqSchema(questions: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: questions.map((q) => ({
      "@type": "Question",
      name: q.question,
      acceptedAnswer: { "@type": "Answer", text: q.answer },
    })),
  };
}
