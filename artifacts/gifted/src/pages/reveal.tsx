import React, { useState, useEffect, useRef, useMemo } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence, useInView } from "framer-motion";
import confetti from "canvas-confetti";
import { Button } from "@/components/ui/button";
import { Play, Sparkles, Gift, Star, Heart, Snowflake, Sun, Flower2, Music, ExternalLink } from "lucide-react";
import { mockGiftData } from "@/lib/mock-data";
import { gradientStyle, DEFAULT_EXPERIENCE } from "@/lib/experiences";

// ─── Experience configs ──────────────────────────────────────────────────────

type TitleStyle    = "word-burst" | "blur-in" | "bloom" | "typewriter" | "elegant-fade" | "crisp-fall" | "rise";
type SectionStyle  = "spring-pop" | "fade-drift" | "bloom-scale" | "materialize" | "slide-alternate" | "fall-in" | "rise-stagger";
type AmountStyle   = "count-up" | "glow-reveal" | "bloom-pop" | "stellar-reveal" | "elegant-reveal" | "crystallize" | "warm-reveal";
type AmbientEffect = "petals" | "rose-petals" | "snow" | "stars";
type PreIconAnim   = "bounce" | "pulse-slow" | "float" | "twinkle" | "heartbeat" | "spin-slow" | "rise";

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
  preIconAnim: PreIconAnim;
  preIconColorClass: string;
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
    preIconAnim: "float",
    preIconColorClass: "text-pink-400",
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
    preIconAnim: "twinkle",
    preIconColorClass: "text-indigo-300",
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
    preIconAnim: "heartbeat",
    preIconColorClass: "text-rose-400",
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
    preIconAnim: "spin-slow",
    preIconColorClass: "text-sky-400",
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
        setVal(Math.round(eased * target));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, delay);
    return () => clearTimeout(t);
  }, [enabled, target, duration, delay]);
  return val;
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
};

const PARTICLE_CFGS: Partial<Record<AmbientEffect, ParticleCfg>> = {
  petals: {
    colors: ["#FFB7C5", "#C7CEEA", "#B5EAD7", "#FFFFFF", "#E8D5E0", "#D4F0E7"],
    sizes: [8, 18],
    batchSize: 6,
    batchInterval: 1100,
    duration: [4000, 7000],
    keyframe: "gifted-petal-fall",
  },
  "rose-petals": {
    colors: ["#FFB7C5", "#FF8FAB", "#E8A7B1", "#FFC0CB", "#FFFFFF"],
    sizes: [14, 26],
    batchSize: 4,
    batchInterval: 1400,
    duration: [4500, 8000],
    keyframe: "gifted-petal-fall",
  },
  snow: {
    colors: ["#FFFFFF", "#E8F4FD", "#BDE0FE", "#E0EFFF"],
    sizes: [5, 13],
    batchSize: 12,
    batchInterval: 600,
    duration: [3000, 6500],
    keyframe: "gifted-snow-fall",
    shape: "circle",
  },
};

function startAmbientParticles(effect: AmbientEffect): () => void {
  if (effect === "stars") return () => {};
  const cfg = PARTICLE_CFGS[effect];
  if (!cfg) return () => {};

  injectParticleStyles();
  const container = document.createElement("div");
  container.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:200;overflow:hidden;";
  document.body.appendChild(container);

  let active = true;

  function spawnBatch() {
    if (!active) return;
    for (let i = 0; i < cfg.batchSize; i++) {
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
      }, Math.random() * cfg.batchInterval);
    }
  }

  spawnBatch();
  const iv = setInterval(spawnBatch, cfg.batchInterval + 200);

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

// ─── Main component ───────────────────────────────────────────────────────────

export default function RevealPage() {
  const [isOpen, setIsOpen]               = useState(false);
  const [videoUrl, setVideoUrl]           = useState<string | null>(null);
  const [videoError, setVideoError]       = useState(false);
  const videoRef                          = useRef<HTMLVideoElement>(null);
  const [photoUrls, setPhotoUrls]         = useState<string[]>([]);
  const [personalNote, setPersonalNote]   = useState<string | null>(null);
  const [playlistUrl, setPlaylistUrl]     = useState<string | null>(null);
  const [experience, setExperience]       = useState(DEFAULT_EXPERIENCE);

  const amountRef  = useRef<HTMLDivElement>(null);
  const amountInView = useInView(amountRef, { once: true });

  const cfg = CONFIGS[experience] ?? CONFIGS[DEFAULT_EXPERIENCE];

  const countedAmount = useCountUp(
    Number(mockGiftData.amount),
    1600,
    300,
    cfg.amountStyle === "count-up" && amountInView,
  );

  useEffect(() => {
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    const vp = localStorage.getItem("gifted_video_path");
    if (vp) setVideoUrl(`${base}/api/storage${vp}`);

    const pp = localStorage.getItem("gifted_photo_paths");
    if (pp) {
      try {
        const paths: string[] = JSON.parse(pp);
        setPhotoUrls(paths.map(p => `${base}/api/storage${p}`));
      } catch { /* ignore */ }
    }

    const pn = localStorage.getItem("gifted_personal_note");
    if (pn) setPersonalNote(pn);

    const pl = localStorage.getItem("gifted_playlist_url");
    if (pl) setPlaylistUrl(pl);

    const stored = localStorage.getItem("gifted_experience");
    if (stored && CONFIGS[stored]) setExperience(stored);
  }, []);

  useEffect(() => {
    document.body.style.overflow = isOpen ? "auto" : "hidden";
    return () => { document.body.style.overflow = "auto"; };
  }, [isOpen]);

  // Cleanup ref for ambient particles
  const ambientCleanup = useRef<(() => void) | null>(null);

  const handleOpen = () => {
    setIsOpen(true);
    fireEntryBurst(experience);
    if (cfg.ambientEffect && cfg.ambientEffect !== "stars") {
      ambientCleanup.current = startAmbientParticles(cfg.ambientEffect);
    }
  };

  useEffect(() => {
    return () => { ambientCleanup.current?.(); };
  }, []);

  const gStyle = gradientStyle(experience);
  const PreIcon = PRE_ICONS[experience] ?? Gift;
  const iconProps = preIconMotionProps(cfg.preIconAnim);
  const isDark = cfg.isDark;

  const displayPhotos = photoUrls.length > 0 ? photoUrls : [
    "https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37?w=800&fit=crop",
    "https://images.unsplash.com/photo-1511895426328-dc8714191300?w=800&fit=crop",
    "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=800&fit=crop",
  ];

  // ── Page-level style override for dark themes
  const pageStyle: React.CSSProperties = isDark
    ? { backgroundColor: "#0c0a1e", color: "white" }
    : {};

  return (
    <div className="w-full min-h-screen relative" style={pageStyle}>

      {/* Midnight Stars starfield */}
      {isOpen && isDark && <StarfieldBg />}

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
            {/* Background gradient glow */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-50">
              <div className="w-full h-full blur-3xl" style={gStyle} />
            </div>

            <motion.div
              initial={{ scale: 0.88, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
              className="relative z-10 flex flex-col items-center text-center"
            >
              {/* Animated icon */}
              <div className="relative mb-8">
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
              </div>

              <p className={`text-base font-medium mb-2 ${isDark ? "text-white/60" : "text-muted-foreground"}`}>
                A gift for
              </p>
              <h1 className={`font-serif text-5xl sm:text-6xl md:text-7xl mb-10 break-words max-w-xs sm:max-w-sm ${isDark ? "text-white" : ""}`}>
                {mockGiftData.recipientName}
              </h1>

              <Button
                onClick={handleOpen}
                size="lg"
                className="rounded-full h-16 px-10 sm:px-14 text-xl w-full max-w-xs shadow-2xl shadow-primary/30 hover:scale-105 transition-all duration-300"
                style={isDark ? { background: "rgba(255,255,255,0.12)", color: "white", border: "1px solid rgba(255,255,255,0.2)" } : {}}
              >
                {experience === "midnight-stars" ? "Reveal" : experience === "snow-flurry" ? "Open" : "Tap to open"}
              </Button>

              <p className={`mt-5 text-xs tracking-widest uppercase ${isDark ? "text-white/30" : "text-muted-foreground/50"}`}>
                scroll to explore
              </p>
            </motion.div>
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
                      <WordBurstTitle text={mockGiftData.title} delayS={cfg.heroDelay} />
                    )}
                    {cfg.titleStyle === "typewriter" && (
                      <TypewriterText text={mockGiftData.title} delayS={cfg.heroDelay + 0.2} speed={65} />
                    )}
                    {cfg.titleStyle === "blur-in" && (
                      <motion.span
                        initial={{ filter: "blur(22px)", opacity: 0 }}
                        animate={{ filter: "blur(0px)", opacity: 1 }}
                        transition={{ delay: cfg.heroDelay + 0.1, duration: cfg.heroDuration + 0.1 }}
                        style={{ display: "inline-block" }}
                      >
                        {mockGiftData.title}
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
                        {mockGiftData.title}
                      </motion.span>
                    )}
                  </h1>

                  <p className={`text-xl ${isDark ? "text-white/60" : "text-muted-foreground"}`}>
                    {cfg.senderText} {mockGiftData.senderName}
                  </p>
                </motion.div>
              </div>
            </div>

            {/* Content sections */}
            <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-8 md:space-y-14 -mt-4 md:-mt-6 relative z-20">

              {/* Note / message — section 0 (hidden when no note) */}
              {personalNote && (
                <Section cfg={cfg} idx={0}>
                  <div
                    className="rounded-[2rem] p-6 md:p-12 border shadow-xl"
                    style={isDark
                      ? { background: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.12)" }
                      : { background: "hsl(var(--card)/0.8)", backdropFilter: "blur(20px)", borderColor: "rgba(255,255,255,0.2)" }
                    }
                  >
                    {cfg.titleStyle === "typewriter" ? (
                      <p className={`font-serif text-lg sm:text-xl md:text-3xl leading-relaxed text-center ${isDark ? "text-white/90" : "text-foreground"}`}>
                        &ldquo;<TypewriterText text={personalNote} delayS={cfg.sectionInitialDelay + 0.3} speed={28} />&rdquo;
                      </p>
                    ) : (
                      <p className={`font-serif text-lg sm:text-xl md:text-3xl leading-relaxed text-center ${isDark ? "text-white/90" : "text-foreground"}`}>
                        &ldquo;{personalNote}&rdquo;
                      </p>
                    )}
                  </div>
                </Section>
              )}

              {/* Video — section 1 */}
              <Section cfg={cfg} idx={1}>
                {videoUrl ? (
                  <div className="w-full rounded-[2rem] overflow-hidden border" style={isDark ? { borderColor: "rgba(255,255,255,0.1)" } : {}}>
                    <div className="w-full aspect-video relative group">
                      <video
                        ref={videoRef}
                        src={videoUrl}
                        preload="metadata"
                        playsInline
                        controls
                        className="w-full h-full object-cover"
                        onError={() => setVideoError(true)}
                      />
                      {videoError && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                          <p className={`text-sm font-medium ${isDark ? "text-white/60" : "text-muted-foreground"}`}>
                            Video couldn't be loaded
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="w-full aspect-video rounded-[2rem] overflow-hidden relative" style={isDark ? { background: "rgba(255,255,255,0.06)" } : { background: "hsl(var(--secondary))" }}>
                    <img
                      src="https://images.unsplash.com/photo-1516627145497-ae6968895b74?w=1200&h=800&fit=crop"
                      alt="Memory"
                      className="w-full h-full object-cover opacity-60"
                    />
                  </div>
                )}
              </Section>

              {/* Photos — section 2 */}
              <Section cfg={cfg} idx={2}>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {displayPhotos.map((url, i) => (
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
                      className={`rounded-3xl overflow-hidden aspect-square ${i === 0 ? "md:col-span-2 md:aspect-[2/1]" : ""}`}
                      style={isDark ? { background: "rgba(255,255,255,0.06)" } : { background: "hsl(var(--secondary))" }}
                    >
                      <img src={url} alt="Memory" className="w-full h-full object-cover" />
                    </motion.div>
                  ))}
                </div>
              </Section>

              {/* Playlist — between photos and balance */}
              {playlistUrl && (
                <Section cfg={cfg} idx={2}>
                  <a
                    href={playlistUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-[2rem] p-5 border transition-all hover:scale-[1.01] active:scale-[0.99]"
                    style={isDark
                      ? { background: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.12)" }
                      : { background: "hsl(var(--card)/0.8)", backdropFilter: "blur(20px)", borderColor: "rgba(255,255,255,0.2)" }
                    }
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
                        style={isDark
                          ? { background: "rgba(255,255,255,0.1)" }
                          : { background: "hsl(var(--primary)/0.1)" }
                        }
                      >
                        <Music className={`w-6 h-6 ${isDark ? "text-white/80" : "text-primary"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-semibold text-base ${isDark ? "text-white" : "text-foreground"}`}>
                          {playlistUrl.includes("spotify") ? "Spotify Playlist" : playlistUrl.includes("apple") ? "Apple Music Playlist" : "Playlist"}
                        </p>
                        <p className={`text-sm truncate ${isDark ? "text-white/50" : "text-muted-foreground"}`}>
                          Curated just for you
                        </p>
                      </div>
                      <ExternalLink className={`w-5 h-5 flex-shrink-0 ${isDark ? "text-white/40" : "text-muted-foreground"}`} />
                    </div>
                  </a>
                </Section>
              )}

              {/* Balance — section 3 */}
              <div ref={amountRef}>
                <Section cfg={cfg} idx={3}>
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
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6 text-sm font-medium" style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.85)" }}>
                          <Sparkles className="w-4 h-4" />
                          <span>{mockGiftData.intent}</span>
                        </div>
                        <h3 className="text-xl md:text-2xl font-medium mb-2 text-white/80">You received</h3>
                        <motion.div
                          initial={{ opacity: 0, filter: "blur(16px)", scale: 0.9 }}
                          whileInView={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
                          viewport={{ once: true }}
                          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                          className="font-serif text-6xl md:text-9xl mb-8 tracking-tighter text-white"
                          style={{ textShadow: "0 0 40px rgba(180,160,255,0.5)" }}
                        >
                          ${mockGiftData.amount}
                        </motion.div>
                        <p className="text-lg mb-10 max-w-md mx-auto text-white/60">
                          Sent with intention. Yours to use however you need.
                        </p>
                        <Link href="/redeem">
                          <Button size="lg" className="rounded-full h-16 px-10 text-xl shadow-xl hover:-translate-y-1 transition-all w-full sm:w-auto" style={{ background: "rgba(255,255,255,0.12)", color: "white", border: "1px solid rgba(255,255,255,0.25)" }}>
                            Redeem your balance
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ) : (
                    /* Standard card for all other experiences */
                    <div
                      className="w-full rounded-[2.5rem] p-10 md:p-16 text-center relative overflow-hidden shadow-2xl shadow-primary/20"
                      style={
                        cfg.amountStyle === "glow-reveal"
                          ? {
                              background: "linear-gradient(135deg, hsl(28,62%,36%), hsl(28,68%,44%))",
                              boxShadow: "0 0 80px rgba(180,110,40,0.35), 0 25px 50px rgba(180,110,40,0.2)",
                              color: "white",
                            }
                          : { background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }
                      }
                    >
                      <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
                      {cfg.amountStyle === "glow-reveal" && (
                        <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full blur-3xl" style={{ background: "rgba(255,200,80,0.15)" }} />
                      )}

                      <div className="relative z-10 flex flex-col items-center">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 backdrop-blur-sm mb-6 text-sm font-medium">
                          <Sparkles className="w-4 h-4" />
                          <span>{mockGiftData.intent}</span>
                        </div>
                        <h3 className="text-xl md:text-2xl font-medium opacity-90 mb-2">You received</h3>
                        <div className="font-serif text-6xl md:text-9xl mb-8 tracking-tighter">
                          {cfg.amountStyle === "count-up" ? (
                            <motion.span
                              initial={{ scale: 0.8, opacity: 0 }}
                              whileInView={{ scale: 1, opacity: 1 }}
                              viewport={{ once: true }}
                              transition={{ type: "spring", stiffness: 300, damping: 20 }}
                            >
                              ${countedAmount}
                            </motion.span>
                          ) : cfg.amountStyle === "crystallize" ? (
                            <motion.span
                              initial={{ filter: "blur(18px)", opacity: 0 }}
                              whileInView={{ filter: "blur(0px)", opacity: 1 }}
                              viewport={{ once: true }}
                              transition={{ duration: 1.0 }}
                              style={{ display: "inline-block" }}
                            >
                              ${mockGiftData.amount}
                            </motion.span>
                          ) : cfg.amountStyle === "bloom-pop" ? (
                            <motion.span
                              initial={{ scale: 0.6, opacity: 0 }}
                              whileInView={{ scale: 1, opacity: 1 }}
                              viewport={{ once: true }}
                              transition={{ type: "spring", stiffness: 240, damping: 18 }}
                              style={{ display: "inline-block" }}
                            >
                              ${mockGiftData.amount}
                            </motion.span>
                          ) : (
                            <motion.span
                              initial={{ y: 20, opacity: 0 }}
                              whileInView={{ y: 0, opacity: 1 }}
                              viewport={{ once: true }}
                              transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
                              style={{ display: "inline-block" }}
                            >
                              ${mockGiftData.amount}
                            </motion.span>
                          )}
                        </div>
                        <p className="text-lg opacity-80 mb-10 max-w-md mx-auto">
                          Sent with intention. Yours to use however you need.
                        </p>
                        <Link href="/redeem">
                          <Button size="lg" className="rounded-full h-16 px-10 text-xl bg-white text-primary hover:bg-white/90 shadow-xl hover:-translate-y-1 transition-all w-full sm:w-auto">
                            Redeem your balance
                          </Button>
                        </Link>
                      </div>
                    </div>
                  )}
                </Section>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
