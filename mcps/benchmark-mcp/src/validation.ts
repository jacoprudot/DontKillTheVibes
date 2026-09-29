/**
 * Shared input validation helpers for benchmark-mcp tools.
 */

export interface HttpUrl {
  url: URL;
}

/**
 * Parses a URL and only allows http/https schemes.
 */
export function validateHttpUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`Invalid URL: ${raw}`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Only http/https URLs are allowed: ${raw}`);
  }
  return url;
}

/**
 * Validates header keys/values: no CR/LF (header injection) and no quotes.
 */
export function validateHeaders(headers: Record<string, string>): Record<string, string> {
  for (const [key, value] of Object.entries(headers)) {
    if (/[\r\n]/.test(key) || /[\r\n"'`]/.test(key)) {
      throw new Error(`Invalid header key: ${key}`);
    }
    if (/[\r\n"']/.test(value)) {
      throw new Error(`Invalid header value for ${key}: contains quotes or newlines`);
    }
  }
  return headers;
}

/**
 * Standard error payload shape shared by both MCPs:
 * { success: false, error: { code, message, retryable } }
 */
export function errorResult(code: string, message: string, retryable: boolean) {
  return {
    isError: true,
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify({ success: false, error: { code, message, retryable } })
      }
    ]
  };
}

export function successResult(data: unknown) {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify({ success: true, data }, null, 2)
      }
    ]
  };
}
