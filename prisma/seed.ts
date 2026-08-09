import { randomBytes, scryptSync } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Inlined (kept identical to lib/password.ts) so the seed is a self-contained
// Node script with no cross-file TS import.
function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

async function main() {
  console.log("Seeding Game Pass…");

  // ── Admin & staff ───────────────────────────────────────────────────────
  await prisma.adminUser.upsert({
    where: { email: "admin@arcade.test" },
    update: {},
    create: {
      email: "admin@arcade.test",
      name: "Arcade Admin",
      passwordHash: hashPassword("admin1234"),
      role: "admin",
    },
  });
  await prisma.adminUser.upsert({
    where: { email: "staff@arcade.test" },
    update: {},
    create: {
      email: "staff@arcade.test",
      name: "Front Desk",
      passwordHash: hashPassword("staff1234"),
      role: "staff",
    },
  });

  // ── Games (physical activities) ─────────────────────────────────────────
  const games = [
    {
      slug: "soccer-challenge",
      name: "Soccer Challenge",
      description:
        "Test your striking accuracy against our smart goal. Curve it, blast it, place it — the sensors score every shot.",
      imageUrl: "https://picsum.photos/seed/soccerpitch/800/600",
      pointCost: 30,
      durationSeconds: 5 * 60,
      minPlayers: 1,
      maxPlayers: 2,
      location: "Ground Floor · Bay A1",
      minAge: 6,
      minHeightCm: null,
      instructions:
        "Place the ball on the marker, wait for the green light, then take your shots. You get 10 balls.",
      rules: "10 shots per session. Highest points combo wins. No crossing the shooting line.",
      safety: "Wear the provided grip shoes. Keep bystanders behind the netting.",
      featured: true,
    },
    {
      slug: "basketball-challenge",
      name: "Basketball Challenge",
      description:
        "Sink as many hoops as you can before the buzzer. The rim counts every basket automatically.",
      imageUrl: "https://picsum.photos/seed/basketballhoop/800/600",
      pointCost: 40,
      durationSeconds: 3 * 60,
      minPlayers: 1,
      maxPlayers: 1,
      location: "Ground Floor · Bay A2",
      minAge: 6,
      minHeightCm: null,
      instructions: "Grab a ball from the rack and shoot until the timer hits zero.",
      rules: "Free-throw line must be respected. Balls returned automatically.",
      safety: "Mind the moving hoop. No hanging on the rim.",
      featured: true,
    },
    {
      slug: "racing-simulator",
      name: "Racing Simulator",
      description:
        "Full-motion racing rig with force-feedback wheel and pedals. Set your fastest lap on the championship circuit.",
      imageUrl: "https://picsum.photos/seed/racingsim/800/600",
      pointCost: 50,
      durationSeconds: 10 * 60,
      minPlayers: 1,
      maxPlayers: 1,
      location: "First Floor · Sim Zone",
      minAge: 10,
      minHeightCm: 120,
      instructions: "Buckle the harness, adjust the seat, and follow the on-screen countdown.",
      rules: "Seatbelt must stay fastened. One driver per rig.",
      safety: "Motion platform tilts and vibrates. Not suitable for guests prone to motion sickness.",
      featured: true,
    },
    {
      slug: "bouncy-castle",
      name: "Bouncy Castle",
      description:
        "A giant inflatable playground for the little ones. Bounce, slide, and climb to your heart's content.",
      imageUrl: "https://picsum.photos/seed/bouncycastle/800/600",
      pointCost: 50,
      durationSeconds: 10 * 60,
      minPlayers: 1,
      maxPlayers: 8,
      location: "Kids Zone · Ground Floor",
      minAge: 3,
      minHeightCm: null,
      maxPlayersNote: undefined,
      instructions: "Shoes and sharp objects off before entering. Socks required.",
      rules: "Max 8 children at once. No food or drink inside.",
      safety: "Supervised by staff at all times. No somersaults or rough play.",
      featured: false,
    },
    {
      slug: "vr-shooting-arena",
      name: "VR Shooting Arena",
      description:
        "Strap into a wireless VR headset and take on waves of targets in a fast-paced shooting gallery.",
      imageUrl: "https://picsum.photos/seed/vrarena/800/600",
      pointCost: 60,
      durationSeconds: 8 * 60,
      minPlayers: 1,
      maxPlayers: 4,
      location: "First Floor · VR Deck",
      minAge: 12,
      minHeightCm: 130,
      instructions: "Staff will fit your headset and controllers. Stay within the glowing play boundary.",
      rules: "Remain inside the play zone. Report any discomfort immediately.",
      safety: "Play area monitored. Remove headset if you feel dizzy.",
      featured: false,
    },
    {
      slug: "mini-golf",
      name: "Mini Golf — 9 Holes",
      description:
        "A whimsical indoor mini-golf course with nine themed holes. Great for groups and families.",
      imageUrl: "https://picsum.photos/seed/minigolf/800/600",
      pointCost: 35,
      durationSeconds: 20 * 60,
      minPlayers: 1,
      maxPlayers: 4,
      location: "Second Floor · Green",
      minAge: 4,
      minHeightCm: null,
      instructions: "Collect a putter and ball from the kiosk. Keep the pace with the group ahead.",
      rules: "Max 4 per group. Please return putters after your round.",
      safety: "No swinging putters above knee height.",
      featured: false,
    },
  ];

  for (const g of games) {
    const { maxPlayersNote, ...data } = g as typeof g & { maxPlayersNote?: string };
    await prisma.game.upsert({
      where: { slug: g.slug },
      update: {
        name: data.name,
        description: data.description,
        imageUrl: data.imageUrl,
        pointCost: data.pointCost,
        durationSeconds: data.durationSeconds,
        location: data.location,
        featured: data.featured,
      },
      create: { status: "active", selfServiceMode: true, ...data },
    });
  }

  // Put one game under maintenance to exercise that state.
  // (kept active by default; admins can toggle)

  // ── Reward rules (configurable, not hardcoded) ──────────────────────────
  const rules = [
    {
      slug: "play-completed",
      name: "Play Completed",
      description: "Awarded every time a game session is completed.",
      conditionType: "play_completed",
      threshold: null,
      points: 5,
      priority: 10,
    },
    {
      slug: "high-score",
      name: "High Score Bonus",
      description: "Score above 80 in any scored game.",
      conditionType: "score_above",
      threshold: 80,
      points: 20,
      priority: 20,
    },
    {
      slug: "three-games",
      name: "Triple Play",
      description: "Awarded every 3rd completed game.",
      conditionType: "games_count",
      threshold: 3,
      points: 30,
      priority: 30,
    },
    {
      slug: "first-visit",
      name: "First Visit",
      description: "A one-time bonus for completing your very first game.",
      conditionType: "first_visit",
      threshold: null,
      points: 100,
      priority: 40,
    },
  ];

  for (const r of rules) {
    const existing = await prisma.rewardRule.findFirst({ where: { name: r.name } });
    if (existing) {
      await prisma.rewardRule.update({
        where: { id: existing.id },
        data: { points: r.points, threshold: r.threshold, active: true },
      });
    } else {
      await prisma.rewardRule.create({
        data: {
          name: r.name,
          description: r.description,
          conditionType: r.conditionType,
          threshold: r.threshold,
          points: r.points,
          priority: r.priority,
          active: true,
        },
      });
    }
  }

  // ── Point packages ──────────────────────────────────────────────────────
  const packages = [
    { name: "Starter — 500 points", points: 500, bonusPoints: 0, priceKobo: 250_000, sortOrder: 1 },
    { name: "Value — 1,000 points", points: 1000, bonusPoints: 100, priceKobo: 500_000, sortOrder: 2 },
    { name: "Pro — 2,500 points", points: 2500, bonusPoints: 400, priceKobo: 1_150_000, sortOrder: 3 },
    { name: "Ultimate — 5,000 points", points: 5000, bonusPoints: 1000, priceKobo: 2_200_000, sortOrder: 4 },
  ];
  for (const p of packages) {
    const existing = await prisma.pointPackage.findFirst({ where: { name: p.name } });
    if (existing) {
      await prisma.pointPackage.update({ where: { id: existing.id }, data: { ...p, active: true } });
    } else {
      await prisma.pointPackage.create({ data: { ...p, currency: "NGN", active: true } });
    }
  }

  const counts = {
    games: await prisma.game.count(),
    rewardRules: await prisma.rewardRule.count(),
    packages: await prisma.pointPackage.count(),
    admins: await prisma.adminUser.count(),
  };
  console.log("Seed complete:", counts);
  console.log("Admin login: admin@arcade.test / admin1234");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
