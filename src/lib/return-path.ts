export function safeReturnPath(
  value: string | string[] | undefined,
  fallback: string,
): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (
    !candidate ||
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(candidate)
  ) {
    return fallback;
  }

  try {
    const url = new URL(candidate, "https://iabacu.local");
    if (url.origin !== "https://iabacu.local") return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

export function withReturnPath(path: string, returnPath: string): string {
  if (path.startsWith("/exam/")) {
    return withExamContext(path, new URLSearchParams({ from: returnPath }));
  }
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}from=${encodeURIComponent(returnPath)}`;
}

export const examContextKeys = ["from", "learningWorkspace", "learningActivity"] as const;

// Fragments stay in the browser and never become inputs to shared page caches.
export function withExamContext(path: string, context: URLSearchParams): string {
  const url = new URL(path, "https://iabacu.local");
  const fragment = new URLSearchParams(url.hash.slice(1));
  for (const key of examContextKeys) {
    fragment.delete(key);
    for (const value of context.getAll(key)) fragment.append(key, value);
  }
  url.hash = fragment.toString();
  return `${url.pathname}${url.search}${url.hash}`;
}

export function examQueryRedirect(url: URL): URL | null {
  if (!/^\/exam\/[^/]+(?:\/barem)?\/?$/.test(url.pathname)) return null;
  if (![...url.searchParams.keys()].some((key) => key !== "_rsc")) return null;

  const context = new URLSearchParams();
  for (const key of examContextKeys) {
    for (const value of url.searchParams.getAll(key)) {
      context.append(key, key === "from" ? safeReturnPath(value, "/") : value);
    }
  }
  return new URL(withExamContext(url.pathname, context), url.origin);
}
