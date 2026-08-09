"use client";

import { useEffect, useRef, useState } from "react";
import { mmss } from "@/lib/format";

// Ticks a Play Pass expiry down to zero. Paused once the session is in progress.
export function PassCountdown({
  initialSeconds,
  status,
  onExpire,
}: {
  initialSeconds: number;
  status?: string;
  onExpire?: () => void;
}) {
  const [seconds, setSeconds] = useState(initialSeconds);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => setSeconds(initialSeconds), [initialSeconds]);

  useEffect(() => {
    if (status === "in_progress") return;
    const t = setInterval(() => {
      setSeconds((x) => {
        if (x <= 1) {
          clearInterval(t);
          onExpireRef.current?.();
          return 0;
        }
        return x - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [status]);

  if (status === "in_progress") return <span className="text-violet-300">Session in progress</span>;
  if (seconds <= 0) return <span className="text-red-300">Expired</span>;
  return (
    <span>
      Valid for <span className="font-semibold tabular-nums">{mmss(seconds)}</span>
    </span>
  );
}
