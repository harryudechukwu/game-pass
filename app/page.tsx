"use client";

import Link from "next/link";
import { NavigationArrow, SignIn, IceCream } from "@phosphor-icons/react";

// Opening Google Maps with just a destination lets Maps use the visitor's own
// current location as the start (GPS on mobile) — no manual location entry.
// TODO: swap the query for the venue's exact address or coordinates.
const VENUE = "Creamy Castle, Ogidi";
const DIRECTIONS_URL = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(VENUE)}`;

export default function LandingPage() {
  return (
    <main className="cc-landing">
      <div className="cc-landing-inner">
        <div className="cc-landing-logo"><IceCream size={24} weight="duotone" /> Creamy Castle</div>
        <h1 className="cc-landing-title">Where kids &amp; teens come to play</h1>
        <p className="cc-landing-sub">Games, treats and rewards — all the fun under one roof. Come play, spend and win.</p>
        <div className="cc-landing-actions">
          <a href={DIRECTIONS_URL} target="_blank" rel="noreferrer" className="cc-btn cc-btn--ghost">
            <NavigationArrow size={20} weight="duotone" /> Get directions
          </a>
          <Link href="/login" className="cc-btn cc-btn--primary">
            <SignIn size={20} weight="duotone" /> Login to account
          </Link>
        </div>
      </div>
    </main>
  );
}
