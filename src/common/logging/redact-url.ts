const SECRET_PATH_PATTERN = /(\/share\/)[^/?#]+/g;
const SECRET_QUERY_PATTERN = /([?&](?:signature|token)=)[^&#]*/gi;

/**
 * Removes bearer-style secrets from a request URL before it is logged, traced
 * or echoed: private share tokens (`/share/<token>`) and signed-URL
 * signatures / tokens in the query string. Anyone holding such a URL has
 * access, so it must never reach logs or telemetry.
 */
export function redactUrl(url: string): string {
  return url
    .replace(SECRET_PATH_PATTERN, '$1[redacted]')
    .replace(SECRET_QUERY_PATTERN, '$1[redacted]');
}
