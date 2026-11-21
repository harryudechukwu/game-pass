import type { Metadata } from "next";
import Link from "next/link";
import { IceCream, MapPin, NavigationArrow, Phone, SignIn } from "@phosphor-icons/react/dist/ssr";
import { getPublicDb } from "@/lib/mongo";
import { galleryImageUrl } from "@/lib/gallery";
import { siteOrigin, venueAddress } from "@/lib/site";
import type { GalleryPhoto } from "@/lib/server/types";
import { GlobeStory, type StoryPhoto } from "@/components/landing/GlobeStory";

// The venue's Google Maps pin opens Maps where the visitor can tap Directions
// (Maps uses their current location as the start).
const DIRECTIONS_URL = "https://www.google.com/maps/place/Creamy+Castle/@6.1530455,6.8707098,17z/data=!4m6!3m5!1s0x104391000813ab1f:0xd5a4a36a91e7589a!8m2!3d6.1530455!4d6.8707098!16s%2Fg%2F11zyfx4_s9";
const PHONE_DISPLAY = "0813 969 3963";
const PHONE_E164 = "+2348139693963";
const origin = siteOrigin();

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Creamy Castle | Games & Treats in Ogidi",
  description: "Visit Creamy Castle in Ogidi for games for kids and teens, treats and member rewards. See venue photos, opening hours, phone number and directions.",
  alternates: origin ? { canonical: origin } : undefined,
  openGraph: origin ? {
    title: "Creamy Castle | Games & Treats in Ogidi",
    description: "Explore games and treats at Creamy Castle in Ogidi. See the venue and plan your visit.",
    url: origin,
    siteName: "Creamy Castle",
    type: "website",
    images: [{ url: `${origin}/img/cc-bg-desktop.png`, alt: "Illustration of a colourful family play venue" }],
  } : undefined,
  twitter: { card: "summary_large_image" },
};

async function publishedPhotos(): Promise<GalleryPhoto[]> {
  try {
    const db = await getPublicDb();
    return await db.collection<GalleryPhoto>("gallery").find({ published: true }).sort({ createdAt: -1 }).limit(40).toArray();
  } catch {
    // The public page stays available if the database is temporarily down.
    return [];
  }
}

export default async function LandingPage() {
  const photos = await publishedPhotos();
  const address = venueAddress();
  const storyPhotos: StoryPhoto[] = photos.slice(0, 6).map((photo) => ({
    id: String(photo._id),
    src: galleryImageUrl(photo.url, 640),
    srcSet: `${galleryImageUrl(photo.url, 400)} 400w, ${galleryImageUrl(photo.url, 800)} 800w`,
    full: photo.url,
    alt: photo.alt,
  }));
  const structuredData = origin ? {
    "@context": "https://schema.org",
    "@type": address ? "LocalBusiness" : "Organization",
    name: "Creamy Castle",
    url: origin,
    telephone: PHONE_E164,
    sameAs: [DIRECTIONS_URL],
    ...(address ? {
      address: {
        "@type": "PostalAddress",
        ...(address.street ? { streetAddress: address.street } : {}),
        addressLocality: address.city,
        ...(address.region ? { addressRegion: address.region } : {}),
        addressCountry: address.country,
      },
      geo: { "@type": "GeoCoordinates", latitude: 6.1530455, longitude: 6.8707098 },
      hasMap: DIRECTIONS_URL,
      openingHoursSpecification: [
        { "@type": "OpeningHoursSpecification", dayOfWeek: ["Tuesday", "Wednesday", "Thursday"], opens: "08:00", closes: "17:00" },
        { "@type": "OpeningHoursSpecification", dayOfWeek: ["Friday", "Saturday", "Sunday"], opens: "08:00", closes: "19:00" },
      ],
      ...(photos.length ? { image: photos.map((photo) => photo.url) } : {}),
    } : {}),
  } : null;

  return (
    <main className="cc-site">
      {structuredData && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />}
      <section className="cc-landing" id="top" aria-labelledby="landing-title">
      <link rel="preload" as="image" href="/img/cc-bg-mobile.jpg" media="(max-width: 767px)" />
      <link rel="preload" as="image" href="/img/cc-bg-desktop.png" media="(min-width: 768px)" />
      <nav className="cc-public-nav" aria-label="Main navigation">
        <a href="#top" className="cc-public-brand"><IceCream size={24} weight="duotone" aria-hidden="true" /> Creamy Castle</a>
        <div className="cc-public-nav-links"><a href="#find-us">Find us</a><a href="#visit">Visit us</a></div>
      </nav>
      <div className="cc-landing-inner">
        <h1 id="landing-title" className="cc-landing-title">Where kids &amp; teens come to play</h1>
        <p className="cc-landing-sub">Games, treats and rewards — all the fun under one roof. Discover what’s waiting for you at Creamy Castle.</p>
        <div className="cc-landing-actions">
          <a href={DIRECTIONS_URL} target="_blank" rel="noreferrer" className="cc-btn cc-btn--ghost">
            <NavigationArrow size={20} weight="duotone" aria-hidden="true" /> Get directions
          </a>
          <Link href="/login" className="cc-btn cc-btn--primary">
            <SignIn size={20} weight="duotone" aria-hidden="true" /> Member login
          </Link>
        </div>
      </div>
      </section>

      <GlobeStory photos={storyPhotos} />
      <div className="cc-dawn" aria-hidden="true" />

      <section className="cc-visit" id="visit" aria-labelledby="visit-title">
        <div className="cc-visit-inner cc-reveal">
          <span className="cc-visit-badge"><MapPin size={32} weight="duotone" aria-hidden="true" /></span>
          <h2 id="visit-title">Come see us in person</h2>
          <p>Bring the family, find a game, and enjoy some time together. We’d love to see you.</p>
          {address && <p className="cc-visit-address">{address.street ? `${address.street}, ` : ""}{address.city}{address.region ? `, ${address.region}` : ""}</p>}
          <div className="cc-visit-hours">
            <h3>Opening hours</h3>
            <dl><div><dt>Monday</dt><dd>Closed</dd></div><div><dt>Tuesday – Thursday</dt><dd>8 am – 5 pm</dd></div><div><dt>Friday – Sunday</dt><dd>8 am – 7 pm</dd></div></dl>
          </div>
          <div className="cc-visit-actions">
            <a href={DIRECTIONS_URL} target="_blank" rel="noreferrer" className="cc-btn cc-btn--primary"><NavigationArrow size={19} weight="duotone" aria-hidden="true" /> Open directions</a>
            <a href={`tel:${PHONE_E164}`} className="cc-btn cc-btn--light"><Phone size={19} weight="duotone" aria-hidden="true" /> {PHONE_DISPLAY}</a>
          </div>
        </div>
      </section>

      <footer className="cc-footer">
        <a href="#top" className="cc-footer-brand"><IceCream size={23} weight="duotone" aria-hidden="true" /> Creamy Castle</a>
        <p>Games, treats and good times.</p>
        <div><a href="#find-us">Find us</a><a href="#visit">Visit us</a><Link href="/login">Member login</Link></div>
      </footer>
    </main>
  );
}
