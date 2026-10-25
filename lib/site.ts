// The owner-confirmed public domain is the canonical address, including on
// preview deploys. SITE_URL is available if the domain changes later.
const DEFAULT_SITE_URL = "https://creamycastle.com";

export function siteOrigin(): string | null {
  const raw = process.env.SITE_URL?.trim() || DEFAULT_SITE_URL;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.origin;
  } catch { return null; }
}

export function venueAddress() {
  const street = process.env.BUSINESS_STREET_ADDRESS?.trim() || null;
  // The existing venue copy identifies Ogidi; use the Maps pin for the exact
  // location until a written street address is confirmed.
  const city = process.env.BUSINESS_CITY?.trim() || "Ogidi";
  const region = process.env.BUSINESS_REGION?.trim();
  const country = process.env.BUSINESS_COUNTRY?.trim() || "NG";
  return { street, city, region, country };
}
