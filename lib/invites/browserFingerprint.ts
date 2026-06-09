const browserFingerprintKey = "bolao_browser_fingerprint";

export function getOrCreateBrowserFingerprint() {
  const existing = localStorage.getItem(browserFingerprintKey);

  if (existing) {
    return existing;
  }

  const value =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  localStorage.setItem(browserFingerprintKey, value);

  return value;
}
