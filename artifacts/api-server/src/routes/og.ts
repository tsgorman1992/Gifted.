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
  _amount?: number | null,
): string {
  const p = EXPERIENCES[experience] ?? FALLBACK;
  const dark = p.isDark;

  const textPrimary    = dark ? "#FFFFFF" : "#1a0e06";
  const textSecondary  = dark ? "rgba(255,255,255,0.68)" : "rgba(30,15,5,0.58)";
  const logoColor      = dark ? "rgba(255,255,255,0.82)" : "#7a4a1e";
  const bowFill        = dark ? "rgba(255,255,255,0.26)" : "rgba(255,255,255,0.40)";
  const knotFill       = dark ? "rgba(255,255,255,0.38)" : "rgba(255,255,255,0.60)";
  const glowFill       = dark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.16)";
  const ctaFill        = dark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.40)";
  const ctaStroke      = dark ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.70)";
  const ctaText        = dark ? "rgba(255,255,255,0.88)" : "#3d2010";
  const sp             = dark ? 0.44 : 0.54;

  const name   = esc(truncate(recipientName || "you", 18));
  const sender = esc(truncate(senderName    || "someone special", 28));

  const nameLen      = name.length;
  const nameFontSize = nameLen <= 6 ? 108 : nameLen <= 10 ? 88 : nameLen <= 14 ? 72 : 60;
  const nameY        = 368;
  const fromY        = nameY + 58;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"   stop-color="${p.from}" />
      <stop offset="50%"  stop-color="${p.via}"  />
      <stop offset="100%" stop-color="${p.to}"   />
    </linearGradient>
  </defs>

  <!-- Full-bleed background -->
  <rect width="1200" height="630" fill="url(#bg)" />

  <!-- Atmospheric depth glows -->
  <circle cx="960"  cy="90"  r="300" fill="${glowFill}" />
  <circle cx="1110" cy="530" r="210" fill="${glowFill}" />

  <!-- ── GIFT BOW (right side, knot at ~980,185) ── -->
  <!-- Left loop -->
  <ellipse cx="905" cy="146" rx="84" ry="33" fill="${bowFill}" transform="rotate(28,905,146)" />
  <!-- Right loop -->
  <ellipse cx="1055" cy="146" rx="84" ry="33" fill="${bowFill}" transform="rotate(-28,1055,146)" />
  <!-- Ribbon tails -->
  <path d="M980,188 C954,230 923,274 904,326"
    stroke="${bowFill}" stroke-width="12" fill="none" stroke-linecap="round" />
  <path d="M980,188 C1006,230 1037,274 1056,326"
    stroke="${bowFill}" stroke-width="12" fill="none" stroke-linecap="round" />
  <!-- Knot -->
  <circle cx="980" cy="182" r="23" fill="${knotFill}" />

  <!-- ── SPARKLE STARS ── -->
  <g transform="translate(856,76)" opacity="${sp.toFixed(2)}">
    <polygon points="0,-21 3,0 0,21 -3,0" fill="white" />
    <polygon points="-21,0 0,-3 21,0 0,3" fill="white" />
  </g>
  <g transform="translate(1148,238)" opacity="${(sp * 0.68).toFixed(2)}">
    <polygon points="0,-15 2,0 0,15 -2,0" fill="white" />
    <polygon points="-15,0 0,-2 15,0 0,2" fill="white" />
  </g>
  <g transform="translate(1088,44)" opacity="${(sp * 0.58).toFixed(2)}">
    <polygon points="0,-10 1.5,0 0,10 -1.5,0" fill="white" />
    <polygon points="-10,0 0,-1.5 10,0 0,1.5" fill="white" />
  </g>
  <g transform="translate(1160,390)" opacity="${(sp * 0.48).toFixed(2)}">
    <polygon points="0,-8 1.2,0 0,8 -1.2,0" fill="white" />
    <polygon points="-8,0 0,-1.2 8,0 0,1.2" fill="white" />
  </g>

  <!-- ── TEXT (left side) ── -->

  <!-- gifted. wordmark — top left, small -->
  <text x="72" y="72"
    font-family="Georgia, 'Times New Roman', serif"
    font-size="26"
    font-weight="700"
    letter-spacing="0.5"
    fill="${logoColor}">gifted.</text>

  <!-- "A GIFT FOR" label -->
  <text x="72" y="250"
    font-family="Arial, Helvetica, sans-serif"
    font-size="20"
    font-weight="400"
    letter-spacing="4"
    fill="${textSecondary}">A GIFT FOR</text>

  <!-- Recipient name — big, adaptive font size -->
  <text x="72" y="${nameY}"
    font-family="Georgia, 'Times New Roman', serif"
    font-size="${nameFontSize}"
    font-weight="700"
    fill="${textPrimary}">${name}</text>

  <!-- "from [sender]" -->
  <text x="72" y="${fromY}"
    font-family="Arial, Helvetica, sans-serif"
    font-size="26"
    font-weight="300"
    fill="${textSecondary}">from ${sender}</text>

  <!-- ── CTA PILL (bottom left) ── -->
  <rect x="72" y="548" width="302" height="50" rx="25" fill="${ctaFill}" stroke="${ctaStroke}" stroke-width="1.5" />
  <text x="223" y="579"
    font-family="Arial, Helvetica, sans-serif"
    font-size="19"
    font-weight="600"
    text-anchor="middle"
    fill="${ctaText}">Tap to open your gift</text>
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
