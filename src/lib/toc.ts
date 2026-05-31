import { slugify } from "./slugify";
import { stripHtml } from "./text";

export interface TocHeading {
  level: 2 | 3;
  text: string;
  id: string;
}

export function extractHeadings(htmlContent: string): TocHeading[] {
  const headings: TocHeading[] = [];
  const regex = /<h([23])[^>]*>(.*?)<\/h[23]>/gi;
  let match;

  while ((match = regex.exec(htmlContent)) !== null) {
    const level = parseInt(match[1]) as 2 | 3;
    const rawText = stripHtml(match[2]);
    if (!rawText) continue;

    const id = slugify(rawText);
    headings.push({ level, text: rawText, id });
  }

  return headings;
}

export function injectHeadingIds(htmlContent: string): string {
  return htmlContent.replace(
    /<h([23])([^>]*)>(.*?)<\/h[23]>/gi,
    (fullMatch, level, attrs, inner) => {
      if (/id\s*=/.test(attrs)) return fullMatch;
      const rawText = stripHtml(inner);
      if (!rawText) return fullMatch;
      const id = slugify(rawText);
      return `<h${level}${attrs} id="${id}">${inner}</h${level}>`;
    }
  );
}

export function countWords(htmlContent: string): number {
  const text = stripHtml(htmlContent);
  return text.split(/\s+/).filter(Boolean).length;
}
