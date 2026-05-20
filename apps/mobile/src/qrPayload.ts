import { normalizeUrl } from "./storage";

export type QrPayload = {
  url: string;
  /** Optional pre-filled installation name. */
  name?: string;
};

/**
 * Decode the contents of a scanned QR code into an installation hint.
 *
 * Accepted formats (most-specific first):
 *
 * 1. JSON: {"url":"http://1.2.3.4:8080","name":"Home"}
 *    Useful when a bridge / docs page generates a QR with metadata.
 *
 * 2. Custom URI scheme: rehau-nea://install?url=<u>&name=<n>
 *    Future-proofing for deep links / printable installer guides.
 *
 * 3. Plain HTTP(S) URL: http://1.2.3.4:8080 — taken verbatim.
 *
 * 4. Bare host[:port]: 1.2.3.4:8080 — coerced to http://.
 *
 * Returns null if nothing URL-shaped is recoverable.
 */
export const parseQrPayload = (raw: string): QrPayload | null => {
  const text = raw?.trim();
  if (!text) return null;

  // (1) JSON envelope
  if (text.startsWith("{")) {
    try {
      const parsed = JSON.parse(text) as Partial<QrPayload>;
      if (parsed && typeof parsed.url === "string") {
        const url = normalizeUrl(parsed.url);
        if (looksLikeUrl(url)) {
          return { url, name: typeof parsed.name === "string" ? parsed.name : undefined };
        }
      }
    } catch {
      /* fall through */
    }
  }

  // (2) Custom URI scheme
  if (/^rehau-nea:\/\/install\b/i.test(text)) {
    try {
      const u = new URL(text);
      const url = u.searchParams.get("url");
      const name = u.searchParams.get("name") ?? undefined;
      if (url) {
        const normalized = normalizeUrl(url);
        if (looksLikeUrl(normalized)) return { url: normalized, name };
      }
    } catch {
      /* fall through */
    }
  }

  // (3) / (4) Plain URL or bare host
  const normalized = normalizeUrl(text);
  if (looksLikeUrl(normalized)) return { url: normalized };
  return null;
};

const looksLikeUrl = (s: string): boolean => /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(s);
