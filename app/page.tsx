"use client";

import Link from "next/link";
import { NavigationArrow, SignIn, IceCream } from "@phosphor-icons/react";

// The venue's Google Maps pin — opens Maps where the visitor can tap Directions
// (Maps uses their current location as the start).
const DIRECTIONS_URL = "https://maps.app.goo.gl/hHBoj3jFQM8Ugw6i8";

export default function LandingPage() {
  return (
    <main className="cc-landing">
      <link rel="preload" as="image" href="/img/cc-bg-mobile.jpg" media="(max-width: 767px)" />
      <link rel="preload" as="image" href="/img/cc-bg-desktop.png" media="(min-width: 768px)" />
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
