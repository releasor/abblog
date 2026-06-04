// Content limits
export const MAX_TITLE_LENGTH = 200;
export const MAX_CONTENT_LENGTH = 500_000;
export const MAX_COMMENT_LENGTH = 1000;
export const MAX_SLUG_LENGTH = 200;
export const MAX_PROMPT_LENGTH = 10_000;
export const MAX_PROMPT_CONTENT_LENGTH = 50_000;
export const MAX_MESSAGE_LENGTH = 2000;
export const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

// AI settings
export const AI_MAX_TOKENS = 2000;

// Pagination
export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 50;
export const POSTS_PER_PAGE = 12;
export const ADMIN_PAGE_SIZE = 20;

// Cache durations (seconds)
export const CACHE_MAX_AGE = 3600;
export const CACHE_S_MAXAGE = 3600;
export const CACHE_STALE_WHILE_REVALIDATE = 7200;
export const CACHE_PRIVATE_MAX_AGE = 10;
export const CACHE_PRIVATE_STALE = 20;
export const CACHE_PRIVATE_MAX_AGE_SHORT = 5;
export const CACHE_PRIVATE_STALE_SHORT = 10;
export const CACHE_PRIVATE_MAX_AGE_MEDIUM = 30;
export const CACHE_PRIVATE_STALE_MEDIUM = 60;
export const CACHE_PRIVATE_MAX_AGE_LONG = 60;
export const CACHE_PRIVATE_STALE_LONG = 120;
export const CACHE_PUBLIC_S_MAXAGE_TINY = 30;
export const CACHE_PUBLIC_STALE_TINY = 60;
export const CACHE_PUBLIC_S_MAXAGE = 60;
export const CACHE_PUBLIC_STALE = 120;
export const CACHE_PUBLIC_S_MAXAGE_MEDIUM = 120;
export const CACHE_PUBLIC_STALE_MEDIUM = 300;
export const CACHE_PUBLIC_S_MAXAGE_SHORT = 300;
export const CACHE_PUBLIC_STALE_SHORT = 600;

// Time constants (milliseconds)
export const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// Popular posts scoring weights
export const LIKE_WEIGHT = 3;
export const COMMENT_WEIGHT = 2;
export const READ_WEIGHT = 1;
