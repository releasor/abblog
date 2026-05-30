import { countWords } from "./toc";

export function estimateReadingTime(htmlContent: string): number {
  return Math.max(1, Math.ceil(countWords(htmlContent) / 200));
}
