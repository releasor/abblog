import DOMPurify from "isomorphic-dompurify";

const ALLOWED_TAGS = [
  "h1", "h2", "h3", "h4", "h5", "h6",
  "p", "br", "hr",
  "ul", "ol", "li",
  "blockquote", "pre", "code",
  "a", "strong", "em", "del", "mark", "sub", "sup",
  "table", "thead", "tbody", "tr", "th", "td",
  "img", "figure", "figcaption",
  "details", "summary",
  "div", "span",
];

const ALLOWED_ATTRS = [
  "href", "target", "rel",
  "src", "alt", "width", "height",
  "class", "id",
  "colspan", "rowspan",
  "open",
];

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ALLOWED_ATTRS,
    ADD_ATTR: ["loading", "decoding"],
  });
}
