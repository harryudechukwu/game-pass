import { Suspense } from "react";
import { env } from "@/lib/env";
import { StationConsole } from "@/components/station/StationConsole";

// Read the station key at runtime and hand it to the kiosk client. A real kiosk
// would be provisioned with this key; embedding it here is fine for the sim.
export const dynamic = "force-dynamic";

export default function StationPage() {
  return (
    <Suspense fallback={null}>
      <StationConsole stationKey={env.stationApiKey} />
    </Suspense>
  );
}
