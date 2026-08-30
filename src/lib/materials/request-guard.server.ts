const MATERIAL_RATE_WINDOW_MS = 60_000;
const MAX_ACCEPTED_REQUESTS_PER_WINDOW = 10;
const MAX_CONCURRENT_REQUESTS = 2;

let windowStartedAt = Date.now();
let acceptedInWindow = 0;
let activeRequests = 0;

export function reserveMaterialAnalysisRequest(now = Date.now()) {
  if (now - windowStartedAt >= MATERIAL_RATE_WINDOW_MS) {
    windowStartedAt = now;
    acceptedInWindow = 0;
  }

  if (
    acceptedInWindow >= MAX_ACCEPTED_REQUESTS_PER_WINDOW ||
    activeRequests >= MAX_CONCURRENT_REQUESTS
  ) {
    return null;
  }

  acceptedInWindow += 1;
  activeRequests += 1;
  let released = false;

  return () => {
    if (released) return;
    released = true;
    activeRequests = Math.max(0, activeRequests - 1);
  };
}
