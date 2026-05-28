export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function highlightTerms(text: string, query: string): string {
  const escaped = escapeHtml(text);
  const words = query.trim().split(/\s+/).filter(Boolean);
  let result = escaped;
  for (const word of words) {
    const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(new RegExp(`(${escapedWord})`, "gi"), "<mark>$1</mark>");
  }
  return result;
}
