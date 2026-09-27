/** Only render links to ordinary HTTPS destinations from job-provider data. */
export function safeExternalUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname && !url.username && !url.password
      ? url.href : null;
  } catch {
    return null;
  }
}
