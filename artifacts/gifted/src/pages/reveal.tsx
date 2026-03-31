import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence, useInView } from "framer-motion";
import confetti from "canvas-confetti";
import { Button } from "@/components/ui/button";
import { Play, Sparkles, Gift, Star, Heart, Snowflake, Sun, Flower2, Music, ExternalLink, X, ZoomIn, ImageOff, Copy, Check, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { mockGiftData } from "@/lib/mock-data";
import { gradientStyle, DEFAULT_EXPERIENCE } from "@/lib/experiences";
import { trackEvent } from "@/lib/analytics";

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
  "mothers-day": {
    titleStyle: "bloom",
    sectionStyle: "bloom-scale",
    amountStyle: "bloom-pop",
    sectionStagger: 0.18,
    sectionInitialDelay: 0.8,
    heroDelay: 0.4,
    heroDuration: 0.95,
    senderText: "With love from",
    isDark: false,
    envelopeExit: { opacity: 0, scale: 1.1, filter: "blur(8px)" },
    envelopeTransition: { duration: 0.65, ease: "easeOut" },
    ambientEffect: "petals",
    ambientIntensity: "high",
    preIconAnim: "heartbeat",
    preIconColorClass: "text-purple-400",
    cardStyle: {
      shadow: "0 8px 32px rgba(200,168,233,0.35)",
      border: "rgba(200,168,233,0.4)",
      bg: "rgba(200,168,233,0.08)",
    },
  },
  "fathers-day": {
    titleStyle: "blur-in",
    sectionStyle: "fade-drift",
    amountStyle: "glow-reveal",
    sectionStagger: 0.28,
    sectionInitialDelay: 1.0,
    heroDelay: 0.5,
    heroDuration: 1.1,
    senderText: "From",
    isDark: true,
    envelopeExit: { opacity: 0, scale: 0.88 },
    envelopeTransition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
    preIconAnim: "rise",
    preIconColorClass: "text-amber-400",
    ambientIntensity: "low",
    cardStyle: {
      shadow: "0 0 50px rgba(201,168,76,0.18), 0 20px 40px rgba(0,0,0,0.45)",
      border: "rgba(201,168,76,0.25)",
      bg: "rgba(255,255,255,0.05)",
    },
  },
};

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

function useReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return reduced;
}

function playChime() {
  try {
    const ACtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new ACtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.6);
    gain.gain.setValueAtTime(0.22, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 1.2);
  } catch { /* AudioContext may not be available or blocked */ }
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
    Array.from({ length: 11 }, (_, i) => {
      const angle = (i / 11) * Math.PI * 2 + Math.random() * 0.8;
      const dist  = 55 + Math.random() * 60;
      return {
        id:  i,
        left: 5 + Math.random() * 88,
        top:  10 + Math.random() * 75,
        size: 130 + Math.random() * 200,
        dur:  14 + Math.random() * 10,
        del:  Math.random() * 8,
        opacity: 0.15 + Math.random() * 0.18,
        dx: Math.cos(angle) * dist,
        dy: Math.sin(angle) * dist,
      };
    }),
    []
  );

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 1 }}>
      {circles.map(c => (
        <motion.div
          key={c.id}
          animate={{ x: [0, c.dx, 0], y: [0, c.dy, 0] }}
          transition={{ duration: c.dur, delay: c.del, repeat: Infinity, ease: "easeInOut" }}
          style={{
            position: "absolute",
            left: `${c.left}%`,
            top: `${c.top}%`,
            width: c.size,
            height: c.size,
            borderRadius: "50%",
            background: `radial-gradient(circle, rgba(247,197,130,${c.opacity * 2.2}) 0%, rgba(232,168,80,${c.opacity}) 45%, transparent 70%)`,
            transform: "translate(-50%, -50%)",
            filter: "blur(3px)",
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
  "mothers-day":    Flower2,
  "fathers-day":    Star,
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
    duration: [2000, 3800],
    keyframe: "gifted-petal-fall",
  },
  "rose-petals": {
    colors: ["#FFB7C5", "#FF8FAB", "#E8A7B1", "#FFC0CB", "#FFFFFF", "#fda4af", "#fb7185"],
    sizes: [16, 30],
    batchSize: 12,
    batchInterval: 560,
    duration: [2200, 4500],
    keyframe: "gifted-petal-fall",
  },
  snow: {
    colors: ["#FFFFFF", "#E8F4FD", "#BDE0FE", "#E0EFFF", "#f0f9ff"],
    sizes: [4, 14],
    batchSize: 24,
    batchInterval: 260,
    duration: [1500, 3000],
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

  // Auto-stop spawning new particles after 8 s; in-flight ones fall out naturally
  const autoStop = setTimeout(() => {
    active = false;
    clearInterval(iv);
  }, 8000);

  return () => {
    active = false;
    clearInterval(iv);
    clearTimeout(autoStop);
    setTimeout(() => container.remove(), 4500);
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
        confetti({ particleCount: 8, angle: 90, spread: 85, origin: { x: Math.random(), y: 1 }, colors, gravity: 0.3, scalar: 1.2, drift: 0.5 });
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

// ─── Lightbox carousel ───────────────────────────────────────────────────────

function LightboxCarousel({
  photoUrls,
  initialIdx,
  onClose,
}: {
  photoUrls: string[];
  initialIdx: number;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(initialIdx);
  const total = photoUrls.length;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft")  setIdx(i => Math.max(0, i - 1));
      else if (e.key === "ArrowRight") setIdx(i => Math.min(total - 1, i + 1));
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [total, onClose]);

  return (
    <motion.div
      key="lightbox"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/92 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Photo — slides on change */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.img
          key={idx}
          src={photoUrls[idx]}
          alt={`Photo ${idx + 1}`}
          initial={{ opacity: 0, x: 48 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -48 }}
          transition={{ duration: 0.2, ease: [0.32, 0, 0.67, 0] }}
          className="max-w-[92vw] max-h-[80vh] rounded-2xl object-contain shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        />
      </AnimatePresence>

      {/* Prev */}
      {idx > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); setIdx(i => i - 1); }}
          className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/25 backdrop-blur-sm flex items-center justify-center text-white transition-colors"
          aria-label="Previous"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}

      {/* Next */}
      {idx < total - 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); setIdx(i => i + 1); }}
          className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/25 backdrop-blur-sm flex items-center justify-center text-white transition-colors"
          aria-label="Next"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}

      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/25 backdrop-blur-sm flex items-center justify-center text-white transition-colors"
        aria-label="Close"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Counter + dots (only when multiple photos) */}
      {total > 1 && (
        <>
          <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white/50 text-sm font-medium tabular-nums select-none">
            {idx + 1} / {total}
          </div>
          <div
            className="absolute bottom-6 flex items-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            {photoUrls.map((_, i) => (
              <button
                key={i}
                onClick={(e) => { e.stopPropagation(); setIdx(i); }}
                className="h-1.5 rounded-full transition-all duration-300 bg-white"
                style={{ width: i === idx ? "1.5rem" : "0.375rem", opacity: i === idx ? 1 : 0.35 }}
                aria-label={`Go to photo ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </motion.div>
  );
}

// ─── Photo carousel ──────────────────────────────────────────────────────────

function PhotoCarousel({
  photoUrls,
  photoErrors,
  photoLoaded,
  setPhotoLoaded,
  setPhotoErrors,
  setLightboxIdx,
  onPhotoError,
  cfg,
  isDark,
}: {
  photoUrls: string[];
  photoErrors: Record<number, boolean>;
  photoLoaded: Record<number, boolean>;
  setPhotoLoaded: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  setPhotoErrors: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  setLightboxIdx: (idx: number | null) => void;
  onPhotoError?: (i: number) => void;
  cfg: RevealCfg;
  isDark: boolean;
}) {
  const [activeIdx, setActiveIdx] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollTo = useCallback((idx: number) => {
    if (!scrollRef.current) return;
    const child = scrollRef.current.children[idx] as HTMLElement | undefined;
    if (child) scrollRef.current.scrollTo({ left: child.offsetLeft, behavior: "smooth" });
    setActiveIdx(idx);
  }, []);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const scrollLeft = scrollRef.current.scrollLeft;
    const children = Array.from(scrollRef.current.children) as HTMLElement[];
    let closest = 0;
    let minDist = Infinity;
    children.forEach((child, i) => {
      const dist = Math.abs(child.offsetLeft - scrollLeft);
      if (dist < minDist) { minDist = dist; closest = i; }
    });
    setActiveIdx(closest);
  }, []);

  if (photoUrls.length === 1) {
    const failed = !!photoErrors[0];
    const loaded = !!photoLoaded[0];
    return (
      <div
        className={`w-full rounded-3xl overflow-hidden relative group flex items-center justify-center min-h-[200px] ${!failed ? "cursor-pointer" : ""}`}
        style={isDark ? { background: "rgba(255,255,255,0.06)", boxShadow: cfg.cardStyle.shadow } : { background: "hsl(var(--secondary))", boxShadow: cfg.cardStyle.shadow }}
        onClick={() => !failed && setLightboxIdx(0)}
      >
        {!failed && (
          <>
            {!loaded && <div className="absolute inset-0 animate-pulse" style={isDark ? { background: "rgba(255,255,255,0.08)" } : { background: "hsl(var(--secondary))" }} />}
            <img
              src={photoUrls[0]}
              alt="Memory"
              className={`w-full h-auto max-h-[50vh] sm:max-h-[65vh] object-contain block ${loaded ? "opacity-100" : "opacity-0"}`}
              style={{ transition: "opacity 0.3s ease" }}
              onLoad={() => setPhotoLoaded(p => ({ ...p, 0: true }))}
              onError={() => onPhotoError ? onPhotoError(0) : setPhotoErrors(p => ({ ...p, 0: true }))}
            />
            {loaded && (
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/20">
                <div className="w-10 h-10 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center shadow-lg">
                  <ZoomIn className="w-5 h-5 text-gray-800" />
                </div>
              </div>
            )}
          </>
        )}
        {failed && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <ImageOff className={`w-8 h-8 ${isDark ? "text-white/20" : "text-muted-foreground/30"}`} />
            <p className={`text-xs ${isDark ? "text-white/30" : "text-muted-foreground/50"}`}>Photo unavailable</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative group">
      {/* Scroll track — mobile: full-width slides; desktop: 85% slides so next peeks ~15% */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex overflow-x-auto snap-x snap-mandatory gap-3"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" } as React.CSSProperties}
      >
        {photoUrls.map((url, i) => {
          const failed = !!photoErrors[i];
          const loaded = !!photoLoaded[i];
          return (
            <div
              key={i}
              className={`snap-start shrink-0 w-full md:w-[85%] relative rounded-3xl overflow-hidden flex items-center justify-center min-h-[200px] ${!failed ? "cursor-pointer" : ""}`}
              style={isDark ? { background: "rgba(255,255,255,0.06)", boxShadow: cfg.cardStyle.shadow } : { background: "hsl(var(--secondary))", boxShadow: cfg.cardStyle.shadow }}
              onClick={() => !failed && setLightboxIdx(i)}
            >
              {!failed && (
                <>
                  {!loaded && <div className="absolute inset-0 animate-pulse" style={isDark ? { background: "rgba(255,255,255,0.08)" } : { background: "hsl(var(--secondary))" }} />}
                  <img
                    src={url}
                    alt={`Memory ${i + 1}`}
                    className={`w-full h-auto max-h-[50vh] sm:max-h-[65vh] object-contain block ${loaded ? "opacity-100" : "opacity-0"}`}
                    style={{ transition: "opacity 0.3s ease" }}
                    onLoad={() => setPhotoLoaded(p => ({ ...p, [i]: true }))}
                    onError={() => onPhotoError ? onPhotoError(i) : setPhotoErrors(p => ({ ...p, [i]: true }))}
                  />
                  {loaded && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/20">
                      <div className="w-10 h-10 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center shadow-lg">
                        <ZoomIn className="w-5 h-5 text-gray-800" />
                      </div>
                    </div>
                  )}
                </>
              )}
              {failed && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                  <ImageOff className={`w-8 h-8 ${isDark ? "text-white/20" : "text-muted-foreground/30"}`} />
                  <p className={`text-xs ${isDark ? "text-white/30" : "text-muted-foreground/50"}`}>Photo unavailable</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Desktop prev/next arrows */}
      {activeIdx > 0 && (
        <button
          onClick={() => scrollTo(activeIdx - 1)}
          className="hidden md:flex absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 backdrop-blur-sm items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10"
        >
          <ChevronLeft className="w-5 h-5 text-gray-800" />
        </button>
      )}
      {activeIdx < photoUrls.length - 1 && (
        <button
          onClick={() => scrollTo(activeIdx + 1)}
          className="hidden md:flex absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 backdrop-blur-sm items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10"
        >
          <ChevronRight className="w-5 h-5 text-gray-800" />
        </button>
      )}

      {/* Dot indicators */}
      <div className="flex justify-center gap-2 mt-3">
        {photoUrls.map((_, i) => (
          <button
            key={i}
            onClick={() => scrollTo(i)}
            className="h-1.5 rounded-full transition-all duration-300"
            style={{
              width: i === activeIdx ? "1.5rem" : "0.375rem",
              background: isDark
                ? i === activeIdx ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.3)"
                : i === activeIdx ? "hsl(var(--primary))" : "hsl(var(--primary)/0.25)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Convergence particles for balance buildup ───────────────────────────────
const CONVERGE_PARTICLES: Array<{ x: number; y: number }> = [
  { x: -90, y: -70 }, { x: 90, y: -70 }, { x: -120, y: 10 },
  { x: 120, y: 10 }, { x: -60, y: 80 }, { x: 60, y: 80 },
  { x: 0, y: -100 }, { x: 0, y: 95 },
];

// ─── Section wrapper ─────────────────────────────────────────────────────────

function Section({
  cfg: _cfg,
  idx: _idx,
  className = "",
  children,
}: {
  cfg: RevealCfg;
  idx: number;
  className?: string;
  children: React.ReactNode;
}) {
  const reducedMotion = useReducedMotion();
  const initial = reducedMotion ? { opacity: 0 } : { opacity: 0, y: 28 };
  const animate = reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 };
  const transition = reducedMotion
    ? { duration: 0.4 }
    : { duration: 0.65, ease: [0.16, 1, 0.3, 1] as number[] };
  return (
    <motion.div
      className={className}
      initial={initial}
      whileInView={animate}
      viewport={{ once: true, margin: "-60px" }}
      transition={transition}
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
  "mothers-day":    { box: "#C8A8E9", lid: "#a78bca", ribbon: "#FFB7C5", bow: "#FFD700" },
  "fathers-day":    { box: "#1A2E4A", lid: "#152540", ribbon: "#C9A84C", bow: "#FFD700" },
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

// ─── Scroll-to-explore hint (post-reveal only) ────────────────────────────────

function ScrollHint({ isDark }: { isDark: boolean }) {
  const [visible, setVisible] = React.useState(true);
  React.useEffect(() => {
    const t = setTimeout(() => setVisible(false), 3000);
    return () => clearTimeout(t);
  }, []);
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center justify-center pt-3 pb-1 pointer-events-none"
        >
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className={isDark ? "text-white/30" : "text-muted-foreground/40"}>
              <path d="M10 3v11M10 14l-4-4M10 14l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </motion.div>
          <p className={`text-[10px] tracking-widest uppercase mt-1 ${isDark ? "text-white/25" : "text-muted-foreground/40"}`}>
            scroll to explore
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Tracking timeline ────────────────────────────────────────────────────────

interface TrackingEvent {
  status: string;
  message: string;
  location?: string;
  timestamp: string;
}

const CARRIER_LABELS: Record<string, string> = {
  usps: "USPS",
  ups: "UPS",
  fedex: "FedEx",
  dhl: "DHL",
  "canada-post": "Canada Post",
  amazon: "Amazon Logistics",
  lasership: "LaserShip",
  ontrac: "OnTrac",
};

const STATUS_LABEL: Record<string, string> = {
  InfoReceived: "Label Created",
  InTransit: "In Transit",
  OutForDelivery: "Out for Delivery",
  AttemptFail: "Delivery Attempted",
  Delivered: "Delivered",
  AvailableForPickup: "Ready for Pickup",
  Exception: "Exception",
  Expired: "Expired",
};

function formatTrackingTs(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  } catch {
    return ts;
  }
}

function TrackingTimeline({
  carrier,
  trackingNumber,
  events,
  deliveredAt,
  cfg,
  isDark,
}: {
  carrier: string;
  trackingNumber: string;
  events: TrackingEvent[];
  deliveredAt: string | null;
  cfg: RevealCfg;
  isDark: boolean;
}) {
  const isDelivered = !!deliveredAt || events.some(e => e.status === "Delivered");

  const MILESTONE_STATUSES = ["InfoReceived", "InTransit", "OutForDelivery", "Delivered"];

  const reachedMilestones = new Set<string>();
  for (const e of events) {
    if (MILESTONE_STATUSES.includes(e.status)) reachedMilestones.add(e.status);
    if (e.status === "OutForDelivery" || e.status === "AttemptFail") reachedMilestones.add("OutForDelivery");
    if (e.status === "Delivered") { reachedMilestones.add("Delivered"); }
  }

  const latestEvent = events.length > 0 ? events[events.length - 1] : null;
  const latestLabel = latestEvent
    ? (STATUS_LABEL[latestEvent.status] ?? latestEvent.status)
    : null;

  // Truncate long tracking numbers for display
  const displayTrackingNumber = trackingNumber.length > 20
    ? `${trackingNumber.slice(0, 8)}…${trackingNumber.slice(-4)}`
    : trackingNumber;

  return (
    <div
      className="rounded-3xl border overflow-hidden"
      style={{
        borderColor: isDark ? "rgba(255,255,255,0.1)" : `${cfg.cardStyle.border}`,
        background: isDark ? "rgba(255,255,255,0.04)" : cfg.cardStyle.bg ?? "hsl(var(--card))",
        boxShadow: cfg.cardStyle.shadow,
      }}
    >
      <div className="px-4 sm:px-6 pt-5 pb-4">

        {/* Header: carrier + number left, status badge right */}
        <div className="flex items-start justify-between gap-2 mb-5">
          <div className="min-w-0">
            <p className={`text-[11px] font-semibold tracking-widest uppercase mb-1 ${isDark ? "text-white/35" : "text-muted-foreground/60"}`}>
              Package tracking
            </p>
            <p className={`text-xs font-mono leading-snug ${isDark ? "text-white/40" : "text-muted-foreground/60"}`}>
              <span className="block sm:inline">{CARRIER_LABELS[carrier] ?? carrier}</span>
              <span className="hidden sm:inline"> · </span>
              <span className="block sm:inline">{displayTrackingNumber}</span>
            </p>
          </div>
          {isDelivered && (
            <div
              className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-semibold shrink-0"
              style={{ background: isDark ? "rgba(134,239,172,0.12)" : "hsl(142 76% 96%)", color: isDark ? "#86efac" : "#15803d" }}
            >
              <span>✓</span> Delivered
            </div>
          )}
          {!isDelivered && latestLabel && (
            <div
              className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 text-center leading-tight"
              style={{ background: isDark ? "rgba(147,197,253,0.12)" : "hsl(214 100% 96%)", color: isDark ? "#93c5fd" : "#1d4ed8" }}
            >
              {latestLabel}
            </div>
          )}
        </div>

        {/* Milestone steps — labels visible on all screen sizes */}
        <div className="flex items-start gap-0 mb-5">
          {MILESTONE_STATUSES.map((ms, i) => {
            const reached = reachedMilestones.has(ms);
            const isLast = i === MILESTONE_STATUSES.length - 1;
            return (
              <React.Fragment key={ms}>
                <div className="flex flex-col items-center gap-1 min-w-0">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] shrink-0 transition-all duration-500"
                    style={{
                      background: reached
                        ? (isDark ? "rgba(255,255,255,0.85)" : "hsl(var(--primary))")
                        : (isDark ? "rgba(255,255,255,0.1)" : "hsl(var(--secondary))"),
                      color: reached
                        ? (isDark ? "#111" : "hsl(var(--primary-foreground))")
                        : (isDark ? "rgba(255,255,255,0.3)" : "hsl(var(--muted-foreground))"),
                    }}
                  >
                    {reached ? "✓" : (i + 1)}
                  </div>
                  <span
                    className="text-[8px] sm:text-[9px] font-medium text-center leading-tight max-w-[44px] sm:max-w-[52px]"
                    style={{ color: reached ? (isDark ? "rgba(255,255,255,0.7)" : "hsl(var(--foreground))") : (isDark ? "rgba(255,255,255,0.25)" : "hsl(var(--muted-foreground))") }}
                  >
                    {STATUS_LABEL[ms] ?? ms}
                  </span>
                </div>
                {!isLast && (
                  // mt-3 aligns the connector with the dot center (half of 24px dot = 12px ≈ mt-3)
                  <div className="flex-1 h-px mx-1 sm:mx-1.5 mt-3 relative overflow-hidden" style={{ background: isDark ? "rgba(255,255,255,0.08)" : "hsl(var(--border))" }}>
                    <div
                      className="absolute inset-y-0 left-0 transition-all duration-700"
                      style={{
                        width: reached ? "100%" : "0%",
                        background: isDark ? "rgba(255,255,255,0.5)" : "hsl(var(--primary))",
                      }}
                    />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Recent events list */}
        {events.length > 0 && (
          <div className="space-y-3 border-t pt-4" style={{ borderColor: isDark ? "rgba(255,255,255,0.06)" : "hsl(var(--border))" }}>
            {[...events].reverse().slice(0, 5).map((ev, i) => (
              <div key={i} className="flex gap-3">
                <div
                  className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                  style={{ background: ev.status === "Delivered" ? (isDark ? "#86efac" : "#16a34a") : (isDark ? "rgba(255,255,255,0.25)" : "hsl(var(--primary)/0.4)") }}
                />
                <div className="min-w-0 flex-1">
                  <p className={`text-xs font-medium leading-snug ${isDark ? "text-white/70" : "text-foreground"}`}>
                    {ev.message || STATUS_LABEL[ev.status] || ev.status}
                  </p>
                  {ev.location && (
                    <p className={`text-[11px] mt-0.5 ${isDark ? "text-white/35" : "text-muted-foreground"}`}>
                      {ev.location}
                    </p>
                  )}
                  <p className={`text-[11px] mt-0.5 ${isDark ? "text-white/25" : "text-muted-foreground/60"}`}>
                    {formatTrackingTs(ev.timestamp)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {events.length === 0 && (
          <p className={`text-xs text-center py-2 ${isDark ? "text-white/30" : "text-muted-foreground/50"}`}>
            Tracking updates will appear here once the carrier scans the package.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function RevealPage({ onRevealComplete }: { onRevealComplete?: () => void } = {}) {
  const [isOpen, setIsOpen]               = useState(false);
  const [videoUrl, setVideoUrl]           = useState<string | null>(null);
  const [videoError, setVideoError]       = useState(false);
  const [videoRefreshing, setVideoRefreshing] = useState(false);
  const videoRef                          = useRef<HTMLVideoElement>(null);
  const videoPathRef                      = useRef<string | null>(null);
  const photoPathsRef                     = useRef<string[]>([]);
  const [photoUrls, setPhotoUrls]         = useState<string[]>([]);
  const [photoErrors, setPhotoErrors]     = useState<Record<number, boolean>>({});
  const [photoLoaded, setPhotoLoaded]     = useState<Record<number, boolean>>({});
  const [linkFailures, setLinkFailures]   = useState<Record<number, boolean>>({});
  const [linkCopied, setLinkCopied]       = useState<Record<number, boolean>>({});
  const [personalNote, setPersonalNote]   = useState<string | null>(null);
  const [extraLinks, setExtraLinks]       = useState<Array<{url: string; label: string; subtitle?: string}>>([]);
  const [recipientName, setRecipientName] = useState(mockGiftData.recipientName);
  const [senderName, setSenderName]       = useState(mockGiftData.senderName);
  const [giftTitle, setGiftTitle]         = useState(mockGiftData.title);
  const [experience, setExperience]       = useState(DEFAULT_EXPERIENCE);
  const [giftAmount, setGiftAmount]       = useState<string | null>(null);
  const [giftIntent, setGiftIntent]       = useState<string | null>(null);
  const [giftPaid, setGiftPaid]           = useState<boolean>(true);
  const [isPreview, setIsPreview]         = useState(false);
  const [previewBarCopied, setPreviewBarCopied] = useState(false);
  const [isOpening, setIsOpening]         = useState(false);
  const [openPhase, setOpenPhase]         = useState(0);
  const [lightboxIdx, setLightboxIdx]     = useState<number | null>(null);
  const [giftId, setGiftId]               = useState<string | null>(null);
  const [reactionEmoji, setReactionEmoji] = useState<string | null>(null);
  const [reactionSent, setReactionSent]   = useState(false);
  const [reactionSkipped, setReactionSkipped] = useState(false);
  const [, navigate] = useLocation();
  const [balanceRevealPhase, setBalanceRevealPhase] = useState<"hidden" | "building" | "revealed">("hidden");
  const [trackingData, setTrackingData]   = useState<{
    carrier: string;
    trackingNumber: string;
    events: TrackingEvent[];
    deliveredAt: string | null;
  } | null>(null);

  const amountRef  = useRef<HTMLDivElement>(null);
  const amountInView = useInView(amountRef, { once: true });

  const cfg = CONFIGS[experience] ?? CONFIGS[DEFAULT_EXPERIENCE];

  const countedAmount = useCountUp(
    Number(giftAmount || 0),
    1600,
    300,
    cfg.amountStyle === "count-up" && (amountInView || isPreview),
  );

  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (!giftAmount || parseFloat(giftAmount) <= 0) return;
    if (balanceRevealPhase !== "hidden") return;
    // Preview mode (sender checking their own gift): skip dramatic build-up, show amount immediately
    if (isPreview) {
      setBalanceRevealPhase("revealed");
      return;
    }
    if (!amountInView) return;
    if (reducedMotion) {
      setBalanceRevealPhase("revealed");
      return;
    }
    const t1 = setTimeout(() => setBalanceRevealPhase("building"), 200);
    const t2 = setTimeout(() => {
      setBalanceRevealPhase("revealed");
      if (amountRef.current) {
        const rect = amountRef.current.getBoundingClientRect();
        const ox = Math.min(Math.max((rect.left + rect.width / 2) / window.innerWidth, 0.1), 0.9);
        const oy = Math.min(Math.max((rect.top + rect.height / 2) / window.innerHeight, 0.1), 0.9);
        confetti({ particleCount: 90, spread: 75, origin: { x: ox, y: oy }, startVelocity: 24, scalar: 1.1 });
      }
      playChime();
    }, 1400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [amountInView, giftAmount, balanceRevealPhase, reducedMotion, isPreview]);

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

    const storedGiftId = localStorage.getItem("gifted_gift_id");
    const resolvedGiftId = giftIdParam || storedGiftId;

    if (resolvedGiftId) {
      setGiftId(resolvedGiftId);
      // Mark as opened (only for real opens, not preview mode)
      if (!isPreviewMode) {
        fetch(`${base}/api/gifted/gifts/${encodeURIComponent(resolvedGiftId)}/opened`, {
          method: "PATCH",
          credentials: "include",
        }).then(() => trackEvent("gift_opened", { gift_id: resolvedGiftId })).catch(() => { /* fire and forget */ });
      }
      fetch(`${base}/api/gifted/gifts/${encodeURIComponent(resolvedGiftId)}`, { credentials: "include" })
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

          const rawLinks: Array<string | {url: string; label: string; subtitle?: string}> =
            Array.isArray(gift.extraLinks) ? gift.extraLinks : [];
          const links = rawLinks
            .map(item => typeof item === "string" ? { url: item, label: "" } : item)
            .filter(l => l.url);
          if (links.length > 0) setExtraLinks(links);
          else if (gift.playlistUrl) setExtraLinks([{ url: gift.playlistUrl, label: "" }]);

          if (gift.videoPath) {
            videoPathRef.current = gift.videoPath;
            fetch(`${base}/api/storage/object-url?path=${encodeURIComponent(gift.videoPath)}`)
              .then(r => r.ok ? r.json() : null)
              .then(d => setVideoUrl(d?.url ?? `${base}/api/storage${gift.videoPath}`))
              .catch(() => setVideoUrl(`${base}/api/storage${gift.videoPath}`));
          }

          if (Array.isArray(gift.photoPaths) && gift.photoPaths.length > 0) {
            photoPathsRef.current = gift.photoPaths;
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

      fetch(`${base}/api/gifted/gifts/${encodeURIComponent(resolvedGiftId)}/tracking`, { credentials: "include" })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data?.hasTracking) {
            setTrackingData({
              carrier: data.carrier,
              trackingNumber: data.trackingNumber,
              events: data.events ?? [],
              deliveredAt: data.deliveredAt ?? null,
            });
          }
        })
        .catch(() => {});

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
      videoPathRef.current = vp;
      fetch(`${base}/api/storage/object-url?path=${encodeURIComponent(vp)}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => setVideoUrl(d?.url ?? `${base}/api/storage${vp}`))
        .catch(() => setVideoUrl(`${base}/api/storage${vp}`));
    }

    const pp = localStorage.getItem("gifted_photo_paths");
    if (pp) {
      try {
        const paths: string[] = JSON.parse(pp);
        photoPathsRef.current = paths;
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
      setExtraLinks(urlLinks.map(u => ({ url: u, label: "" })));
    } else {
      const elRaw = localStorage.getItem("gifted_extra_links");
      if (elRaw) {
        try {
          const parsed = JSON.parse(elRaw);
          if (Array.isArray(parsed)) {
            const normalized = parsed
              .map((item: string | {url: string; label: string; subtitle?: string}) =>
                typeof item === "string" ? { url: item, label: "" } : item
              )
              .filter(l => l.url);
            if (normalized.length > 0) setExtraLinks(normalized);
          }
        } catch { /* ignore */ }
      } else {
        const pl = localStorage.getItem("gifted_playlist_url");
        if (pl) setExtraLinks([{ url: pl, label: "" }]);
      }
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
    onRevealComplete?.();
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

  const base = import.meta.env.BASE_URL.replace(/\/$/, "");

  const handleVideoError = useCallback(async () => {
    const path = videoPathRef.current;
    if (!path || videoRefreshing) {
      setVideoError(true);
      return;
    }
    setVideoRefreshing(true);
    try {
      const res = await fetch(`${base}/api/storage/object-url?path=${encodeURIComponent(path)}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.url) {
          setVideoUrl(data.url);
          setVideoError(false);
          setVideoRefreshing(false);
          return;
        }
      }
    } catch { /* fall through */ }
    setVideoError(true);
    setVideoRefreshing(false);
  }, [base, videoRefreshing]);

  const handlePhotoError = useCallback(async (i: number) => {
    const path = photoPathsRef.current[i];
    if (!path) {
      setPhotoErrors(p => ({ ...p, [i]: true }));
      return;
    }
    try {
      const res = await fetch(`${base}/api/storage/object-url?path=${encodeURIComponent(path)}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.url) {
          setPhotoUrls(prev => {
            const next = [...prev];
            next[i] = data.url;
            return next;
          });
          setPhotoErrors(p => ({ ...p, [i]: false }));
          return;
        }
      }
    } catch { /* fall through */ }
    setPhotoErrors(p => ({ ...p, [i]: true }));
  }, [base]);


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
                  <div className="w-full flex justify-center" style={{ maxWidth: 210 }}>
                    <div style={{ width: 210, maxWidth: "80vw", overflow: "hidden" }}>
                      <GiftBoxOpening phase={openPhase} experience={experience} isDark={isDark} />
                    </div>
                  </div>
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

            {/* Hero */}
            <div className="w-full h-[40vh] sm:h-[52vh] md:h-[70vh] relative flex items-end">
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

            {/* Scroll to explore hint — anchored to top of revealed content, fades after 3s */}
            <ScrollHint isDark={isDark} />

            {/* Content sections */}
            <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-5 sm:space-y-8 md:space-y-14 -mt-4 md:-mt-6 relative z-20">

              {/* Note / message — section 0 (hidden when no note) */}
              {personalNote?.trim() && (
                <Section cfg={cfg} idx={0}>
                  <div
                    className="rounded-[2rem] sm:rounded-[2.5rem] p-5 sm:p-8 md:p-12 border relative overflow-hidden"
                    style={isDark
                      ? {
                          background: cfg.cardStyle.bg ?? "rgba(255,248,240,0.05)",
                          borderColor: cfg.cardStyle.border,
                          boxShadow: cfg.cardStyle.shadow,
                        }
                      : {
                          background: cfg.cardStyle.bg ?? "hsl(30,38%,98%)",
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
                        <div style={{ borderTop: "1.5px solid rgba(181,234,215,0.55)", marginBottom: "1.25rem", width: "100%" }} />
                      </>
                    )}

                    {/* Rose Petal: stationery double-rule decoration */}
                    {experience === "rose-petal" && (
                      <div className="flex items-center gap-3 mb-7">
                        <div style={{ flex: 1, height: 1, background: "rgba(255,143,171,0.4)" }} />
                        <span style={{ color: "rgba(255,143,171,0.7)", fontSize: 14 }}>♥</span>
                        <div style={{ flex: 1, height: 1, background: "rgba(255,143,171,0.4)" }} />
                      </div>
                    )}

                    {/* Universal top rule — for all other experiences */}
                    {experience !== "garden-bloom" && experience !== "rose-petal" && (
                      <div style={{ height: 1, background: cfg.cardStyle.border, marginBottom: "1.25rem", width: "100%", opacity: 0.5 }} />
                    )}

                    {cfg.titleStyle === "typewriter" ? (
                      <p className={`font-serif text-sm sm:text-base md:text-xl text-center ${isDark ? "text-white/90" : "text-foreground"}`} style={{ lineHeight: 1.8 }}>
                        &ldquo;<TypewriterText text={personalNote} delayS={cfg.sectionInitialDelay + 0.3} speed={28} />&rdquo;
                      </p>
                    ) : (
                      <p className={`font-serif text-sm sm:text-base md:text-xl text-center ${isDark ? "text-white/90" : "text-foreground"}`} style={{ lineHeight: 1.8 }}>
                        &ldquo;{personalNote}&rdquo;
                      </p>
                    )}

                    {/* Garden Bloom: bottom accent line */}
                    {experience === "garden-bloom" && (
                      <div style={{ borderBottom: "1.5px solid rgba(181,234,215,0.55)", marginTop: "1.25rem", width: "100%" }} />
                    )}

                    {/* Rose Petal: bottom stationery line */}
                    {experience === "rose-petal" && (
                      <div className="flex items-center gap-3 mt-4 sm:mt-7">
                        <div style={{ flex: 1, height: 1, background: "rgba(255,143,171,0.4)" }} />
                        <span style={{ color: "rgba(255,143,171,0.7)", fontSize: 14 }}>♥</span>
                        <div style={{ flex: 1, height: 1, background: "rgba(255,143,171,0.4)" }} />
                      </div>
                    )}

                    {/* Universal bottom rule — for all other experiences */}
                    {experience !== "garden-bloom" && experience !== "rose-petal" && (
                      <div style={{ height: 1, background: cfg.cardStyle.border, marginTop: "1.25rem", width: "100%", opacity: 0.5 }} />
                    )}
                  </div>
                </Section>
              )}

              {/* Video — section 1 (hidden when no video) */}
              {videoUrl && (
                <Section cfg={cfg} idx={1}>
                  <div className="flex flex-col gap-2">
                    <div
                      className="w-full rounded-[2rem] overflow-hidden border"
                      style={{
                        borderColor: cfg.cardStyle.border,
                        boxShadow: cfg.cardStyle.shadow,
                      }}
                    >
                      <div className="w-full aspect-video relative group">
                        {videoRefreshing ? (
                          <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-black/10">
                            <div className="w-8 h-8 border-2 border-white/40 border-t-white/90 rounded-full animate-spin" />
                            <p className="text-xs text-white/70">Loading video…</p>
                          </div>
                        ) : (
                          <video
                            key={videoUrl}
                            ref={videoRef}
                            src={videoUrl}
                            playsInline
                            controls
                            preload="auto"
                            className="w-full h-full object-cover"
                            onError={handleVideoError}
                          />
                        )}
                        {videoError && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/20 backdrop-blur-sm">
                            <p className={`text-sm font-medium ${isDark ? "text-white/80" : "text-white"}`}>
                              Video couldn't play
                            </p>
                            {giftId && (
                              <a
                                href={`${base}/api/gifted/gifts/${encodeURIComponent(giftId)}/video/download`}
                                download="gift-video.mp4"
                                className="px-4 py-2 rounded-full text-xs font-semibold bg-white/90 text-gray-900 hover:bg-white transition-colors shadow"
                              >
                                Download video instead
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Download link — proxied through our server so mobile saves the file properly */}
                    {!videoError && giftId && (
                      <div className="flex justify-end px-1">
                        <a
                          href={`${base}/api/gifted/gifts/${encodeURIComponent(giftId)}/video/download`}
                          download="gift-video.mp4"
                          className={`flex items-center gap-1.5 text-xs font-medium transition-opacity hover:opacity-70 active:opacity-50 ${isDark ? "text-white/35" : "text-muted-foreground/60"}`}
                        >
                          <Download className="w-3 h-3" />
                          Download video
                        </a>
                      </div>
                    )}
                  </div>
                </Section>
              )}

              {/* Photos — section 2 (hidden when no photos) */}
              {photoUrls.length > 0 && (
                <Section cfg={cfg} idx={2}>
                  <PhotoCarousel
                    photoUrls={photoUrls}
                    photoErrors={photoErrors}
                    photoLoaded={photoLoaded}
                    setPhotoLoaded={setPhotoLoaded}
                    setPhotoErrors={setPhotoErrors}
                    setLightboxIdx={setLightboxIdx}
                    onPhotoError={handlePhotoError}
                    cfg={cfg}
                    isDark={isDark}
                  />
                </Section>
              )}

              {/* Link cards — one per extra link */}
              {extraLinks.length > 0 && extraLinks.map((link, linkIdx) => {
                if (!link.url) return null;
                const u = link.url.toLowerCase();
                const isMusic = u.includes("spotify.com") || u.includes("music.apple.com") || u.includes("soundcloud.com") || u.includes("tidal.com") || u.includes("deezer.com");
                const isTickets = u.includes("ticketmaster.com") || u.includes("axs.com") || u.includes("stubhub.com") || u.includes("seatgeek.com") || u.includes("livenation.com");
                const isFood = u.includes("opentable.com") || u.includes("resy.com") || u.includes("yelp.com/biz") || u.includes("tock.com");
                const isTravel = u.includes("airbnb.com") || u.includes("vrbo.com") || u.includes("hotels.com") || u.includes("booking.com");
                const fallbackLabel =
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
                const fallbackSubtitle =
                  isMusic ? "Tap to listen" :
                  u.includes("youtube.com") || u.includes("youtu.be") ? "Tap to watch" :
                  isTickets ? "Tap to view tickets" :
                  isFood ? "Tap to view reservation" :
                  isTravel ? "Tap to view" :
                  "Tap to open";

                const label = link.label || fallbackLabel;
                const subtitle = link.subtitle || fallbackSubtitle;
                const hasFailed = !!linkFailures[linkIdx];
                const hasCopied = !!linkCopied[linkIdx];

                const youtubeId = (() => {
                  try {
                    const parsed = new URL(link.url);
                    if (parsed.hostname.includes("youtu.be")) return parsed.pathname.slice(1).split("?")[0] || null;
                    if (parsed.hostname.includes("youtube.com")) {
                      if (parsed.pathname.startsWith("/shorts/")) return parsed.pathname.split("/shorts/")[1].split("?")[0] || null;
                      return parsed.searchParams.get("v");
                    }
                    return null;
                  } catch { return null; }
                })();
                const isYouTube = !!youtubeId;

                const handleLinkClick = (e: React.MouseEvent) => {
                  e.preventDefault();
                  try {
                    const win = window.open(link.url, "_blank", "noopener,noreferrer");
                    if (!win) {
                      setLinkFailures(prev => ({ ...prev, [linkIdx]: true }));
                    }
                  } catch {
                    setLinkFailures(prev => ({ ...prev, [linkIdx]: true }));
                  }
                };

                const handleCopyLink = async () => {
                  try {
                    await navigator.clipboard.writeText(link.url);
                    setLinkCopied(prev => ({ ...prev, [linkIdx]: true }));
                    setTimeout(() => setLinkCopied(prev => ({ ...prev, [linkIdx]: false })), 2500);
                  } catch { /* ignore */ }
                };

                return (
                  <Section key={linkIdx} cfg={cfg} idx={2 + linkIdx}>
                    <div
                      className="rounded-[2rem] p-5 border relative overflow-hidden"
                      style={isDark
                        ? { background: cfg.cardStyle.bg ?? "rgba(255,255,255,0.06)", borderColor: cfg.cardStyle.border, boxShadow: cfg.cardStyle.shadow }
                        : { background: cfg.cardStyle.bg ?? "hsl(var(--card)/0.8)", backdropFilter: experience === "snow-flurry" ? "blur(24px) saturate(1.3)" : "blur(20px)", borderColor: cfg.cardStyle.border, boxShadow: cfg.cardStyle.shadow }
                      }
                    >
                      {experience === "garden-bloom" && <GardenBloomWatermark />}

                      {isYouTube ? (
                        <div className="flex flex-col gap-3">
                          {link.label && (
                            <p className={`font-semibold text-base leading-snug line-clamp-2 ${isDark ? "text-white" : "text-foreground"}`}>{link.label}</p>
                          )}
                          <div className="relative w-full rounded-2xl overflow-hidden" style={{ aspectRatio: "16/9" }}>
                            <iframe
                              src={`https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0&modestbranding=1&playsinline=1`}
                              title={label}
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                              allowFullScreen
                              className="absolute inset-0 w-full h-full"
                              style={{ border: "none" }}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={handleLinkClick}
                            className={`flex items-center gap-1.5 text-xs font-medium self-start transition-opacity hover:opacity-70 ${isDark ? "text-white/40" : "text-muted-foreground"}`}
                          >
                            <ExternalLink className="w-3 h-3" />
                            Open on YouTube
                          </button>
                        </div>
                      ) : hasFailed ? (
                        <div className="flex flex-col gap-3">
                          <div className="flex items-center gap-4">
                            <div
                              className="w-14 h-14 rounded-2xl flex-shrink-0 flex items-center justify-center"
                              style={isDark ? { background: "rgba(255,255,255,0.08)" } : { background: "hsl(var(--muted))" }}
                            >
                              <ExternalLink className={`w-6 h-6 ${isDark ? "text-white/40" : "text-muted-foreground/50"}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`font-semibold text-base leading-snug line-clamp-2 ${isDark ? "text-white/70" : "text-foreground/70"}`}>{label}</p>
                              <p className={`text-sm ${isDark ? "text-white/40" : "text-muted-foreground"}`}>Couldn&apos;t open this link</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={handleCopyLink}
                            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full self-start transition-colors ${isDark ? "bg-white/10 text-white/70 hover:bg-white/15" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                          >
                            {hasCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            {hasCopied ? "Copied!" : "Copy link instead"}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={handleLinkClick}
                          className="w-full text-left transition-all hover:scale-[1.01] active:scale-[0.99]"
                        >
                          <div className="flex items-center gap-4">
                            <div
                              className="w-14 h-14 rounded-2xl flex-shrink-0 flex items-center justify-center"
                              style={isDark ? { background: "rgba(255,255,255,0.1)" } : { background: "hsl(var(--primary)/0.1)" }}
                            >
                              {isMusic
                                ? <Music className={`w-6 h-6 ${isDark ? "text-white/80" : "text-primary"}`} />
                                : <ExternalLink className={`w-6 h-6 ${isDark ? "text-white/80" : "text-primary"}`} />
                              }
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`font-semibold text-base leading-snug line-clamp-2 ${isDark ? "text-white" : "text-foreground"}`}>{label}</p>
                              <p className={`text-sm truncate ${isDark ? "text-white/50" : "text-muted-foreground"}`}>{subtitle}</p>
                            </div>
                            <ExternalLink className={`w-5 h-5 flex-shrink-0 ${isDark ? "text-white/40" : "text-muted-foreground"}`} />
                          </div>
                        </button>
                      )}
                    </div>
                  </Section>
                );
              })}

              {/* Balance — dramatic reveal after all content */}
              {giftAmount && parseFloat(giftAmount) > 0 && (
                <div ref={amountRef}>
                  <Section cfg={cfg} idx={2 + extraLinks.length}>
                    {cfg.amountStyle === "stellar-reveal" ? (
                      /* Midnight Stars: distinct dark card */
                      <div
                        className="w-full rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-10 md:p-14 text-center relative overflow-hidden"
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
                          <h3 className="text-base sm:text-xl md:text-2xl font-medium mb-4 sm:mb-6 text-white/80">You received</h3>

                          {/* Dramatic amount reveal */}
                          <div className="relative flex items-center justify-center mb-5 sm:mb-8">
                            {balanceRevealPhase === "building" && (
                              <>
                                <motion.div
                                  className="absolute w-40 h-40 rounded-full border-2"
                                  style={{ borderColor: "rgba(180,160,255,0.4)" }}
                                  animate={{ scale: [1, 1.35, 1], opacity: [0.6, 0.15, 0.6] }}
                                  transition={{ repeat: Infinity, duration: 1.0, ease: "easeInOut" }}
                                />
                                <motion.div
                                  className="absolute w-56 h-56 rounded-full border"
                                  style={{ borderColor: "rgba(180,160,255,0.2)" }}
                                  animate={{ scale: [1, 1.25, 1], opacity: [0.4, 0.1, 0.4] }}
                                  transition={{ repeat: Infinity, duration: 1.0, ease: "easeInOut", delay: 0.2 }}
                                />
                                {CONVERGE_PARTICLES.map((p, i) => (
                                  <motion.div
                                    key={i}
                                    className="absolute w-2 h-2 rounded-full"
                                    style={{ background: "rgba(180,160,255,0.85)" }}
                                    initial={{ x: p.x, y: p.y, opacity: 0, scale: 1.2 }}
                                    animate={{ x: 0, y: 0, opacity: [0, 0.9, 0], scale: 0.2 }}
                                    transition={{ duration: 1.0, ease: "easeIn", delay: i * 0.08 }}
                                  />
                                ))}
                              </>
                            )}
                            <AnimatePresence mode="wait">
                              {balanceRevealPhase !== "revealed" ? (
                                <motion.div
                                  key="placeholder"
                                  className="font-serif text-5xl sm:text-6xl md:text-9xl tracking-tighter text-white"
                                  style={{ filter: "blur(12px)", opacity: 0.25, textShadow: "0 0 40px rgba(180,160,255,0.5)" }}
                                  exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
                                >
                                  $?
                                </motion.div>
                              ) : (
                                <motion.div
                                  key="amount"
                                  className="font-serif text-5xl sm:text-6xl md:text-9xl tracking-tighter text-white"
                                  style={{ textShadow: "0 0 40px rgba(180,160,255,0.5)" }}
                                  initial={reducedMotion ? { opacity: 0 } : { scale: 0.7, filter: "blur(20px)", opacity: 0 }}
                                  animate={reducedMotion ? { opacity: 1 } : { scale: [0.7, 1.06, 1.0], filter: "blur(0px)", opacity: 1 }}
                                  transition={reducedMotion ? { duration: 0.4 } : { type: "spring", stiffness: 260, damping: 20, duration: 0.7 }}
                                >
                                  ${formatAmt(giftAmount)}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>

                          <p className="text-sm sm:text-base mb-5 sm:mb-8 max-w-md mx-auto text-white/60">
                            Sent with intention. Yours to use however you need.
                          </p>
                          <motion.div
                            animate={{ opacity: balanceRevealPhase === "revealed" ? 1 : 0 }}
                            transition={{ duration: 0.5, delay: balanceRevealPhase === "revealed" ? 0.6 : 0 }}
                          >
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
                          </motion.div>
                        </div>
                      </div>
                    ) : (
                      /* Standard card for all other experiences */
                      <div
                        className="w-full rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-10 md:p-14 text-center relative overflow-hidden"
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
                          <h3 className="text-base sm:text-xl md:text-2xl font-medium opacity-90 mb-4 sm:mb-6">You received</h3>

                          {/* Dramatic amount reveal */}
                          <div className="relative flex items-center justify-center mb-5 sm:mb-8">
                            {balanceRevealPhase === "building" && (
                              <>
                                <motion.div
                                  className="absolute w-40 h-40 rounded-full border-2 border-white/40"
                                  animate={{ scale: [1, 1.35, 1], opacity: [0.6, 0.15, 0.6] }}
                                  transition={{ repeat: Infinity, duration: 1.0, ease: "easeInOut" }}
                                />
                                <motion.div
                                  className="absolute w-56 h-56 rounded-full border border-white/20"
                                  animate={{ scale: [1, 1.25, 1], opacity: [0.4, 0.1, 0.4] }}
                                  transition={{ repeat: Infinity, duration: 1.0, ease: "easeInOut", delay: 0.2 }}
                                />
                                {CONVERGE_PARTICLES.map((p, i) => (
                                  <motion.div
                                    key={i}
                                    className="absolute w-2 h-2 rounded-full bg-white/80"
                                    initial={{ x: p.x, y: p.y, opacity: 0, scale: 1.2 }}
                                    animate={{ x: 0, y: 0, opacity: [0, 0.9, 0], scale: 0.2 }}
                                    transition={{ duration: 1.0, ease: "easeIn", delay: i * 0.08 }}
                                  />
                                ))}
                              </>
                            )}
                            <AnimatePresence mode="wait">
                              {balanceRevealPhase !== "revealed" ? (
                                <motion.div
                                  key="placeholder"
                                  className="font-serif text-5xl sm:text-6xl md:text-9xl tracking-tighter"
                                  style={{ filter: "blur(12px)", opacity: 0.25 }}
                                  exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
                                >
                                  $?
                                </motion.div>
                              ) : (
                                <motion.div
                                  key="amount"
                                  className="font-serif text-5xl sm:text-6xl md:text-9xl tracking-tighter"
                                  initial={reducedMotion ? { opacity: 0 } : { scale: 0.7, filter: "blur(20px)", opacity: 0 }}
                                  animate={reducedMotion ? { opacity: 1 } : { scale: [0.7, 1.06, 1.0], filter: "blur(0px)", opacity: 1 }}
                                  transition={reducedMotion ? { duration: 0.4 } : { type: "spring", stiffness: 260, damping: 20, duration: 0.7 }}
                                >
                                  ${cfg.amountStyle === "count-up" ? formatAmt(String(countedAmount)) : formatAmt(giftAmount)}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>

                          <p className="text-sm sm:text-base opacity-80 mb-5 sm:mb-8 max-w-md mx-auto">
                            Sent with intention. Yours to use however you need.
                          </p>
                          <motion.div
                            animate={{ opacity: balanceRevealPhase === "revealed" ? 1 : 0 }}
                            transition={{ duration: 0.5, delay: balanceRevealPhase === "revealed" ? 0.6 : 0 }}
                          >
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
                          </motion.div>
                        </div>
                      </div>
                    )}
                  </Section>
                </div>
              )}

            </div>

            {/* Package tracking timeline — only shown when tracking info exists */}
            {trackingData && (
              <div className="max-w-4xl mx-auto px-4 sm:px-6 mt-8">
                <Section cfg={cfg} idx={99}>
                  <TrackingTimeline
                    carrier={trackingData.carrier}
                    trackingNumber={trackingData.trackingNumber}
                    events={trackingData.events}
                    deliveredAt={trackingData.deliveredAt}
                    cfg={cfg}
                    isDark={isDark}
                  />
                </Section>
              </div>
            )}

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
                        className={`text-xs underline underline-offset-2 ${isDark ? "text-white/30 hover:text-white/50" : "text-muted-foreground/50 hover:text-muted-foreground"} transition-colors`}
                      >
                        Skip
                      </button>
                    </>
                  )}
                </motion.div>
              </div>
            )}

            {/* Viral CTA — shown on real gift links only, not sender preview */}
            {!isPreview && <div className="max-w-4xl mx-auto px-4 sm:px-6 mt-20 mb-8">
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
                  Build a moment in minutes — a personal note, video, photos, and a cash balance they can actually use.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    const keys = [
                      "gifted_recipient_name", "gifted_sender_name", "gifted_recipient_phone",
                      "gifted_occasion", "gifted_gift_title", "gifted_personal_note",
                      "gifted_extra_links", "gifted_playlist_url", "gifted_amount",
                      "gifted_intent", "gifted_experience", "gifted_video_path",
                      "gifted_photo_paths", "gifted_gift_id", "gifted_gift_paid",
                      "gifted_scheduled_for", "gifted_scheduled_time",
                      "gifted_tracking_carrier", "gifted_tracking_number",
                    ];
                    keys.forEach(k => localStorage.removeItem(k));
                    navigate("/create");
                  }}
                  className={`inline-flex items-center gap-2 px-7 py-3.5 rounded-full text-sm font-semibold transition-all hover:-translate-y-0.5 ${
                    isDark
                      ? "bg-white text-black hover:bg-white/90"
                      : "bg-foreground text-background hover:bg-foreground/90"
                  }`}
                >
                  Build a moment <Sparkles className="w-4 h-4" />
                </button>
              </div>
            </div>}

          </motion.div>
        )}
      </AnimatePresence>

      {/* Sender preview bar — slides up from bottom after 1s, stays throughout the experience */}
      {isPreview && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 1, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="fixed bottom-0 left-0 right-0 z-[60] flex justify-center pb-4 px-4 pointer-events-none"
        >
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl pointer-events-auto max-w-full"
            style={{
              background: "rgba(10, 10, 14, 0.88)",
              backdropFilter: "blur(20px) saturate(1.4)",
              border: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
            <span className="text-xs font-medium text-white/70 whitespace-nowrap">
              Previewing as <span className="text-white font-semibold">{recipientName}</span> will see it
            </span>
            <div className="w-px h-4 bg-white/15 shrink-0" />
            <button
              type="button"
              onClick={async () => {
                const url = new URL(window.location.href);
                url.searchParams.delete("preview");
                await navigator.clipboard.writeText(url.toString());
                setPreviewBarCopied(true);
                setTimeout(() => setPreviewBarCopied(false), 2000);
              }}
              className="flex items-center gap-1.5 text-xs font-semibold text-white/80 hover:text-white transition-colors whitespace-nowrap"
            >
              {previewBarCopied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
              {previewBarCopied ? "Copied!" : "Copy link"}
            </button>
            <div className="w-px h-4 bg-white/15 shrink-0" />
            <Link
              href="/my-gifts"
              className="text-xs font-semibold text-white/80 hover:text-white transition-colors whitespace-nowrap"
            >
              Dashboard
            </Link>
          </div>
        </motion.div>
      )}

      {/* Photo lightbox — carousel-capable */}
      <AnimatePresence>
        {lightboxIdx !== null && photoUrls.length > 0 && (
          <LightboxCarousel
            photoUrls={photoUrls}
            initialIdx={lightboxIdx}
            onClose={() => setLightboxIdx(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
