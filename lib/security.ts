type RateLimitOptions = {
  keyPrefix: string;
  limit: number;
  windowMs: number;
};

type RateLimitState = {
  count: number;
  resetAt: number;
};

const rateLimits = new Map<string, RateLimitState>();

export const securityHeaders = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "same-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "Content-Security-Policy": "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
};

export function secureHeaders(headers?: HeadersInit) {
  return { ...securityHeaders, ...(headers ?? {}) };
}

export function jsonSeguro(body: unknown, init?: ResponseInit) {
  return Response.json(body, { ...init, headers: secureHeaders(init?.headers) });
}

function requestIp(request: Request) {
  return request.headers.get("cf-connecting-ip")
    ?? request.headers.get("x-real-ip")
    ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? "local";
}

export function verificarRateLimit(request: Request, options: RateLimitOptions): Response | null {
  const now = Date.now();
  const key = `${options.keyPrefix}:${requestIp(request)}`;
  const current = rateLimits.get(key);

  if (!current || current.resetAt <= now) {
    rateLimits.set(key, { count: 1, resetAt: now + options.windowMs });
    return null;
  }

  if (current.count >= options.limit) {
    const retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
    return jsonSeguro(
      { error: "Demasiados intentos. Espere un momento antes de volver a intentar." },
      {
        status: 429,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": String(retryAfter),
        },
      },
    );
  }

  current.count += 1;
  return null;
}

/**
 * Devuelve el SQLSTATE del error de PostgreSQL, buscándolo también en la cadena de `cause`.
 * Drizzle envuelve el error original, así que `error.code` viene vacío en el objeto de primer
 * nivel y una comprobación directa deja pasar violaciones de unicidad como fallas genéricas.
 */
export function codigoPostgres(error: unknown): string | null {
  let actual: unknown = error;
  for (let profundidad = 0; actual && typeof actual === "object" && profundidad < 5; profundidad += 1) {
    const codigo = (actual as { code?: unknown }).code;
    if (typeof codigo === "string" && codigo) return codigo;
    const causa = (actual as { cause?: unknown }).cause;
    if (causa === actual) break;
    actual = causa;
  }
  return null;
}

