import React, { useState, useEffect, useRef, useMemo } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence, useInView } from "framer-motion";
import confetti from "canvas-confetti";
import { Button } from "@/components/ui/button";
import { Play, Sparkles, Gift, Star, Heart, Snowflake, Sun, Flower2, Music, ExternalLink, X, ZoomIn } from "lucide-react";
import { mockGiftData } from "@/lib/mock-data";
import { gradientStyle, DEFAULT_EXPERIENCE } from "@/lib/experiences";

// ─── Experience configs ──────────────────────────────────────────────────────

type TitleStyle    = "word-burst" | "blur-in" | "bloom" | "typewriter" | "elegant-fade" | "crisp-fall" | "rise";
type SectionStyle  = "spring-pop" | "fade-drift" | "bloom-scale" | "materialize" | "slide-alternate" | "fall-in" | "rise-stagger";
type AmountStyle   = "count-up" | "glow-reveal" | "bloom-pop" | "stellar-reveal" | "elegant-reveal" | "crystallize" | "warm-reveal";
type AmbientEffect = "petals" | "rose-petals" | "snow" | "stars";
type PreIconAnim   = "bounce" | "pulse-slow" | "float" | "twinkle" | "heartbeat" | "spin-slow" | "rise";

interface CardStyle {
  shadow: string;
  border: string;
  bg?: string;
}

interface RevealCfg {
  titleStyle: TitleStyle;
  sectionStyle: SectionStyle;
  amountStyle: AmountStyle;
  sectionStagger: number;
  sectionInitialDelay: number;
  heroDelay: number;
  heroDuration: number;
  senderText: string;
  isDark: boolean;
  envelopeExit: Record<string, unknown>;
  envelopeTransition: Record<string, unknown>;
  ambientEffect?: AmbientEffect;
  ambientIntensity: "low" | "medium" | "high";
  preIconAnim: PreIconAnim;
  preIconColorClass: string;
  cardStyle: CardStyle;
}

const CONFIGS: Record<string, RevealCfg> = {
  "confetti-burst": {
    titleStyle: "word-burst",
    sectionStyle: "spring-pop",
    amountStyle: "count-up",
    sectionStagger: 0.12,
    sectionInitialDelay: 0.5,
    heroDelay: 0.25,
    heroDuration: 0.5,
    senderText: "Sent by",
    isDark: false,
    envelopeExit: { opacity: 0, y: -70, scale: 0.88 },
    envelopeTransition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] },
    preIconAnim: "bounce",
    preIconColorClass: "text-rose-500",
    ambientIntensity: "medium",
    cardStyle: {
      shadow: "0 8px 40px rgba(255,107,107,0.22), 0 2px 12px rgba(255,217,61,0.15)",
      border: "rgba(255,107,107,0.22)",
    },
  },
  "golden-hour": {
    titleStyle: "blur-in",
    sectionStyle: "fade-drift",
    amountStyle: "glow-reveal",
    sectionStagger: 0.36,
    sectionInitialDelay: 1.2,
    heroDelay: 0.65,
    heroDuration: 1.3,
    senderText: "A gift from",
    isDark: false,
    envelopeExit: { opacity: 0, scale: 1.07 },
    envelopeTransition: { duration: 0.9, ease: "easeInOut" },
    preIconAnim: "pulse-slow",
    preIconColorClass: "text-amber-400",
    ambientIntensity: "low",
    cardStyle: {
      shadow: "0 8px 40px rgba(232,168,124,0.22)",
      border: "rgba(232,168,124,0.3)",
      bg: "rgba(247,197,159,0.07)",
    },
  },
  "garden-bloom": {
    titleStyle: "bloom",
    sectionStyle: "bloom-scale",
    amountStyle: "bloom-pop",
    sectionStagger: 0.18,
    sectionInitialDelay: 0.8,
    heroDelay: 0.4,
    heroDuration: 0.95,
    senderText: "With love from",
    isDark: false,
    envelopeExit: { opacity: 0, scale: 1.15, filter: "blur(10px)" },
    envelopeTransition: { duration: 0.7, ease: "easeOut" },
    ambientEffect: "petals",
    ambientIntensity: "high",
    preIconAnim: "float",
    preIconColorClass: "text-pink-400",
    cardStyle: {
      shadow: "0 8px 32px rgba(181,234,215,0.35)",
      border: "rgba(199,206,234,0.4)",
      bg: "rgba(181,234,215,0.08)",
    },
  },
  "midnight-stars": {
    titleStyle: "typewriter",
    sectionStyle: "materialize",
    amountStyle: "stellar-reveal",
    sectionStagger: 0.28,
    sectionInitialDelay: 1.1,
    heroDelay: 0.55,
    heroDuration: 1.1,
    senderText: "Sent by",
    isDark: true,
    envelopeExit: { opacity: 0, scale: 0.84 },
    envelopeTransition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
    ambientEffect: "stars",
    ambientIntensity: "medium",
    preIconAnim: "twinkle",
    preIconColorClass: "text-indigo-300",
    cardStyle: {
      shadow: "0 0 60px rgba(150,140,255,0.18), 0 25px 50px rgba(0,0,0,0.5)",
      border: "rgba(255,255,255,0.12)",
      bg: "rgba(255,255,255,0.05)",
    },
  },
  "rose-petal": {
    titleStyle: "elegant-fade",
    sectionStyle: "slide-alternate",
    amountStyle: "elegant-reveal",
    sectionStagger: 0.22,
    sectionInitialDelay: 0.9,
    heroDelay: 0.4,
    heroDuration: 0.85,
    senderText: "Sent with care by",
    isDark: false,
    envelopeExit: { opacity: 0, x: 60, rotateZ: 2 },
    envelopeTransition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
    ambientEffect: "rose-petals",
    ambientIntensity: "high",
    preIconAnim: "heartbeat",
    preIconColorClass: "text-rose-400",
    cardStyle: {
      shadow: "0 8px 36px rgba(255,143,171,0.25)",
      border: "rgba(255,183,197,0.4)",
      bg: "rgba(255,183,197,0.06)",
    },
  },
  "snow-flurry": {
    titleStyle: "crisp-fall",
    sectionStyle: "fall-in",
    amountStyle: "crystallize",
    sectionStagger: 0.1,
    sectionInitialDelay: 0.65,
    heroDelay: 0.3,
    heroDuration: 0.6,
    senderText: "Gifted by",
    isDark: false,
    envelopeExit: { opacity: 0, y: 35, scale: 0.94 },
    envelopeTransition: { duration: 0.38, ease: "easeIn" },
    ambientEffect: "snow",
    ambientIntensity: "high",
    preIconAnim: "spin-slow",
    preIconColorClass: "text-sky-400",
    cardStyle: {
      shadow: "0 0 18px rgba(147,197,253,0.45), 0 8px 32px rgba(147,197,253,0.18)",
      border: "rgba(147,197,253,0.5)",
      bg: "rgba(219,234,254,0.32)",
    },
  },
  "sunrise": {
    titleStyle: "rise",
    sectionStyle: "rise-stagger",
    amountStyle: "warm-reveal",
    sectionStagger: 0.24,
    sectionInitialDelay: 1.0,
    heroDelay: 0.5,
    heroDuration: 1.15,
    senderText: "From",
    isDark: false,
    envelopeExit: { opacity: 0, y: 90, filter: "blur(4px)" },
    envelopeTransition: { duration: 0.72, ease: [0.16, 1, 0.3, 1] },
    preIconAnim: "rise",
    preIconColorClass: "text-orange-400",
    ambientIntensity: "low",
    cardStyle: {
      shadow: "0 8px 36px rgba(251,146,60,0.18)",
      border: "rgba(253,186,116,0.3)",
      bg: "rgba(254,215,170,0.07)",
    },
  },
};

// ─── Section variant factory ─────────────────────────────────────────────────

function sectionVariant(style: SectionStyle, idx: number) {
  switch (style) {
    case "spring-pop":
      return {
        initial: { opacity: 0, scale: 0.92, y: 20 },
        animate: { opacity: 1, scale: 1, y: 0 },
        transition: { type: "spring" as const, stiffness: 320, damping: 26 },
      };
    case "fade-drift":
      return {
        initial: { opacity: 0, y: 32 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.95, ease: [0.16, 1, 0.3, 1] as number[] },
      };
    case "bloom-scale":
      return {
        initial: { opacity: 0, scale: 0.87 },
        animate: { opacity: 1, scale: 1 },
        transition: { type: "spring" as const, stiffness: 200, damping: 22 },
      };
    case "materialize":
      return {
        initial: { opacity: 0, filter: "blur(14px)" },
        animate: { opacity: 1, filter: "blur(0px)" },
        transition: { duration: 0.85 },
      };
    case "slide-alternate":
      return {
        initial: { opacity: 0, x: idx % 2 === 0 ? -44 : 44 },
        animate: { opacity: 1, x: 0 },
        transition: { duration: 0.72, ease: [0.22, 1, 0.36, 1] as number[] },
      };
    case "fall-in":
      return {
        initial: { opacity: 0, y: -32 },
        animate: { opacity: 1, y: 0 },
        transition: { type: "spring" as const, stiffness: 300, damping: 30 },
      };
    case "rise-stagger":
      return {
        initial: { opacity: 0, y: 60 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 1.05, ease: [0.16, 1, 0.3, 1] as number[] },
      };
  }
}

// ─── Small helpers ───────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 1500, delay = 0, enabled = false) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const t = setTimeout(() => {
      const start = Date.now();
      const tick = () => {
        const p = Math.min((Date.now() - start) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        setVal(p >= 1 ? target : Math.round(eased * target));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, delay);
    return () => clearTimeout(t);
  }, [enabled, target, duration, delay]);
  return val;
}

function formatAmt(raw: string | null): string {
  if (!raw) return "0";
  const n = parseFloat(raw);
  if (isNaN(n)) return raw;
  return n % 1 === 0 ? String(Math.round(n)) : n.toFixed(2);
}

function TypewriterText({ text, delayS = 0, speed = 55 }: { text: string; delayS?: number; speed?: number }) {
  const [chars, setChars] = useState(0);
  useEffect(() => {
    let i = 0;
    const t = setTimeout(() => {
      const iv = setInterval(() => {
        i++;
        setChars(i);
        if (i >= text.length) clearInterval(iv);
      }, speed);
      return () => clearInterval(iv);
    }, delayS * 1000);
    return () => clearTimeout(t);
  }, [text, delayS, speed]);
  return (
    <span>
      {text.slice(0, chars)}
      {chars < text.length && <span className="opacity-50 animate-pulse">|</span>}
    </span>
  );
}

function WordBurstTitle({ text, delayS = 0 }: { text: string; delayS?: number }) {
  return (
    <>
      {text.split(" ").map((word, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, y: 28, scale: 0.72 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: delayS + i * 0.09, type: "spring", stiffness: 380, damping: 22 }}
          style={{ display: "inline-block", marginRight: "0.28em" }}
        >
          {word}
        </motion.span>
      ))}
    </>
  );
}

function StarfieldBg() {
  const stars = useMemo(() =>
    Array.from({ length: 90 }, (_, id) => ({
      id,
      left: Math.random() * 100,
      top: Math.random() * 100,
      size: 1 + Math.random() * 2.2,
      dur: 2 + Math.random() * 4,
      del: Math.random() * 5,
      op: 0.25 + Math.random() * 0.75,
    })), []);

  useEffect(() => {
    const sid = "gifted-starfield-style";
    if (!document.getElementById(sid)) {
      const s = document.createElement("style");
      s.id = sid;
      s.textContent = `
        @keyframes gifted-twinkle {
          0%   { opacity: var(--op-lo); transform: scale(0.85); }
          100% { opacity: var(--op-hi); transform: scale(1.15); }
        }
      `;
      document.head.appendChild(s);
    }
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
      {stars.map(s => (
        <div
          key={s.id}
          style={{
            position: "absolute",
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            borderRadius: "50%",
            background: "white",
            "--op-lo": s.op * 0.3,
            "--op-hi": s.op,
            animation: `gifted-twinkle ${s.dur}s ${s.del}s ease-in-out infinite alternate`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

// ─── Golden Hour bokeh atmosphere ────────────────────────────────────────────

function GoldenHourBokeh() {
  const circles = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => ({
      id: i,
      left: 5 + Math.random() * 88,
      top: 10 + Math.random() * 75,
      size: 120 + Math.random() * 200,
      dur: 12 + Math.random() * 10,
      del: Math.random() * 7,
      opacity: 0.04 + Math.random() * 0.07,
    })),
    []
  );

  useEffect(() => {
    const sid = "gifted-bokeh-kf";
    if (!document.getElementById(sid)) {
      const s = document.createElement("style");
      s.id = sid;
      s.textContent = `@keyframes gifted-bokeh-drift{0%{transform:translate(-50%,-50%) translateY(0);}50%{transform:translate(-50%,-50%) translateY(-28px);}100%{transform:translate(-50%,-50%) translateY(0);}}`;
      document.head.appendChild(s);
    }
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 1 }}>
      {circles.map(c => (
        <div
          key={c.id}
          style={{
            position: "absolute",
            left: `${c.left}%`,
            top: `${c.top}%`,
            width: c.size,
            height: c.size,
            borderRadius: "50%",
            background: `radial-gradient(circle, rgba(247,197,130,${c.opacity * 2.2}) 0%, rgba(232,168,80,${c.opacity}) 45%, transparent 70%)`,
            animation: `gifted-bokeh-drift ${c.dur}s ${c.del}s ease-in-out infinite`,
            transform: "translate(-50%, -50%)",
            filter: "blur(2px)",
          }}
        />
      ))}
    </div>
  );
}

// ─── Sunrise light ray overlay ────────────────────────────────────────────────

function SunriseLightRay() {
  useEffect(() => {
    const sid = "gifted-sunrise-kf";
    if (!document.getElementById(sid)) {
      const s = document.createElement("style");
      s.id = sid;
      s.textContent = `@keyframes gifted-sunrise-pulse{0%,100%{opacity:0.55;}50%{opacity:1;}}`;
      document.head.appendChild(s);
    }
  }, []);

  return (
    <>
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          zIndex: 1,
          background: "radial-gradient(ellipse 90% 55% at 50% 85%, rgba(255,203,130,0.14), transparent 70%)",
          animation: "gifted-sunrise-pulse 4.5s ease-in-out infinite",
        }}
      />
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          zIndex: 1,
          background: "conic-gradient(from 250deg at 50% 100%, transparent 30deg, rgba(255,160,80,0.06) 50deg, transparent 70deg, transparent 100%)",
          animation: "gifted-sunrise-pulse 6s 1.5s ease-in-out infinite",
        }}
      />
    </>
  );
}

// ─── Garden Bloom floral watermark ───────────────────────────────────────────

function GardenBloomWatermark() {
  const motifs: Array<React.CSSProperties & { emoji: string }> = [
    { top: "6%", right: "5%", fontSize: 38, transform: "rotate(12deg)", opacity: 0.11, emoji: "🌸" },
    { top: "55%", left: "3%", fontSize: 26, transform: "rotate(-8deg)", opacity: 0.09, emoji: "🌿" },
    { bottom: "8%", right: "14%", fontSize: 30, transform: "rotate(25deg)", opacity: 0.1, emoji: "🌸" },
    { top: "32%", right: "2%", fontSize: 18, transform: "rotate(-20deg)", opacity: 0.08, emoji: "🌿" },
  ];
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden select-none" style={{ borderRadius: "inherit" }}>
      {motifs.map((m, i) => {
        const { emoji, ...style } = m;
        return (
          <span key={i} className="absolute leading-none" style={style}>
            {emoji}
          </span>
        );
      })}
    </div>
  );
}

// ─── Pre-reveal icon animation ────────────────────────────────────────────────

function preIconMotionProps(anim: PreIconAnim) {
  switch (anim) {
    case "bounce":
      return {
        animate: { y: [0, -12, 0] },
        transition: { repeat: Infinity, duration: 0.9, ease: "easeInOut" },
      };
    case "pulse-slow":
      return {
        animate: { scale: [1, 1.12, 1], opacity: [0.8, 1, 0.8] },
        transition: { repeat: Infinity, duration: 2.4, ease: "easeInOut" },
      };
    case "float":
      return {
        animate: { y: [0, -8, 0], rotate: [0, 6, -6, 0] },
        transition: { repeat: Infinity, duration: 3, ease: "easeInOut" },
      };
    case "twinkle":
      return {
        animate: { opacity: [0.3, 1, 0.3], scale: [0.92, 1.08, 0.92] },
        transition: { repeat: Infinity, duration: 1.8, ease: "easeInOut" },
      };
    case "heartbeat":
      return {
        animate: { scale: [1, 1.22, 1, 1.12, 1] },
        transition: { repeat: Infinity, duration: 1.2, ease: "easeInOut" },
      };
    case "spin-slow":
      return {
        animate: { rotate: 360 },
        transition: { repeat: Infinity, duration: 4, ease: "linear" },
      };
    case "rise":
      return {
        animate: { y: [0, -6, 0], scale: [1, 1.06, 1] },
        transition: { repeat: Infinity, duration: 2.8, ease: "easeInOut" },
      };
  }
}

const PRE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "confetti-burst": Gift,
  "golden-hour":    Sparkles,
  "garden-bloom":   Flower2,
  "midnight-stars": Star,
  "rose-petal":     Heart,
  "snow-flurry":    Snowflake,
  "sunrise":        Sun,
};

// ─── Particle system ─────────────────────────────────────────────────────────

function injectParticleStyles() {
  const sid = "gifted-particle-styles";
  if (document.getElementById(sid)) return;
  const s = document.createElement("style");
  s.id = sid;
  s.textContent = `
    @keyframes gifted-petal-fall {
      0%   { transform: translateY(-10vh) translateX(0) rotate(0deg); opacity: 1; }
      80%  { opacity: 1; }
      100% { transform: translateY(110vh) translateX(var(--drift)) rotate(var(--spin)); opacity: 0; }
    }
    @keyframes gifted-snow-fall {
      0%   { transform: translateY(-5vh) translateX(0); opacity: 0.9; }
      100% { transform: translateY(108vh) translateX(var(--drift)); opacity: 0; }
    }
    .gifted-particle {
      position: fixed;
      pointer-events: none;
      z-index: 9999;
      border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%;
    }
  `;
  document.head.appendChild(s);
}

type ParticleCfg = {
  colors: string[];
  sizes: [number, number];
  batchSize: number;
  batchInterval: number;
  duration: [number, number];
  keyframe: string;
  shape?: "circle";
  startDelay?: number;
};

const PARTICLE_CFGS: Partial<Record<AmbientEffect, ParticleCfg>> = {
  petals: {
    colors: ["#FFB7C5", "#C7CEEA", "#B5EAD7", "#FFFFFF", "#E8D5E0", "#D4F0E7", "#fde68a", "#fbcfe8"],
    sizes: [10, 22],
    batchSize: 16,
    batchInterval: 480,
    duration: [3500, 6500],
    keyframe: "gifted-petal-fall",
  },
  "rose-petals": {
    colors: ["#FFB7C5", "#FF8FAB", "#E8A7B1", "#FFC0CB", "#FFFFFF", "#fda4af", "#fb7185"],
    sizes: [16, 30],
    batchSize: 12,
    batchInterval: 560,
    duration: [4000, 7500],
    keyframe: "gifted-petal-fall",
  },
  snow: {
    colors: ["#FFFFFF", "#E8F4FD", "#BDE0FE", "#E0EFFF", "#f0f9ff"],
    sizes: [4, 14],
    batchSize: 24,
    batchInterval: 260,
    duration: [2800, 5800],
    keyframe: "gifted-snow-fall",
    shape: "circle",
  },
};

const INTENSITY_SCALE: Record<"low" | "medium" | "high", number> = {
  low: 0.55,
  medium: 1.0,
  high: 1.5,
};

function startAmbientParticles(effect: AmbientEffect, intensity: "low" | "medium" | "high" = "medium"): () => void {
  if (effect === "stars") return () => {};
  const cfg = PARTICLE_CFGS[effect];
  if (!cfg) return () => {};

  const scale = INTENSITY_SCALE[intensity];
  const batchSize = Math.max(1, Math.round(cfg.batchSize * scale));
  const batchInterval = Math.max(150, Math.round(cfg.batchInterval / Math.max(scale, 0.5)));

  injectParticleStyles();
  const container = document.createElement("div");
  container.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:200;overflow:hidden;";
  document.body.appendChild(container);

  let active = true;

  const delay = cfg.startDelay ?? 0;

  function spawnBatch() {
    if (!active) return;
    for (let i = 0; i < batchSize; i++) {
      setTimeout(() => {
        if (!active) return;
        const el = document.createElement("div");
        const size = cfg.sizes[0] + Math.random() * (cfg.sizes[1] - cfg.sizes[0]);
        const dur = cfg.duration[0] + Math.random() * (cfg.duration[1] - cfg.duration[0]);
        const drift = (Math.random() - 0.5) * 220;
        const spin = Math.random() * 720 - 360;
        const color = cfg.colors[Math.floor(Math.random() * cfg.colors.length)];
        el.className = "gifted-particle";
        el.style.cssText = `
          left:${Math.random() * 100}%;
          top:0;
          width:${size}px;
          height:${cfg.shape === "circle" ? size : size * 0.7}px;
          background:${color};
          --drift:${drift}px;
          --spin:${spin}deg;
          animation:${cfg.keyframe} ${dur}ms ease-in forwards;
          ${cfg.shape === "circle" ? "border-radius:50%;" : ""}
          opacity:${0.65 + Math.random() * 0.35};
        `;
        container.appendChild(el);
        setTimeout(() => el.remove(), dur + 200);
      }, Math.random() * batchInterval);
    }
  }

  if (delay > 0) {
    setTimeout(() => { if (active) { spawnBatch(); } }, delay);
  } else {
    spawnBatch();
  }
  const iv = setInterval(spawnBatch, batchInterval + 200);

  return () => {
    active = false;
    clearInterval(iv);
    setTimeout(() => container.remove(), 7000);
  };
}

// ─── Confetti burst ───────────────────────────────────────────────────────────

function fireEntryBurst(experience: string) {
  switch (experience) {
    case "confetti-burst": {
      const end = Date.now() + 3800;
      const colors = ["#FF6B6B", "#FFD93D", "#6BCB77", "#4D96FF", "#FF9500", "#BF5AF2"];
      const frame = () => {
        confetti({ particleCount: 7, angle: 60, spread: 62, origin: { x: 0 }, colors });
        confetti({ particleCount: 7, angle: 120, spread: 62, origin: { x: 1 }, colors });
        if (Date.now() < end) requestAnimationFrame(frame);
      };
      frame();
      break;
    }
    case "golden-hour": {
      const end = Date.now() + 4200;
      const colors = ["#F7C59F", "#E8A87C", "#FFD700", "#FFC200", "#FFECB3"];
      const frame = () => {
        confetti({ particleCount: 4, angle: 90, spread: 85, origin: { x: Math.random(), y: 1 }, colors, gravity: 0.3, scalar: 1.2, drift: 0.5 });
        if (Date.now() < end) requestAnimationFrame(frame);
      };
      frame();
      break;
    }
    case "midnight-stars": {
      const end = Date.now() + 3600;
      const colors = ["#C0C0C0", "#FFFFFF", "#E8E8FF", "#B8B8FF", "#9090CC"];
      const starShape = confetti.shapeFromText({ text: "★", scalar: 2 });
      const frame = () => {
        confetti({ particleCount: 5, angle: 90, spread: 75, origin: { x: Math.random(), y: 1 }, colors, gravity: 0.2, scalar: 1.4, shapes: [starShape], drift: (Math.random() - 0.5) * 0.6 });
        if (Date.now() < end) requestAnimationFrame(frame);
      };
      frame();
      break;
    }
    case "sunrise": {
      const end = Date.now() + 3500;
      const colors = ["#FFCBA4", "#FF9A8B", "#FF6A88", "#FFA07A", "#FFD580"];
      const frame = () => {
        confetti({ particleCount: 5, angle: 65, spread: 52, origin: { x: 0 }, colors, scalar: 0.9 });
        confetti({ particleCount: 5, angle: 115, spread: 52, origin: { x: 1 }, colors, scalar: 0.9 });
        if (Date.now() < end) requestAnimationFrame(frame);
      };
      frame();
      break;
    }
  }
}

// ─── Section wrapper ─────────────────────────────────────────────────────────

function Section({
  cfg,
  idx,
  className = "",
  children,
}: {
  cfg: RevealCfg;
  idx: number;
  className?: string;
  children: React.ReactNode;
}) {
  const v = sectionVariant(cfg.sectionStyle, idx);
  return (
    <motion.div
      className={className}
      initial={v.initial}
      whileInView={v.animate}
      viewport={{ once: true, margin: "-60px" }}
      transition={v.transition}
    >
      {children}
    </motion.div>
  );
}

// ─── Gift-box opening animation ──────────────────────────────────────────────

const BOX_THEMES: Record<string, { box: string; lid: string; ribbon: string; bow: string }> = {
  "confetti-burst": { box: "#FF6B6B", lid: "#E05555", ribbon: "#FFD93D", bow: "#FFD700" },
  "golden-hour":    { box: "#E8A87C", lid: "#c9622a", ribbon: "#F7C59F", bow: "#FFD700" },
  "garden-bloom":   { box: "#B5EAD7", lid: "#7DC9AD", ribbon: "#FFB7C5", bow: "#FF8FAB" },
  "midnight-stars": { box: "#1e1b4b", lid: "#1a1060", ribbon: "#a5b4fc", bow: "#818cf8" },
  "rose-petal":     { box: "#FFB7C5", lid: "#FF8FAB", ribbon: "#FFFFFF", bow: "#f9a8d4" },
  "snow-flurry":    { box: "#bfdbfe", lid: "#93c5fd", ribbon: "#FFFFFF", bow: "#e0f2fe" },
  "sunrise":        { box: "#fed7aa", lid: "#fb923c", ribbon: "#fca5a5", bow: "#f97316" },
};

// phase: 0=idle 1=rising 2=shaking 3=lid-pops 4=flash
function GiftBoxOpening({ phase, experience, isDark }: { phase: number; experience: string; isDark: boolean }) {
  const t = BOX_THEMES[experience] ?? BOX_THEMES["confetti-burst"];
  const W = 210, BH = 130, LH = 54;

  return (
    <div style={{ position: "relative", width: W, height: BH + LH + 28 }} className="select-none">

      {/* Bow — pops off with lid */}
      <motion.div
        style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", display: "flex", alignItems: "center", zIndex: 2 }}
        initial={{ opacity: 0, y: 20 }}
        animate={
          phase >= 3
            ? { y: -200, rotate: -25, opacity: 0, scale: 0.4 }
            : phase >= 1
            ? { opacity: 1, y: 0 }
            : { opacity: 0, y: 20 }
        }
        transition={phase >= 3 ? { duration: 0.55, ease: [0.2, 0, 1, 0.8] } : { duration: 0.4 }}
      >
        <div style={{ width: 36, height: 24, background: t.bow, borderRadius: "50%", transform: "rotate(-42deg)", marginRight: -9, opacity: 0.93, boxShadow: "0 2px 6px rgba(0,0,0,0.18)" }} />
        <div style={{ width: 16, height: 16, background: t.bow, borderRadius: "50%", zIndex: 1, boxShadow: "0 1px 4px rgba(0,0,0,0.22)" }} />
        <div style={{ width: 36, height: 24, background: t.bow, borderRadius: "50%", transform: "rotate(42deg)",  marginLeft: -9,  opacity: 0.93, boxShadow: "0 2px 6px rgba(0,0,0,0.18)" }} />
      </motion.div>

      {/* Lid */}
      <motion.div
        style={{
          position: "absolute", top: 22, left: 0,
          width: W, height: LH,
          background: t.lid,
          borderRadius: "12px 12px 0 0",
          overflow: "hidden",
          zIndex: 1,
        }}
        initial={{ opacity: 0, y: 20 }}
        animate={
          phase >= 3 ? { y: -220, rotate: 32, opacity: 0 }
          : phase === 2 ? { y: [0, -10, 5, -6, 0], opacity: 1 }
          : phase >= 1 ? { opacity: 1, y: 0 }
          : { opacity: 0, y: 20 }
        }
        transition={
          phase >= 3 ? { duration: 0.55, ease: [0.2, 0, 0.85, 0.5] }
          : phase === 2 ? { duration: 0.52, times: [0, 0.22, 0.52, 0.76, 1] }
          : { duration: 0.4 }
        }
      >
        {/* Ribbon stripe */}
        <div style={{ position: "absolute", inset: 0, display: "flex", justifyContent: "center" }}>
          <div style={{ width: 20, height: "100%", background: t.ribbon, opacity: 0.65 }} />
        </div>
      </motion.div>

      {/* Box body */}
      <motion.div
        style={{
          position: "absolute", top: 22 + LH, left: 0,
          width: W, height: BH,
          background: t.box,
          borderRadius: "0 0 18px 18px",
          overflow: "hidden",
        }}
        initial={{ opacity: 0, y: 20 }}
        animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.4 }}
      >
        {/* Ribbon stripe */}
        <div style={{ position: "absolute", inset: 0, display: "flex", justifyContent: "center" }}>
          <div style={{ width: 20, height: "100%", background: t.ribbon, opacity: 0.45 }} />
        </div>

        {/* Inner glow when lid pops */}
        {phase >= 3 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0.65] }}
            transition={{ duration: 0.7 }}
            style={{
              position: "absolute", inset: 0,
              background: isDark
                ? "radial-gradient(ellipse at 50% 0%, rgba(200,180,255,0.98), rgba(140,110,255,0.55) 65%, transparent)"
                : "radial-gradient(ellipse at 50% 0%, rgba(255,253,180,1), rgba(255,220,90,0.7) 65%, transparent)",
            }}
          />
        )}
      </motion.div>

      {/* Sparkles fly out when lid pops */}
      {phase >= 3 && (
        <div style={{ position: "absolute", top: 22 + LH, left: "50%", pointerEvents: "none" }}>
          {[
            { x: -80, y: -100, delay: 0.00, size: 10 },
            { x: -45, y: -125, delay: 0.06, size: 8  },
            { x:   0, y: -140, delay: 0.03, size: 12 },
            { x:  45, y: -120, delay: 0.08, size: 8  },
            { x:  80, y: -95,  delay: 0.02, size: 10 },
          ].map((p, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: 0, y: 0, scale: 0 }}
              animate={{ opacity: [0, 1, 0], x: p.x, y: p.y, scale: [0, 1.5, 0] }}
              transition={{ duration: 0.8, delay: p.delay, ease: "easeOut" }}
              style={{
                position: "absolute",
                width: p.size, height: p.size,
                borderRadius: "50%",
                background: t.bow,
                marginLeft: -p.size / 2,
                marginTop: -p.size / 2,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Experience sound synthesis ───────────────────────────────────────────────

function playExperienceSound(exp: string) {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();

    const hz: Record<string, number> = {
      C4: 261.63, E4: 329.63, G4: 392.00, B4: 493.88,
      C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880.00,
      C6: 1046.50, E6: 1318.51, G6: 1567.98,
    };

    interface NoteEvent { f: number; t: number; d: number; g: number }

    const map: Record<string, NoteEvent[]> = {
      "confetti-burst":  [
        { f: hz.C5, t: 0,    d: 0.12, g: 0.38 },
        { f: hz.E5, t: 0.08, d: 0.12, g: 0.38 },
        { f: hz.G5, t: 0.16, d: 0.12, g: 0.38 },
        { f: hz.C6, t: 0.24, d: 0.5,  g: 0.48 },
      ],
      "golden-hour":     [
        { f: hz.G4, t: 0,   d: 2.2, g: 0.18 },
        { f: hz.B4, t: 0.1, d: 2.2, g: 0.15 },
        { f: hz.E5, t: 0.2, d: 2.2, g: 0.13 },
      ],
      "garden-bloom":    [
        { f: hz.C5, t: 0,    d: 0.55, g: 0.22 },
        { f: hz.E5, t: 0.18, d: 0.55, g: 0.22 },
        { f: hz.G5, t: 0.36, d: 0.55, g: 0.22 },
        { f: hz.A5, t: 0.54, d: 0.7,  g: 0.28 },
      ],
      "midnight-stars":  [
        { f: hz.E6, t: 0,    d: 1.0, g: 0.14 },
        { f: hz.G6, t: 0.3,  d: 1.0, g: 0.11 },
        { f: hz.C6, t: 0.6,  d: 1.2, g: 0.16 },
      ],
      "rose-petal":      [
        { f: hz.G4, t: 0,    d: 1.4, g: 0.20 },
        { f: hz.C5, t: 0.18, d: 1.4, g: 0.17 },
        { f: hz.E5, t: 0.36, d: 1.8, g: 0.19 },
      ],
      "snow-flurry":     [
        { f: hz.E6, t: 0,    d: 0.35, g: 0.18 },
        { f: hz.G6, t: 0.14, d: 0.30, g: 0.13 },
        { f: hz.E6, t: 0.30, d: 0.35, g: 0.16 },
        { f: hz.C6, t: 0.48, d: 0.65, g: 0.20 },
      ],
      "sunrise":         [
        { f: hz.C4, t: 0,    d: 1.8, g: 0.18 },
        { f: hz.E4, t: 0.22, d: 1.8, g: 0.16 },
        { f: hz.G4, t: 0.44, d: 1.8, g: 0.16 },
        { f: hz.B4, t: 0.66, d: 2.0, g: 0.20 },
      ],
    };

    const events = map[exp] ?? map["confetti-burst"];
    const now = ctx.currentTime;

    for (const ev of events) {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(ev.f, now + ev.t);
      gain.gain.setValueAtTime(0, now + ev.t);
      gain.gain.linearRampToValueAtTime(ev.g, now + ev.t + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + ev.t + ev.d);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + ev.t);
      osc.stop(now + ev.t + ev.d + 0.05);
    }
  } catch { /* silently ignore — audio is enhancement only */ }
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function RevealPage() {
  const [isOpen, setIsOpen]               = useState(false);
  const [videoUrl, setVideoUrl]           = useState<string | null>(null);
  const [videoError, setVideoError]       = useState(false);
  const videoRef                          = useRef<HTMLVideoElement>(null);
  const [photoUrls, setPhotoUrls]         = useState<string[]>([]);
  const [personalNote, setPersonalNote]   = useState<string | null>(null);
  const [extraLinks, setExtraLinks]       = useState<string[]>([]);
  const [recipientName, setRecipientName] = useState(mockGiftData.recipientName);
  const [senderName, setSenderName]       = useState(mockGiftData.senderName);
  const [giftTitle, setGiftTitle]         = useState(mockGiftData.title);
  const [experience, setExperience]       = useState(DEFAULT_EXPERIENCE);
  const [giftAmount, setGiftAmount]       = useState<string | null>(null);
  const [giftIntent, setGiftIntent]       = useState<string | null>(null);
  const [giftPaid, setGiftPaid]           = useState<boolean>(true);
  const [isPreview, setIsPreview]         = useState(false);
  const [isOpening, setIsOpening]         = useState(false);
  const [openPhase, setOpenPhase]         = useState(0);
  const [lightboxUrl, setLightboxUrl]     = useState<string | null>(null);
  const [giftId, setGiftId]               = useState<string | null>(null);
  const [reactionEmoji, setReactionEmoji] = useState<string | null>(null);
  const [reactionSent, setReactionSent]   = useState(false);
  const [reactionSkipped, setReactionSkipped] = useState(false);

  const amountRef  = useRef<HTMLDivElement>(null);
  const amountInView = useInView(amountRef, { once: true });

  const cfg = CONFIGS[experience] ?? CONFIGS[DEFAULT_EXPERIENCE];

  const countedAmount = useCountUp(
    Number(giftAmount || 0),
    1600,
    300,
    cfg.amountStyle === "count-up" && (amountInView || isPreview),
  );

  useEffect(() => {
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");

    const urlParams = new URLSearchParams(window.location.search);
    const isPreviewMode = urlParams.get("preview") === "true";
    const giftIdParam = urlParams.get("giftId");

    if (isPreviewMode) {
      setIsPreview(true);
      setGiftPaid(true);
    } else {
      const paid = localStorage.getItem("gifted_gift_paid");
      if (paid === "false") setGiftPaid(false);
    }

    if (giftIdParam) {
      setGiftId(giftIdParam);
      fetch(`${base}/api/gifted/gifts/${encodeURIComponent(giftIdParam)}`, { credentials: "include" })
        .then(r => r.ok ? r.json() : null)
        .then(async (gift) => {
          if (!gift) return;

          if (gift.recipientName) setRecipientName(gift.recipientName);
          if (gift.senderName) setSenderName(gift.senderName);
          if (gift.experience && CONFIGS[gift.experience]) setExperience(gift.experience);
          if (gift.giftTitle) setGiftTitle(gift.giftTitle);
          if (gift.personalNote) setPersonalNote(gift.personalNote);
          if (gift.amount && parseFloat(gift.amount) > 0) setGiftAmount(gift.amount);
          if (gift.intent) setGiftIntent(gift.intent);

          const links: string[] = [];
          if (Array.isArray(gift.extraLinks) && gift.extraLinks.length > 0) {
            links.push(...gift.extraLinks.filter(Boolean));
          } else if (gift.playlistUrl) {
            links.push(gift.playlistUrl);
          }
          if (links.length > 0) setExtraLinks(links);

          if (gift.videoPath) {
            fetch(`${base}/api/storage/object-url?path=${encodeURIComponent(gift.videoPath)}`)
              .then(r => r.ok ? r.json() : null)
              .then(d => setVideoUrl(d?.url ?? `${base}/api/storage${gift.videoPath}`))
              .catch(() => setVideoUrl(`${base}/api/storage${gift.videoPath}`));
          }

          if (Array.isArray(gift.photoPaths) && gift.photoPaths.length > 0) {
            Promise.all(
              gift.photoPaths.map((p: string) =>
                fetch(`${base}/api/storage/object-url?path=${encodeURIComponent(p)}`)
                  .then(r => r.ok ? r.json() : null)
                  .then(d => d?.url ?? `${base}/api/storage${p}`)
                  .catch(() => `${base}/api/storage${p}`)
              )
            ).then(urls => setPhotoUrls(urls));
          }
        })
        .catch(() => { /* ignore fetch error — gift fields remain at defaults */ });
      return;
    }

    // URL params (set by preview flow without giftId) take priority over localStorage
    const urlExperience    = urlParams.get("experience");
    const urlAmount        = urlParams.get("amount");
    const urlIntent        = urlParams.get("intent");
    const urlRecipient     = urlParams.get("recipientName");
    const urlSender        = urlParams.get("senderName");
    const urlTitle         = urlParams.get("giftTitle");
    const urlPersonalNote  = urlParams.get("personalNote");

    const vp = localStorage.getItem("gifted_video_path");
    if (vp) {
      fetch(`${base}/api/storage/object-url?path=${encodeURIComponent(vp)}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => setVideoUrl(d?.url ?? `${base}/api/storage${vp}`))
        .catch(() => setVideoUrl(`${base}/api/storage${vp}`));
    }

    const pp = localStorage.getItem("gifted_photo_paths");
    if (pp) {
      try {
        const paths: string[] = JSON.parse(pp);
        Promise.all(
          paths.map(p =>
            fetch(`${base}/api/storage/object-url?path=${encodeURIComponent(p)}`)
              .then(r => r.ok ? r.json() : null)
              .then(d => d?.url ?? `${base}/api/storage${p}`)
              .catch(() => `${base}/api/storage${p}`)
          )
        ).then(urls => setPhotoUrls(urls));
      } catch { /* ignore */ }
    }

    const pn = urlPersonalNote || localStorage.getItem("gifted_personal_note");
    if (pn) setPersonalNote(pn);

    const urlLinks = urlParams.getAll("link").filter(Boolean);
    if (urlLinks.length > 0) {
      setExtraLinks(urlLinks);
    } else {
      const elRaw = localStorage.getItem("gifted_extra_links");
      if (elRaw) { try { const parsed = JSON.parse(elRaw); if (Array.isArray(parsed)) setExtraLinks(parsed.filter(Boolean)); } catch { /* ignore */ } }
      else { const pl = localStorage.getItem("gifted_playlist_url"); if (pl) setExtraLinks([pl]); }
    }

    const rn = urlRecipient || localStorage.getItem("gifted_recipient_name");
    if (rn) setRecipientName(rn);

    const sn = urlSender || localStorage.getItem("gifted_sender_name");
    if (sn) setSenderName(sn);

    const gt = urlTitle || localStorage.getItem("gifted_gift_title");
    if (gt) setGiftTitle(gt);

    const stored = urlExperience || localStorage.getItem("gifted_experience");
    if (stored && CONFIGS[stored]) setExperience(stored);

    const amt = urlAmount || localStorage.getItem("gifted_amount");
    if (amt && parseFloat(amt) > 0) setGiftAmount(amt);

    const intn = urlIntent || localStorage.getItem("gifted_intent");
    if (intn) setGiftIntent(intn);
  }, []);

  useEffect(() => {
    document.body.style.overflow = isOpen ? "auto" : "hidden";
    return () => { document.body.style.overflow = "auto"; };
  }, [isOpen]);

  // Cleanup ref for ambient particles
  const ambientCleanup = useRef<(() => void) | null>(null);
  const confettiTrickleActive = useRef(false);

  const handleOpen = () => {
    setIsOpen(true);
    fireEntryBurst(experience);
    if (cfg.ambientEffect && cfg.ambientEffect !== "stars") {
      ambientCleanup.current = startAmbientParticles(cfg.ambientEffect, cfg.ambientIntensity);
    }
    // Confetti Burst: after entry burst settles, keep a gentle rain going
    if (experience === "confetti-burst") {
      confettiTrickleActive.current = false;
      setTimeout(() => {
        confettiTrickleActive.current = true;
        const colors = ["#FF6B6B", "#FFD93D", "#6BCB77", "#4D96FF", "#FF9500", "#BF5AF2"];
        const tick = () => {
          if (!confettiTrickleActive.current) return;
          confetti({
            particleCount: 2,
            angle: 45 + Math.random() * 90,
            spread: 55,
            origin: { x: Math.random(), y: -0.08 },
            colors,
            gravity: 0.52,
            scalar: 0.82,
            drift: (Math.random() - 0.5) * 0.5,
          });
          setTimeout(tick, 160 + Math.random() * 300);
        };
        tick();
      }, 4400);
    }
  };

  const handleOpenClick = () => {
    if (isOpening) return;
    playExperienceSound(experience);
    setIsOpening(true);
    setOpenPhase(1);
    setTimeout(() => setOpenPhase(2), 520);
    setTimeout(() => setOpenPhase(3), 1000);
    setTimeout(() => setOpenPhase(4), 1580);
    setTimeout(() => handleOpen(),    2100);
  };

  useEffect(() => {
    return () => {
      ambientCleanup.current?.();
      confettiTrickleActive.current = false;
    };
  }, []);

  useEffect(() => {
    const sid = "gifted-epic-anim-styles";
    if (!document.getElementById(sid)) {
      const s = document.createElement("style");
      s.id = sid;
      s.textContent = `
        @keyframes gifted-ring-out {
          0%   { transform: scale(1);   opacity: 0.55; }
          100% { transform: scale(2.7); opacity: 0;    }
        }
        @keyframes gifted-shimmer-sweep {
          0%   { transform: translateX(-150%); }
          40%  { transform: translateX(250%);  }
          100% { transform: translateX(250%);  }
        }
        @keyframes gifted-pre-breathe {
          0%, 100% { opacity: 0.4; transform: scale(1);    }
          50%       { opacity: 0.7; transform: scale(1.04); }
        }
      `;
      document.head.appendChild(s);
    }
  }, []);

  const gStyle = gradientStyle(experience);
  const PreIcon = PRE_ICONS[experience] ?? Gift;
  const iconProps = preIconMotionProps(cfg.preIconAnim);
  const isDark = cfg.isDark;


  // ── Page-level style override for dark themes
  const pageStyle: React.CSSProperties = isDark
    ? { backgroundColor: "#0c0a1e", color: "white" }
    : {};

  return (
    <div className="w-full min-h-screen relative" style={pageStyle}>

      {/* Midnight Stars starfield */}
      {isOpen && isDark && <StarfieldBg />}

      {/* Golden Hour bokeh */}
      {isOpen && experience === "golden-hour" && <GoldenHourBokeh />}

      {/* Sunrise light rays */}
      {isOpen && experience === "sunrise" && <SunriseLightRay />}

      {/* ── Pre-reveal overlay ── */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            exit={cfg.envelopeExit}
            transition={cfg.envelopeTransition}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6"
            style={isDark
              ? { background: "linear-gradient(135deg, #0f0c29, #302b63, #24243e)" }
              : { backgroundColor: "hsl(var(--background))" }
            }
          >
            {/* Background gradient glow — breathing */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div
                className="w-full h-full blur-3xl"
                style={{ ...gStyle, animation: "gifted-pre-breathe 4s ease-in-out infinite" }}
              />
            </div>

            {/* Preview mode banner — pre-reveal screen */}
            {isPreview && (
              <div className="absolute top-5 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
                <div className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold shadow-lg backdrop-blur-md" style={{ background: "rgba(0,0,0,0.55)", color: "rgba(255,255,255,0.9)", border: "1px solid rgba(255,255,255,0.18)" }}>
                  <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                  Preview mode — only you can see this
                </div>
              </div>
            )}

            {/* Screen flash when box opens */}
            <AnimatePresence>
              {openPhase >= 4 && (
                <motion.div
                  key="flash"
                  className="absolute inset-0 pointer-events-none z-20"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 1, 0] }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.55, times: [0, 0.28, 1] }}
                  style={{
                    background: isDark
                      ? "radial-gradient(ellipse at center, rgba(180,160,255,0.95), rgba(100,80,220,0.6))"
                      : "radial-gradient(ellipse at center, rgba(255,255,220,1), rgba(255,220,120,0.7))",
                  }}
                />
              )}
            </AnimatePresence>

            {/* Content switches: normal pre-reveal ↔ gift box opening */}
            <AnimatePresence mode="wait">
              {!isOpening ? (
                <motion.div
                  key="idle"
                  exit={{ opacity: 0, scale: 0.88, y: -10 }}
                  transition={{ duration: 0.22 }}
                  initial={{ scale: 0.88, opacity: 0, y: 16 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  className="relative z-10 flex flex-col items-center text-center"
                >
              
              {/* Animated icon with aura rings */}
              <div className="relative mb-8 flex items-center justify-center" style={{ width: 96, height: 96 }}>
                {/* Pulsing aura rings */}
                {!isOpening && [0, 1, 2].map((i) => (
                  <div
                    key={i}
                    style={{
                      position: "absolute",
                      inset: 0,
                      borderRadius: "50%",
                      border: `1.5px solid ${isDark ? "rgba(255,255,255,0.28)" : "hsl(var(--primary)/0.38)"}`,
                      animation: `gifted-ring-out 2.4s ${i * 0.8}s ease-out infinite`,
                      pointerEvents: "none",
                    }}
                  />
                ))}
                <motion.div
                  animate={isOpening ? { scale: [1, 1.5, 0.2], opacity: [1, 1, 0] } : {}}
                  transition={{ duration: 0.34, ease: [0.4, 0, 0.6, 1] }}
                >
                  <div
                    className="w-24 h-24 rounded-full flex items-center justify-center"
                    style={{
                      background: isDark
                        ? "rgba(255,255,255,0.08)"
                        : "rgba(var(--primary), 0.1)",
                      backdropFilter: "blur(12px)",
                    }}
                  >
                    <motion.div {...iconProps}>
                      <PreIcon className={`w-10 h-10 ${cfg.preIconColorClass}`} />
                    </motion.div>
                  </div>
                </motion.div>
              </div>

              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55, duration: 0.5 }}
                className={`text-base font-medium mb-2 ${isDark ? "text-white/60" : "text-muted-foreground"}`}
              >
                A gift for
              </motion.p>

              {/* Recipient name — character stagger */}
              <h1
                aria-label={recipientName}
                className={`font-serif text-5xl sm:text-6xl md:text-7xl mb-10 break-words max-w-xs sm:max-w-sm ${isDark ? "text-white" : ""}`}
                style={{ display: "flex", flexWrap: "wrap", justifyContent: "center" }}
              >
                {recipientName.split("").map((char, i) => (
                  <motion.span
                    key={i}
                    initial={{ opacity: 0, y: 22, filter: "blur(6px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    transition={{ delay: 0.6 + i * 0.042, type: "spring", stiffness: 380, damping: 30 }}
                    style={{ display: "inline-block" }}
                  >
                    {char === " " ? "\u00A0" : char}
                  </motion.span>
                ))}
              </h1>

              {/* CTA button with shimmer */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 + recipientName.length * 0.042, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="relative w-full max-w-xs"
              >
                <Button
                  onClick={handleOpenClick}
                  disabled={isOpening}
                  size="lg"
                  className="relative overflow-hidden rounded-full h-16 px-10 sm:px-14 text-xl w-full shadow-2xl shadow-primary/30 transition-all duration-200 active:scale-95"
                  style={isDark ? { background: "rgba(255,255,255,0.12)", color: "white", border: "1px solid rgba(255,255,255,0.2)" } : {}}
                >
                  <motion.span
                    animate={isOpening ? { scale: 0.94, opacity: 0.7 } : { scale: 1, opacity: 1 }}
                    transition={{ duration: 0.12 }}
                    className="relative z-10"
                  >
                    {experience === "midnight-stars" ? "Reveal" : experience === "snow-flurry" ? "Open" : "Tap to open"}
                  </motion.span>
                  {/* Shimmer sweep — loops every 3.5s */}
                  {!isOpening && (
                    <span
                      aria-hidden
                      style={{
                        position: "absolute",
                        inset: 0,
                        background: "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.26) 50%, transparent 70%)",
                        animation: "gifted-shimmer-sweep 3.5s 1.2s ease-in-out infinite",
                        pointerEvents: "none",
                        borderRadius: "inherit",
                      }}
                    />
                  )}
                </Button>
              </motion.div>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.1, duration: 0.8 }}
                className={`mt-5 text-xs tracking-widest uppercase ${isDark ? "text-white/30" : "text-muted-foreground/50"}`}
              >
                scroll to explore
              </motion.p>
                </motion.div>
              ) : (
                /* ── Gift box opening sequence ── */
                <motion.div
                  key="opening"
                  className="relative z-10 flex flex-col items-center justify-center gap-0"
                  initial={{ opacity: 0, scale: 0.72, y: 40 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
                >
                  <GiftBoxOpening phase={openPhase} experience={experience} isDark={isDark} />
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: openPhase < 4 ? 1 : 0 }}
                    transition={{ delay: 0.3, duration: 0.4 }}
                    className={`mt-7 text-sm font-medium tracking-wide ${isDark ? "text-white/55" : "text-muted-foreground"}`}
                  >
                    {openPhase >= 3 ? "✨ Opening…" : openPhase >= 2 ? "Almost there…" : "Opening your gift…"}
                  </motion.p>
                </motion.div>
              )}
            </AnimatePresence>

          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Revealed content ── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="w-full pb-20 md:pb-32 relative z-10"
          >

            {/* Preview mode banner */}
            {isPreview && (
              <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
                <div className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold shadow-lg backdrop-blur-md" style={{ background: "rgba(0,0,0,0.55)", color: "rgba(255,255,255,0.9)", border: "1px solid rgba(255,255,255,0.18)" }}>
                  <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                  Preview mode — only you can see this
                </div>
              </div>
            )}

            {/* Hero */}
            <div className="w-full h-[60vh] md:h-[70vh] relative flex items-end">
              <div className="absolute inset-0">
                <div className="w-full h-full" style={gStyle} />
                <div
                  className="absolute inset-0 bg-gradient-to-t"
                  style={{
                    backgroundImage: isDark
                      ? "linear-gradient(to top, #0c0a1e 0%, rgba(12,10,30,0.7) 40%, transparent 100%)"
                      : "linear-gradient(to top, hsl(var(--background)) 0%, hsl(var(--background)/0.65) 40%, transparent 100%)",
                  }}
                />
              </div>

              <div className="relative z-10 w-full max-w-4xl mx-auto px-4 sm:px-6 pb-10 md:pb-12">
                <motion.div
                  initial={{ y: 36, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: cfg.heroDelay, duration: cfg.heroDuration, ease: [0.16, 1, 0.3, 1] }}
                >
                  {/* Title — style varies per experience */}
                  <h1
                    className={`font-serif text-4xl sm:text-5xl md:text-7xl font-medium mb-4 ${isDark ? "text-white" : "text-foreground"}`}
                  >
                    {cfg.titleStyle === "word-burst" && (
                      <WordBurstTitle text={giftTitle} delayS={cfg.heroDelay} />
                    )}
                    {cfg.titleStyle === "typewriter" && (
                      <TypewriterText text={giftTitle} delayS={cfg.heroDelay + 0.2} speed={65} />
                    )}
                    {cfg.titleStyle === "blur-in" && (
                      <motion.span
                        initial={{ filter: "blur(22px)", opacity: 0 }}
                        animate={{ filter: "blur(0px)", opacity: 1 }}
                        transition={{ delay: cfg.heroDelay + 0.1, duration: cfg.heroDuration + 0.1 }}
                        style={{ display: "inline-block" }}
                      >
                        {giftTitle}
                      </motion.span>
                    )}
                    {(cfg.titleStyle === "bloom" || cfg.titleStyle === "elegant-fade" || cfg.titleStyle === "crisp-fall" || cfg.titleStyle === "rise") && (
                      <motion.span
                        initial={
                          cfg.titleStyle === "bloom" ? { scale: 0.84, opacity: 0 } :
                          cfg.titleStyle === "crisp-fall" ? { y: -24, opacity: 0 } :
                          cfg.titleStyle === "rise" ? { y: 50, opacity: 0 } :
                          { y: 18, opacity: 0 }
                        }
                        animate={
                          cfg.titleStyle === "bloom" ? { scale: 1, opacity: 1 } :
                          cfg.titleStyle === "crisp-fall" ? { y: 0, opacity: 1 } :
                          cfg.titleStyle === "rise" ? { y: 0, opacity: 1 } :
                          { y: 0, opacity: 1 }
                        }
                        transition={
                          cfg.titleStyle === "bloom"
                            ? { delay: cfg.heroDelay + 0.05, type: "spring", stiffness: 200, damping: 22 }
                            : cfg.titleStyle === "crisp-fall"
                              ? { delay: cfg.heroDelay, type: "spring", stiffness: 360, damping: 32 }
                              : { delay: cfg.heroDelay + 0.05, duration: cfg.heroDuration, ease: [0.16, 1, 0.3, 1] }
                        }
                        style={{ display: "inline-block" }}
                      >
                        {giftTitle}
                      </motion.span>
                    )}
                  </h1>

                  <p className={`text-xl ${isDark ? "text-white/60" : "text-muted-foreground"}`}>
                    {cfg.senderText} {senderName}
                  </p>
                </motion.div>
              </div>
            </div>

            {/* Content sections */}
            <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-8 md:space-y-14 -mt-4 md:-mt-6 relative z-20">

              {/* Note / message — section 0 (hidden when no note) */}
              {personalNote?.trim() && (
                <Section cfg={cfg} idx={0}>
                  <div
                    className="rounded-[2rem] p-6 md:p-12 border relative overflow-hidden"
                    style={isDark
                      ? {
                          background: cfg.cardStyle.bg ?? "rgba(255,255,255,0.06)",
                          borderColor: cfg.cardStyle.border,
                          boxShadow: cfg.cardStyle.shadow,
                        }
                      : {
                          background: cfg.cardStyle.bg ?? "hsl(var(--card)/0.85)",
                          backdropFilter: experience === "snow-flurry" ? "blur(24px) saturate(1.3)" : "blur(20px)",
                          borderColor: cfg.cardStyle.border,
                          boxShadow: cfg.cardStyle.shadow,
                        }
                    }
                  >
                    {/* Garden Bloom: botanical watermark + accent */}
                    {experience === "garden-bloom" && (
                      <>
                        <GardenBloomWatermark />
                        <div style={{ borderTop: "1.5px solid rgba(181,234,215,0.55)", marginBottom: "1.5rem", width: "100%" }} />
                      </>
                    )}

                    {/* Rose Petal: stationery double-rule decoration */}
                    {experience === "rose-petal" && (
                      <div className="flex items-center gap-3 mb-6">
                        <div style={{ flex: 1, height: 1, background: "rgba(255,143,171,0.4)" }} />
                        <span style={{ color: "rgba(255,143,171,0.7)", fontSize: 14 }}>♥</span>
                        <div style={{ flex: 1, height: 1, background: "rgba(255,143,171,0.4)" }} />
                      </div>
                    )}

                    {cfg.titleStyle === "typewriter" ? (
                      <p className={`font-serif text-lg sm:text-xl md:text-3xl leading-relaxed text-center ${isDark ? "text-white/90" : "text-foreground"}`}>
                        &ldquo;<TypewriterText text={personalNote} delayS={cfg.sectionInitialDelay + 0.3} speed={28} />&rdquo;
                      </p>
                    ) : (
                      <p className={`font-serif text-lg sm:text-xl md:text-3xl leading-relaxed text-center ${isDark ? "text-white/90" : "text-foreground"}`}>
                        &ldquo;{personalNote}&rdquo;
                      </p>
                    )}

                    {/* Garden Bloom: bottom accent line */}
                    {experience === "garden-bloom" && (
                      <div style={{ borderBottom: "1.5px solid rgba(181,234,215,0.55)", marginTop: "1.5rem", width: "100%" }} />
                    )}

                    {/* Rose Petal: bottom stationery line */}
                    {experience === "rose-petal" && (
                      <div className="flex items-center gap-3 mt-6">
                        <div style={{ flex: 1, height: 1, background: "rgba(255,143,171,0.4)" }} />
                        <span style={{ color: "rgba(255,143,171,0.7)", fontSize: 14 }}>♥</span>
                        <div style={{ flex: 1, height: 1, background: "rgba(255,143,171,0.4)" }} />
                      </div>
                    )}
                  </div>
                </Section>
              )}

              {/* Video — section 1 (hidden when no video) */}
              {videoUrl && (
                <Section cfg={cfg} idx={1}>
                  <div
                    className="w-full rounded-[2rem] overflow-hidden border"
                    style={{
                      borderColor: cfg.cardStyle.border,
                      boxShadow: cfg.cardStyle.shadow,
                    }}
                  >
                    <div className="w-full aspect-video relative group">
                      <video
                        ref={videoRef}
                        src={videoUrl ?? undefined}
                        playsInline
                        controls
                        preload="auto"
                        className="w-full h-full object-cover"
                        onError={() => setVideoError(true)}
                      />
                      {videoError && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/20 backdrop-blur-sm rounded-inherit">
                          <p className={`text-sm font-medium ${isDark ? "text-white/80" : "text-white"}`}>
                            Video couldn't play in this browser
                          </p>
                          {videoUrl && (
                            <a
                              href={videoUrl}
                              download
                              target="_blank"
                              rel="noreferrer"
                              className="px-4 py-2 rounded-full text-xs font-semibold bg-white/90 text-gray-900 hover:bg-white transition-colors shadow"
                            >
                              Download video instead
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </Section>
              )}

              {/* Photos — section 2 (hidden when no photos) */}
              {photoUrls.length > 0 && (
                <Section cfg={cfg} idx={2}>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {photoUrls.map((url, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, scale: 0.94 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        transition={{
                          delay: i * 0.08,
                          type: cfg.sectionStyle === "spring-pop" || cfg.sectionStyle === "bloom-scale" || cfg.sectionStyle === "fall-in" ? "spring" : undefined,
                          stiffness: 260,
                          damping: 24,
                          duration: cfg.sectionStyle === "fade-drift" || cfg.sectionStyle === "rise-stagger" ? 0.7 : undefined,
                        }}
                        className={`rounded-3xl overflow-hidden aspect-square relative group cursor-pointer ${i === 0 ? "md:col-span-2 md:aspect-[2/1]" : ""}`}
                        style={isDark
                          ? { background: "rgba(255,255,255,0.06)", boxShadow: cfg.cardStyle.shadow }
                          : { background: "hsl(var(--secondary))", boxShadow: cfg.cardStyle.shadow }
                        }
                        onClick={() => setLightboxUrl(url)}
                      >
                        <img src={url} alt="Memory" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/20">
                          <div className="w-10 h-10 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center shadow-lg">
                            <ZoomIn className="w-5 h-5 text-gray-800" />
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </Section>
              )}

              {/* Link cards — one per extra link */}
              {extraLinks.length > 0 && extraLinks.map((href, linkIdx) => {
                if (!href) return null;
                const u = href.toLowerCase();
                const isMusic = u.includes("spotify.com") || u.includes("music.apple.com") || u.includes("soundcloud.com") || u.includes("tidal.com") || u.includes("deezer.com");
                const isTickets = u.includes("ticketmaster.com") || u.includes("axs.com") || u.includes("stubhub.com") || u.includes("seatgeek.com") || u.includes("livenation.com");
                const isFood = u.includes("opentable.com") || u.includes("resy.com") || u.includes("yelp.com/biz") || u.includes("tock.com");
                const isTravel = u.includes("airbnb.com") || u.includes("vrbo.com") || u.includes("hotels.com") || u.includes("booking.com");
                const label =
                  u.includes("spotify.com") ? "Spotify" :
                  u.includes("music.apple.com") ? "Apple Music" :
                  u.includes("soundcloud.com") ? "SoundCloud" :
                  u.includes("tidal.com") ? "Tidal" :
                  u.includes("youtube.com") || u.includes("youtu.be") ? "YouTube" :
                  isTickets ? "Event Tickets" :
                  u.includes("opentable.com") ? "OpenTable Reservation" :
                  u.includes("resy.com") ? "Resy Reservation" :
                  isFood ? "Reservation" :
                  u.includes("airbnb.com") ? "Airbnb Stay" :
                  isTravel ? "Travel Link" :
                  u.includes("eventbrite.com") ? "Event" :
                  u.includes("amazon.com") ? "Amazon" :
                  u.includes("netflix.com") ? "Netflix" :
                  "Open link";
                const subtitle =
                  isMusic ? "Tap to listen" :
                  u.includes("youtube.com") || u.includes("youtu.be") ? "Tap to watch" :
                  isTickets ? "Tap to view tickets" :
                  isFood ? "Tap to view reservation" :
                  isTravel ? "Tap to view" :
                  "Tap to open";
                return (
                  <Section key={linkIdx} cfg={cfg} idx={2 + linkIdx}>
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block rounded-[2rem] p-5 border transition-all hover:scale-[1.01] active:scale-[0.99] relative overflow-hidden"
                      style={isDark
                        ? { background: cfg.cardStyle.bg ?? "rgba(255,255,255,0.06)", borderColor: cfg.cardStyle.border, boxShadow: cfg.cardStyle.shadow }
                        : { background: cfg.cardStyle.bg ?? "hsl(var(--card)/0.8)", backdropFilter: experience === "snow-flurry" ? "blur(24px) saturate(1.3)" : "blur(20px)", borderColor: cfg.cardStyle.border, boxShadow: cfg.cardStyle.shadow }
                      }
                    >
                      {experience === "garden-bloom" && <GardenBloomWatermark />}
                      <div className="flex items-center gap-4">
                        <div
                          className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
                          style={isDark ? { background: "rgba(255,255,255,0.1)" } : { background: "hsl(var(--primary)/0.1)" }}
                        >
                          {isMusic
                            ? <Music className={`w-6 h-6 ${isDark ? "text-white/80" : "text-primary"}`} />
                            : <ExternalLink className={`w-6 h-6 ${isDark ? "text-white/80" : "text-primary"}`} />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`font-semibold text-base ${isDark ? "text-white" : "text-foreground"}`}>{label}</p>
                          <p className={`text-sm truncate ${isDark ? "text-white/50" : "text-muted-foreground"}`}>{subtitle}</p>
                        </div>
                        <ExternalLink className={`w-5 h-5 flex-shrink-0 ${isDark ? "text-white/40" : "text-muted-foreground"}`} />
                      </div>
                    </a>
                  </Section>
                );
              })}

              {/* Balance — always animates after the last link card */}
              {giftAmount && parseFloat(giftAmount) > 0 && (
                <div ref={amountRef}>
                  <Section cfg={cfg} idx={2 + extraLinks.length}>
                    {/* Midnight Stars gets a distinct dark card */}
                    {cfg.amountStyle === "stellar-reveal" ? (
                      <div
                        className="w-full rounded-[2.5rem] p-10 md:p-16 text-center relative overflow-hidden"
                        style={{
                          background: "linear-gradient(135deg, rgba(48,43,99,0.9), rgba(36,36,62,0.95))",
                          border: "1px solid rgba(255,255,255,0.15)",
                          boxShadow: "0 0 60px rgba(150,140,255,0.18), 0 25px 50px rgba(0,0,0,0.5)",
                        }}
                      >
                        <div className="absolute -top-20 -right-20 w-56 h-56 rounded-full blur-3xl" style={{ background: "rgba(130,120,255,0.15)" }} />
                        <div className="absolute -bottom-20 -left-20 w-56 h-56 rounded-full blur-3xl" style={{ background: "rgba(100,80,200,0.12)" }} />
                        <div className="relative z-10 flex flex-col items-center">
                          {giftIntent && (
                            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6 text-sm font-medium" style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.85)" }}>
                              <Sparkles className="w-4 h-4" />
                              <span>{giftIntent}</span>
                            </div>
                          )}
                          <h3 className="text-xl md:text-2xl font-medium mb-2 text-white/80">You received</h3>
                          <motion.div
                            initial={{ opacity: 0, filter: "blur(16px)", scale: 0.9 }}
                            whileInView={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
                            viewport={{ once: true }}
                            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                            className="font-serif text-6xl md:text-9xl mb-8 tracking-tighter text-white"
                            style={{ textShadow: "0 0 40px rgba(180,160,255,0.5)" }}
                          >
                            ${formatAmt(giftAmount)}
                          </motion.div>
                          <p className="text-lg mb-10 max-w-md mx-auto text-white/60">
                            Sent with intention. Yours to use however you need.
                          </p>
                          {giftPaid ? (
                            isPreview ? (
                              <Button size="lg" disabled className="rounded-full h-16 px-10 text-xl w-full sm:w-auto opacity-50 cursor-default" style={{ background: "rgba(255,255,255,0.12)", color: "white", border: "1px solid rgba(255,255,255,0.25)" }}>
                                Redeem your balance
                              </Button>
                            ) : (
                              <Link href="/redeem">
                                <Button size="lg" className="rounded-full h-16 px-10 text-xl shadow-xl hover:-translate-y-1 transition-all w-full sm:w-auto" style={{ background: "rgba(255,255,255,0.12)", color: "white", border: "1px solid rgba(255,255,255,0.25)" }}>
                                  Redeem your balance
                                </Button>
                              </Link>
                            )
                          ) : (
                            <p className="text-sm text-white/40 italic">Payment pending — check back soon.</p>
                          )}
                        </div>
                      </div>
                    ) : (
                      /* Standard card for all other experiences */
                      <div
                        className="w-full rounded-[2.5rem] p-10 md:p-16 text-center relative overflow-hidden"
                        style={
                          cfg.amountStyle === "glow-reveal"
                            ? {
                                background: "linear-gradient(135deg, hsl(28,62%,36%), hsl(28,68%,44%))",
                                boxShadow: "0 0 80px rgba(180,110,40,0.35), 0 25px 50px rgba(180,110,40,0.2)",
                                color: "white",
                              }
                            : cfg.amountStyle === "crystallize"
                            ? {
                                background: "linear-gradient(135deg, rgba(191,219,254,0.85), rgba(147,197,253,0.75))",
                                backdropFilter: "blur(28px) saturate(1.4)",
                                border: `1px solid ${cfg.cardStyle.border}`,
                                boxShadow: cfg.cardStyle.shadow,
                                color: "#1e3a5f",
                              }
                            : { background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))", boxShadow: cfg.cardStyle.shadow }
                        }
                      >
                        <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
                        {cfg.amountStyle === "glow-reveal" && (
                          <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full blur-3xl" style={{ background: "rgba(255,200,80,0.15)" }} />
                        )}

                        <div className="relative z-10 flex flex-col items-center">
                          {giftIntent && (
                            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 backdrop-blur-sm mb-6 text-sm font-medium">
                              <Sparkles className="w-4 h-4" />
                              <span>{giftIntent}</span>
                            </div>
                          )}
                          <h3 className="text-xl md:text-2xl font-medium opacity-90 mb-2">You received</h3>
                          <div className="font-serif text-6xl md:text-9xl mb-8 tracking-tighter">
                            {cfg.amountStyle === "count-up" ? (
                              <motion.span
                                initial={{ scale: 0.8, opacity: 0 }}
                                whileInView={{ scale: 1, opacity: 1 }}
                                viewport={{ once: true }}
                                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                              >
                                ${formatAmt(String(countedAmount))}
                              </motion.span>
                            ) : cfg.amountStyle === "crystallize" ? (
                              <motion.span
                                initial={{ filter: "blur(18px)", opacity: 0 }}
                                whileInView={{ filter: "blur(0px)", opacity: 1 }}
                                viewport={{ once: true }}
                                transition={{ duration: 1.0 }}
                                style={{ display: "inline-block" }}
                              >
                                ${formatAmt(giftAmount)}
                              </motion.span>
                            ) : cfg.amountStyle === "bloom-pop" ? (
                              <motion.span
                                initial={{ scale: 0.6, opacity: 0 }}
                                whileInView={{ scale: 1, opacity: 1 }}
                                viewport={{ once: true }}
                                transition={{ type: "spring", stiffness: 240, damping: 18 }}
                                style={{ display: "inline-block" }}
                              >
                                ${formatAmt(giftAmount)}
                              </motion.span>
                            ) : (
                              <motion.span
                                initial={{ y: 20, opacity: 0 }}
                                whileInView={{ y: 0, opacity: 1 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
                                style={{ display: "inline-block" }}
                              >
                                ${formatAmt(giftAmount)}
                              </motion.span>
                            )}
                          </div>
                          <p className="text-lg opacity-80 mb-10 max-w-md mx-auto">
                            Sent with intention. Yours to use however you need.
                          </p>
                          {giftPaid ? (
                            isPreview ? (
                              <Button size="lg" disabled className="rounded-full h-16 px-10 text-xl bg-white text-primary opacity-50 cursor-default shadow-xl w-full sm:w-auto">
                                Redeem your balance
                              </Button>
                            ) : (
                              <Link href="/redeem">
                                <Button size="lg" className="rounded-full h-16 px-10 text-xl bg-white text-primary hover:bg-white/90 shadow-xl hover:-translate-y-1 transition-all w-full sm:w-auto">
                                  Redeem your balance
                                </Button>
                              </Link>
                            )
                          ) : (
                            <p className="text-sm opacity-60 italic">Payment pending — check back soon.</p>
                          )}
                        </div>
                      </div>
                    )}
                  </Section>
                </div>
              )}

            </div>

            {/* Reaction panel — shown after full reveal, real gifts only */}
            {!isPreview && giftId && openPhase >= 4 && !reactionSkipped && (
              <div className="max-w-4xl mx-auto px-4 sm:px-6 mt-16 mb-2">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.6, ease: "easeOut", delay: 0.5 }}
                  className="text-center py-2"
                >
                  {reactionSent ? (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3 }}
                      className="flex items-center justify-center gap-2"
                    >
                      <span className="text-xl">{reactionEmoji}</span>
                      <span className={`text-xs ${isDark ? "text-white/30" : "text-muted-foreground/50"}`}>
                        Sent to {senderName}
                      </span>
                    </motion.div>
                  ) : (
                    <>
                      <p className={`text-xs mb-3 ${isDark ? "text-white/30" : "text-muted-foreground/50"}`}>
                        Send {senderName} a quick reaction
                      </p>
                      <div className="flex items-center justify-center gap-4 mb-3 flex-wrap">
                        {(["❤️", "😭", "🤯", "😊", "🙏"] as const).map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={async () => {
                              setReactionEmoji(emoji);
                              const base = import.meta.env.BASE_URL.replace(/\/$/, "");
                              try {
                                await fetch(`${base}/api/gifted/gifts/${encodeURIComponent(giftId)}/reaction`, {
                                  method: "PATCH",
                                  headers: { "Content-Type": "application/json" },
                                  credentials: "include",
                                  body: JSON.stringify({ reaction: emoji }),
                                });
                              } catch {}
                              setReactionSent(true);
                            }}
                            className="text-2xl transition-all duration-150 hover:scale-125 active:scale-110"
                            style={{ lineHeight: 1 }}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => setReactionSkipped(true)}
                        className={`text-xs underline underline-offset-2 ${isDark ? "text-white/20 hover:text-white/40" : "text-muted-foreground/30 hover:text-muted-foreground/60"} transition-colors`}
                      >
                        Skip
                      </button>
                    </>
                  )}
                </motion.div>
              </div>
            )}

            {/* Viral CTA — shown to every gift recipient */}
            <div className="max-w-4xl mx-auto px-4 sm:px-6 mt-20 mb-8">
              <div
                className="rounded-3xl border p-8 text-center"
                style={{
                  background: isDark ? "rgba(255,255,255,0.04)" : "hsl(var(--card))",
                  borderColor: isDark ? "rgba(255,255,255,0.08)" : "hsl(var(--border))",
                }}
              >
                <p className={`text-xs font-semibold tracking-widest uppercase mb-3 ${isDark ? "text-white/35" : "text-muted-foreground/60"}`}>
                  gifted.
                </p>
                <h3 className={`font-serif text-2xl font-medium mb-2 ${isDark ? "text-white" : "text-foreground"}`}>
                  Want to send a moment like this?
                </h3>
                <p className={`text-sm mb-6 ${isDark ? "text-white/50" : "text-muted-foreground"}`}>
                  Send a gift in minutes — message, video, photos, music, and a cash balance they can actually use.
                </p>
                <Link href="/create">
                  <button
                    type="button"
                    className={`inline-flex items-center gap-2 px-7 py-3.5 rounded-full text-sm font-semibold transition-all hover:-translate-y-0.5 ${
                      isDark
                        ? "bg-white text-black hover:bg-white/90"
                        : "bg-foreground text-background hover:bg-foreground/90"
                    }`}
                  >
                    Send a gift <Sparkles className="w-4 h-4" />
                  </button>
                </Link>
              </div>
            </div>

          </motion.div>
        )}
      </AnimatePresence>

      {/* Photo lightbox */}
      <AnimatePresence>
        {lightboxUrl && (
          <motion.div
            key="lightbox"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
            onClick={() => setLightboxUrl(null)}
          >
            <motion.img
              src={lightboxUrl}
              alt="Photo"
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              className="max-w-full max-h-full rounded-2xl object-contain shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => setLightboxUrl(null)}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm flex items-center justify-center text-white transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
