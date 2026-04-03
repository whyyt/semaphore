function normalizeOrigin(value) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function getAllowedOrigins() {
  return new Set(
    [
      process.env.VITE_APP_URL,
      process.env.APP_URL,
      "http://localhost:5173",
      "http://127.0.0.1:5173",
    ]
      .map((value) => normalizeOrigin(value ?? null))
      .filter(Boolean),
  );
}

export function applyCors(request, response) {
  const requestOrigin = normalizeOrigin(request.headers.origin ?? null);
  const allowedOrigins = getAllowedOrigins();

  if (requestOrigin && allowedOrigins.has(requestOrigin)) {
    response.setHeader("Access-Control-Allow-Origin", requestOrigin);
    response.setHeader("Vary", "Origin");
  }

  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
}
