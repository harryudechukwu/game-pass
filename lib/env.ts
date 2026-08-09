// Centralised, typed access to runtime configuration. The backend is the source
// of truth for every number here — none of these are ever read from the client.

function int(name: string, fallback: number): number {
  const raw = process.env[name];
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

export const env = {
  authSecret:
    process.env.AUTH_SECRET ||
    "dev-insecure-secret-change-me-please-0123456789",
  signupBonusPoints: int("SIGNUP_BONUS_POINTS", 100),
  playPassTtlSeconds: int("PLAY_PASS_TTL_SECONDS", 120),
  stationApiKey: process.env.STATION_API_KEY || "station-dev-key",
  otpDevMode: (process.env.OTP_DEV_MODE || "true") === "true",
  paystackSecret: process.env.PAYSTACK_SECRET_KEY || "",
  isProd: process.env.NODE_ENV === "production",
};
