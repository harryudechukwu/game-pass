"use client";

import { useEffect, useState } from "react";
import { hms } from "@/lib/format";

// Two-phase countdown for a game session (heads-up → play), rendered to sit on
// the right of a gp-row. Ticks every second; the parent re-polls to move a
// finished session into history.
export function SessionTimer({
  headsUpEndsAt,
  mainEndsAt,
}: {
  headsUpEndsAt: string | null;
  mainEndsAt: string | null;
}) {
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const now = Date.now();
  const hu = headsUpEndsAt ? new Date(headsUpEndsAt).getTime() : 0;
  const me = mainEndsAt ? new Date(mainEndsAt).getTime() : 0;

  if (now < hu) {
    return (
      <div className="gp-rright">
        <div className="gp-timerbig">{hms((hu - now) / 1000)}</div>
        <span className="gp-tag gp-tag--warn">Get ready</span>
      </div>
    );
  }
  if (now < me) {
    const left = (me - now) / 1000;
    return (
      <div className="gp-rright">
        <div className="gp-timerbig">{hms(left)}</div>
        {left < 120 && <span className="gp-tag gp-tag--warn">Ending soon</span>}
      </div>
    );
  }
  return (
    <div className="gp-rright">
      <span className="gp-tag gp-tag--done">Done</span>
    </div>
  );
}
