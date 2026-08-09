import { Suspense } from "react";
import { StationConsole } from "@/components/station/StationConsole";

// The kiosk simulator. No server key in the demo — validation happens in the
// shared in-browser store.
export default function StationPage() {
  return (
    <Suspense fallback={null}>
      <StationConsole stationKey="demo" />
    </Suspense>
  );
}
