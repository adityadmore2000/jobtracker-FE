export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
export const REQUEST_TIMEOUT_MS = 10000;
export const CHAT_REQUEST_TIMEOUT_MS = 120_000;
