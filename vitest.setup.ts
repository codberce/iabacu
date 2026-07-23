import "@testing-library/jest-dom/vitest";

// jsdom does not implement ResizeObserver, but PdfViewer (and other layout
// components) rely on it. The component already guards against a missing
// IntersectionObserver (falling back to immediate load), so we intentionally
// leave that one undefined to keep that code path exercised in tests.
class ResizeObserverPolyfill {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = ResizeObserverPolyfill as unknown as typeof ResizeObserver;
}

// jsdom leaves Element.prototype.scrollIntoView unimplemented; PdfViewer calls
// it when jumping to a page via the keyboard. Provide a no-op so handlers that
// invoke it do not throw during tests.
if (typeof Element !== "undefined" && typeof Element.prototype.scrollIntoView !== "function") {
  Element.prototype.scrollIntoView = function scrollIntoView() {};
}
