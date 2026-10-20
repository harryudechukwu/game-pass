import test from "node:test";
import assert from "node:assert/strict";
import { saleHour, venueDateOnlyEpoch, venueDateTimeEpoch, venueNow } from "../lib/server/tz.ts";
import { saleTimeLabel } from "../lib/format.ts";

test("a missed sale uses the venue timezone, not the operator's browser timezone", () => {
  const at = venueDateTimeEpoch("Africa/Lagos", "2026-10-14", "15:30");
  assert.equal(at, Date.parse("2026-10-14T14:30:00.000Z"));
  assert.deepEqual(venueNow("Africa/Lagos", at), { date: "2026-10-14", minutes: 15 * 60 + 30 });
  assert.equal(venueDateTimeEpoch("Africa/Lagos", "2026-10-14", "00:00"), Date.parse("2026-10-13T23:00:00.000Z"));
});

test("invalid calendar dates and times cannot be recorded", () => {
  assert.equal(venueDateTimeEpoch("Africa/Lagos", "2026-02-30", "12:00"), null);
  assert.equal(venueDateTimeEpoch("Africa/Lagos", "2026-10-14", "24:00"), null);
  assert.equal(venueDateTimeEpoch("Africa/Lagos", "2026-10-14", "9:00"), null);
});

test("a missed sale can have a date without an invented time", () => {
  const at = venueDateOnlyEpoch("Africa/Lagos", "2026-10-14");
  assert.equal(at, Date.parse("2026-10-13T23:00:00.000Z"));
  assert.equal(venueNow("Africa/Lagos", at).date, "2026-10-14");
  assert.equal(venueDateOnlyEpoch("Africa/Lagos", "2026-02-30"), null);
  assert.equal(venueDateOnlyEpoch("Africa/Lagos", "bad"), null);
  assert.equal(saleTimeLabel({ createdAt: new Date(at).toISOString(), entrySource: "manual", occurredDate: "2026-10-14", occurredTime: null }), "2026-10-14 · time not recorded");
  assert.equal(saleHour("Africa/Lagos", { createdAt: at, entrySource: "manual", occurredTime: null }), null);
  assert.equal(saleHour("Africa/Lagos", { createdAt: at, entrySource: "manual", occurredTime: "00:00" }), 0);
});

test("a DST-skipped local time is rejected instead of shifting the sale", () => {
  assert.equal(venueDateTimeEpoch("America/New_York", "2026-03-08", "02:30"), null);
});
