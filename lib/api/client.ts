/**
 * Fetch wrapper for the TradeLoop API. Requests go to /api/v1 on this app (proxied to the API,
 * see next.config.ts), carry the in-memory access token and are retried once after a refresh
 * when the token has expired. Responses are unwrapped from the API's `{ data, meta }` envelope.
 */

export interface ApiFieldError {
  field?: string;
  messages: string[];
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields: ApiFieldError[] = [],
  ) {
    super(message);
  }
}

interface TokenSource {
  token(): string | null;
  /** Get a new access token (null when the session is gone). */
  refresh(): Promise<string | null>;
}

let tokens: TokenSource = { token: () => null, refresh: async () => null };

/** Wired once by the session store. */
export function setTokenSource(source: TokenSource) {
  tokens = source;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** Send the access token (default). Public pages pass false. */
  auth?: boolean;
}

export async function api<T>(path: string, { method, body, auth = true }: RequestOptions = {}): Promise<T> {
  const send = (token: string | null) =>
    fetch(`/api/v1${path}`, {
      method: method ?? (body === undefined ? "GET" : "POST"),
      headers: {
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
  let res = await send(auth ? tokens.token() : null);
  if (res.status === 401 && auth) {
    const fresh = await tokens.refresh();
    if (fresh) res = await send(fresh);
  }
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, payload?.code ?? "HTTP_ERROR", payload?.message ?? `Request failed (${res.status})`, payload?.errors ?? []);
  }
  return payload?.data as T;
}

/** A message for a failed action: the API's own explanation, or what to do when it is unreachable. */
export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.code === "VALIDATION_ERROR" && e.fields.length) return `Check ${e.fields.map((f) => f.field).filter(Boolean).slice(0, 3).join(", ")}: ${e.fields[0].messages[0]}`;
    if (e.status === 403 && e.code === "FORBIDDEN") return "Your role can't do this. Ask the owner or the right desk.";
    if (e.status >= 500) return "The TradeLoop server had a problem. Try again in a moment.";
    return e.message;
  }
  return "Can't reach the TradeLoop server. Check your connection and try again.";
}
