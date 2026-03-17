import { Router } from "express";
import { Resvg } from "@resvg/resvg-js";
import { db, gifts } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

interface ExperiencePalette {
  from: string;
  via: string;
  to: string;
  isDark: boolean;
  name: string;
  tagline: string;
}

const EXPERIENCES: Record<string, ExperiencePalette> = {
  "confetti-burst":  { from: "#FF6B6B", via: "#FFD93D", to: "#6BCB77", isDark: false, name: "Confetti Burst",  tagline: "Bright & celebratory" },
  "golden-hour":     { from: "#F7C59F", via: "#E8A87C", to: "#D4813A", isDark: false, name: "Golden Hour",     tagline: "Warm & romantic" },
  "garden-bloom":    { from: "#FFB7C5", via: "#C7CEEA", to: "#B5EAD7", isDark: false, name: "Garden Bloom",    tagline: "Soft & new beginnings" },
  "midnight-stars":  { from: "#0f0c29", via: "#302b63", to: "#24243e", isDark: true,  name: "Midnight Stars",  tagline: "Bold & elevated" },
  "rose-petal":      { from: "#FFB7C5", via: "#FF8FAB", to: "#E8A7B1", isDark: false, name: "Rose Petal",      tagline: "Elegant & timeless" },
  "snow-flurry":     { from: "#BDE0FE", via: "#A2D2FF", to: "#CDB4DB", isDark: false, name: "Snow Flurry",     tagline: "Crisp & festive" },
  "sunrise":         { from: "#FFCBA4", via: "#FF9A8B", to: "#FF6A88", isDark: false, name: "Sunrise",         tagline: "Warm & heartfelt" },
};

const FALLBACK = EXPERIENCES["golden-hour"];

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

function buildGiftSvg(
  recipientName: string,
  senderName: string,
  experience: string,
  amount?: number | null,
): string {
  const p = EXPERIENCES[experience] ?? FALLBACK;
  const dark = p.isDark;

  const textPrimary   = dark ? "#FFFFFF" : "#1a0e06";
  const textSecondary = dark ? "rgba(255,255,255,0.75)" : "rgba(30,15,5,0.65)";
  const cardBg        = dark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.55)";
  const cardStroke    = dark ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.9)";
  const logoColor     = dark ? "rgba(255,255,255,0.9)" : "#7a4a1e";
  const dotColor      = dark ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.45)";
  const tagBg         = dark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.6)";
  const tagText       = dark ? "rgba(255,255,255,0.85)" : "#7a4a1e";

  const name   = esc(truncate(recipientName || "you", 22));
  const sender = esc(truncate(senderName    || "someone special", 28));

  const amountBadge = amount
    ? `
      <rect x="88" y="436" width="148" height="44" rx="22" fill="${dark ? "rgba(255,255,255,0.18)" : "rgba(122,74,30,0.15)"}" />
      <text x="162" y="464" font-family="Georgia, 'Times New Roman', serif" font-size="22" font-weight="700" text-anchor="middle" fill="${dark ? "#fff" : "#7a4a1e"}">$${amount.toFixed(0)} inside</text>
    `
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"   stop-color="${p.from}" />
      <stop offset="50%"  stop-color="${p.via}"  />
      <stop offset="100%" stop-color="${p.to}"   />
    </linearGradient>
    <linearGradient id="card-shimmer" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"   stop-color="${cardBg}" />
      <stop offset="100%" stop-color="${dark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.35)"}" />
    </linearGradient>
  </defs>

  <!-- Background gradient -->
  <rect width="1200" height="630" fill="url(#bg)" />

  <!-- Decorative dots -->
  <circle cx="980" cy="80"  r="180" fill="${dotColor}" />
  <circle cx="1120" cy="400" r="120" fill="${dotColor}" />
  <circle cx="60"  cy="520" r="90"  fill="${dotColor}" />

  <!-- Gift ribbon decoration (top-right corner) -->
  <g opacity="0.22">
    <line x1="980" y1="0" x2="980" y2="220" stroke="${dark ? "#fff" : "#fff"}" stroke-width="6" />
    <line x1="840" y1="80" x2="1140" y2="80" stroke="${dark ? "#fff" : "#fff"}" stroke-width="6" />
    <circle cx="980" cy="80" r="18" fill="${dark ? "#fff" : "#fff"}" />
  </g>

  <!-- Glass card -->
  <rect x="72" y="120" width="680" height="410" rx="28" fill="url(#card-shimmer)" stroke="${cardStroke}" stroke-width="1.5" />

  <!-- gifted. wordmark -->
  <text x="108" y="186"
    font-family="Georgia, 'Times New Roman', serif"
    font-size="28"
    font-weight="700"
    letter-spacing="1"
    fill="${logoColor}">gifted.</text>

  <!-- Experience tag -->
  <rect x="108" y="202" width="${esc(String(p.tagline.length * 10 + 24))}" height="30" rx="15" fill="${tagBg}" />
  <text x="${esc(String(108 + (p.tagline.length * 10 + 24) / 2))}" y="222"
    font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    font-size="14"
    font-weight="600"
    text-anchor="middle"
    fill="${tagText}">${esc(p.tagline)}</text>

  <!-- "A gift for" label -->
  <text x="108" y="310"
    font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    font-size="22"
    font-weight="500"
    fill="${textSecondary}">A gift for</text>

  <!-- Recipient name — big headline -->
  <text x="108" y="378"
    font-family="Georgia, 'Times New Roman', serif"
    font-size="72"
    font-weight="700"
    fill="${textPrimary}">${name}</text>

  <!-- "from sender" line -->
  <text x="108" y="424"
    font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    font-size="24"
    font-weight="400"
    fill="${textSecondary}">from ${sender}</text>

  ${amountBadge}

  <!-- Right-side tagline -->
  <text x="880" y="558"
    font-family="Georgia, 'Times New Roman', serif"
    font-size="20"
    font-weight="400"
    text-anchor="middle"
    fill="${dark ? "rgba(255,255,255,0.5)" : "rgba(30,15,5,0.4)"}"
    font-style="italic">send more than just a gift.</text>
</svg>`;
}

function buildMainSvg(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"   stop-color="#F7C59F" />
      <stop offset="50%"  stop-color="#E8A87C" />
      <stop offset="100%" stop-color="#D4813A" />
    </linearGradient>
    <linearGradient id="card" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"   stop-color="rgba(255,255,255,0.62)" />
      <stop offset="100%" stop-color="rgba(255,255,255,0.38)" />
    </linearGradient>
  </defs>

  <rect width="1200" height="630" fill="url(#bg)" />

  <!-- Decorative circles -->
  <circle cx="1050" cy="100" r="200" fill="rgba(255,255,255,0.18)" />
  <circle cx="1160" cy="480" r="140" fill="rgba(255,255,255,0.12)" />
  <circle cx="80"   cy="540" r="100" fill="rgba(255,255,255,0.14)" />

  <!-- Ribbon decoration -->
  <g opacity="0.25">
    <line x1="1050" y1="0"   x2="1050" y2="240" stroke="#fff" stroke-width="7" />
    <line x1="900"  y1="100" x2="1200" y2="100" stroke="#fff" stroke-width="7" />
    <circle cx="1050" cy="100" r="22" fill="#fff" />
  </g>

  <!-- Glass card -->
  <rect x="72" y="100" width="740" height="430" rx="32" fill="url(#card)" stroke="rgba(255,255,255,0.9)" stroke-width="1.5" />

  <!-- gifted. wordmark — large -->
  <text x="120" y="210"
    font-family="Georgia, 'Times New Roman', serif"
    font-size="86"
    font-weight="700"
    letter-spacing="-2"
    fill="#7a4a1e">gifted.</text>

  <!-- Tagline -->
  <text x="120" y="268"
    font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    font-size="28"
    font-weight="400"
    fill="rgba(30,15,5,0.62)">Send more than just a gift.</text>

  <!-- Divider -->
  <line x1="120" y1="305" x2="460" y2="305" stroke="rgba(122,74,30,0.25)" stroke-width="1.5" />

  <!-- Feature pills -->
  <rect x="120" y="328" width="148" height="38" rx="19" fill="rgba(122,74,30,0.12)" />
  <text x="194" y="352" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="16" font-weight="600" text-anchor="middle" fill="#7a4a1e">Personal message</text>

  <rect x="280" y="328" width="96" height="38" rx="19" fill="rgba(122,74,30,0.12)" />
  <text x="328" y="352" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="16" font-weight="600" text-anchor="middle" fill="#7a4a1e">Video</text>

  <rect x="120" y="378" width="96" height="38" rx="19" fill="rgba(122,74,30,0.12)" />
  <text x="168" y="402" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="16" font-weight="600" text-anchor="middle" fill="#7a4a1e">Photos</text>

  <rect x="228" y="378" width="148" height="38" rx="19" fill="rgba(122,74,30,0.12)" />
  <text x="302" y="402" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="16" font-weight="600" text-anchor="middle" fill="#7a4a1e">Cash balance</text>

  <!-- Bottom tagline -->
  <text x="692" y="430" width="200"
    font-family="Georgia, 'Times New Roman', serif"
    font-size="19"
    font-weight="400"
    text-anchor="middle"
    fill="rgba(30,15,5,0.38)"
    font-style="italic">an unforgettable experience.</text>

  <!-- URL hint -->
  <text x="120" y="490"
    font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    font-size="18"
    font-weight="500"
    fill="rgba(122,74,30,0.5)">gifted.replit.app</text>
</svg>`;
}

function svgToPng(svg: string): Buffer {
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width" as const, value: 1200 },
  });
  return Buffer.from(resvg.render().asPng());
}

router.get("/gift/:id", async (req, res) => {
  const { id } = req.params;
  let name = "you";
  let from = "someone special";
  let exp  = "golden-hour";
  let amount: number | null = null;

  try {
    const [gift] = await db.select().from(gifts).where(eq(gifts.id, id)).limit(1);
    if (gift) {
      name   = gift.recipientName;
      from   = gift.senderName;
      exp    = gift.experience;
      const raw = (gift as Record<string, unknown>).amount;
      if (raw) amount = parseFloat(String(raw));
    }
  } catch (err) {
    console.error("OG image error:", err);
  }

  const svg = buildGiftSvg(name, from, exp, amount && !isNaN(amount) ? amount : null);
  const png = svgToPng(svg);

  res.setHeader("Content-Type", "image/png");
  res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=86400");
  res.send(png);
});

router.get("/main", (_req, res) => {
  const png = svgToPng(buildMainSvg());
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.send(png);
});

export default router;
