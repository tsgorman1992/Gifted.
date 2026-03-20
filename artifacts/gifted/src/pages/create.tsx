import React, { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowRight, ArrowLeft, Video, Music, Image as ImageIcon,
  DollarSign, Sparkles, RefreshCw, Loader2, X, CheckCircle2,
  Plus, Gift, Star, Heart, Snowflake, Sun, Flower2, Calendar, Clock, AlertCircle, Link2, RotateCcw,
} from "lucide-react";
import { useUpload } from "@workspace/object-storage-web";
import { touchGiftSession } from "@/lib/session";

import {
  EXPERIENCE_LIST,
  DEFAULT_EXPERIENCE,
  getSuggestedExperience,
  type ExperienceId,
  type ExperienceMeta,
} from "@/lib/experiences";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PhotoItem {
  id: string;
  objectPath: string;
  previewUrl: string;
}

interface PhotoUploadingItem {
  id: string;
  progress: number;
  localPreview: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const EXPERIENCE_ICONS: Record<ExperienceId, React.ComponentType<{ className?: string }>> = {
  "confetti-burst": Gift,
  "golden-hour":    Sparkles,
  "garden-bloom":   Flower2,
  "midnight-stars": Star,
  "rose-petal":     Heart,
  "snow-flurry":    Snowflake,
  "sunrise":        Sun,
};

const INTENT_MAP: Record<string, string[]> = {
  "Birthday":     ["Treat yourself", "Night out", "That thing you've been eyeing", "Weekend away", "Birthday dinner"],
  "Anniversary":  ["Date night", "Weekend getaway", "Something special", "Just for you", "Our tradition"],
  "Graduation":   ["First apartment fund", "Travel before life gets busy", "New chapter, your choice", "Celebrate yourself", "Next adventure"],
  "New Baby":     ["Baby essentials", "Coffee & survival", "Self-care, seriously", "Family day out", "Nesting fund"],
  "Holiday":      ["Holiday treat", "Something you need", "Festive dinner", "Your wishlist", "Cozy night in"],
  "Just Because": ["Coffee on me", "Treat yourself", "No reason needed", "Just a little something", "Because I could"],
  "Wedding":      ["Honeymoon fund", "First home together", "Date nights ahead", "Something special", "New adventure"],
  "Thank You":    ["Coffee on me", "Lunch on me", "A small thank you", "Treat yourself", "You deserve it"],
  "Other":        ["Treat yourself", "Coffee on me", "Something special", "Your choice", "Take a break"],
};
const DEFAULT_INTENTS = ["Coffee on me", "Treat yourself", "Date night", "Something special", "Take a break"];
const ALL_PRESET_INTENTS = new Set(Object.values(INTENT_MAP).flat());
const AMOUNTS = ["10", "25", "50", "100", "250"];
const OCCASIONS = ["Birthday", "Anniversary", "Graduation", "New Baby", "Holiday", "Just Because", "Wedding", "Thank You", "Other"];

const MAX_PHOTOS = 6;
const MAX_PHOTO_SIZE = 20 * 1024 * 1024;
const ACCEPTED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];

const LINK_IDEAS = [
  "Spotify playlist...",
  "Concert tickets...",
  "Dinner reservation...",
  "A song you love...",
  "Airbnb stay...",
  "Movie tickets...",
  "OpenTable booking...",
  "Apple Music mix...",
  "Event link...",
  "Podcast episode...",
  "YouTube video...",
  "SoundCloud track...",
  "Anything with a URL...",
];

// ─── Phone formatting ─────────────────────────────────────────────────────────

function formatPhoneNumber(value: string): string {
  // Strip everything non-digit
  let digits = value.replace(/\D/g, "");
  // If they pasted a +1 US number (11 digits starting with 1), strip the country code
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  // Cap at 10 digits
  digits = digits.slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

// ─── AI note streaming ────────────────────────────────────────────────────────

async function streamAINote(
  payload: {
    currentNote?: string;
    occasion: string;
    recipientName: string;
    senderName: string;
    intent?: string;
    giftTitle?: string;
    mode: "rewrite" | "regenerate";
  },
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (msg: string) => void
) {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const response = await fetch(`${base}/api/gifted/rewrite-note`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok || !response.body) { onError("Request failed"); return; }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          const parsed = JSON.parse(line.slice(6));
          if (parsed.content) onChunk(parsed.content);
          if (parsed.done) onDone();
          if (parsed.error) onError(parsed.error);
        } catch { /* ignore */ }
      }
    }
  }
}

// ─── Step variants ────────────────────────────────────────────────────────────

const stepVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 48 : -48, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -48 : 48, opacity: 0 }),
};

// ─── Progress indicator ───────────────────────────────────────────────────────

const STEP_LABELS = ["Set the scene", "Write the moment", "Complete the gift"];

function ProgressBar({ step, onStepClick }: { step: number; onStepClick: (s: number) => void }) {
  return (
    <div className="mb-10">
      <div className="flex items-center gap-0 mb-3">
        {STEP_LABELS.map((label, i) => {
          const stepNum = i + 1;
          const isActive = stepNum === step;
          const isDone = stepNum < step;
          const isClickable = isDone;
          return (
            <React.Fragment key={i}>
              <div className="flex flex-col items-center gap-1.5">
                <button
                  type="button"
                  disabled={!isClickable}
                  onClick={() => isClickable && onStepClick(stepNum)}
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-500 ${
                    isDone
                      ? "bg-primary text-primary-foreground cursor-pointer hover:opacity-80 hover:scale-110"
                      : isActive
                      ? "bg-primary text-primary-foreground ring-4 ring-primary/20 cursor-default"
                      : "bg-border text-muted-foreground cursor-default"
                  }`}
                >
                  {isDone ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    stepNum
                  )}
                </button>
                <span
                  className={`text-[11px] font-medium hidden sm:block transition-colors duration-300 ${
                    isActive ? "text-foreground" : isDone ? "text-muted-foreground hover:text-foreground cursor-pointer" : "text-muted-foreground"
                  }`}
                  onClick={() => isClickable && onStepClick(stepNum)}
                >
                  {label}
                </span>
              </div>
              {i < STEP_LABELS.length - 1 && (
                <div className="flex-1 mx-2 mb-4">
                  <div className="h-px bg-border relative overflow-hidden">
                    <motion.div
                      className="absolute inset-y-0 left-0 bg-primary"
                      initial={{ width: 0 }}
                      animate={{ width: isDone ? "100%" : "0%" }}
                      transition={{ duration: 0.5, ease: "easeInOut" }}
                    />
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

// ─── Ambient particle helpers (lightweight version for preview card) ──────────

type AmbientParticleEffect = "petals" | "rose-petals" | "snow" | "confetti" | "stars" | "bokeh";

function getAmbientEffect(experienceId: string): AmbientParticleEffect | null {
  switch (experienceId) {
    case "garden-bloom":   return "petals";
    case "rose-petal":     return "rose-petals";
    case "snow-flurry":    return "snow";
    case "confetti-burst": return "confetti";
    case "midnight-stars": return "stars";
    case "golden-hour":    return "bokeh";
    case "sunrise":        return "bokeh";
    default:               return null;
  }
}

function getPreIconMotion(experienceId: string) {
  switch (experienceId) {
    case "garden-bloom":
      return { animate: { y: [0, -8, 0], rotate: [0, 6, -6, 0] }, transition: { repeat: Infinity, duration: 3, ease: "easeInOut" } };
    case "midnight-stars":
      return { animate: { opacity: [0.3, 1, 0.3], scale: [0.92, 1.08, 0.92] }, transition: { repeat: Infinity, duration: 1.8, ease: "easeInOut" } };
    case "rose-petal":
      return { animate: { scale: [1, 1.22, 1, 1.12, 1] }, transition: { repeat: Infinity, duration: 1.2, ease: "easeInOut" } };
    case "snow-flurry":
      return { animate: { rotate: 360 }, transition: { repeat: Infinity, duration: 4, ease: "linear" } };
    case "golden-hour":
      return { animate: { scale: [1, 1.12, 1], opacity: [0.8, 1, 0.8] }, transition: { repeat: Infinity, duration: 2.4, ease: "easeInOut" } };
    case "sunrise":
      return { animate: { y: [0, -6, 0], scale: [1, 1.06, 1] }, transition: { repeat: Infinity, duration: 2.8, ease: "easeInOut" } };
    case "confetti-burst":
    default:
      return { animate: { y: [0, -12, 0] }, transition: { repeat: Infinity, duration: 0.9, ease: "easeInOut" } };
  }
}

function AmbientParticles({ experienceId }: { experienceId: string }) {
  const effect = getAmbientEffect(experienceId);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let active = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let intervalId: ReturnType<typeof setInterval> | null = null;

    function spawnParticle() {
      if (!active || !container) return;

      const el = document.createElement("div");
      el.style.position = "absolute";
      el.style.pointerEvents = "none";
      el.style.zIndex = "10";

      if (effect === "petals" || effect === "rose-petals") {
        const colors = effect === "rose-petals"
          ? ["#FFB7C5", "#FF8FAB", "#E8A7B1", "#FFC0CB", "#fda4af"]
          : ["#FFB7C5", "#C7CEEA", "#B5EAD7", "#FFFFFF", "#E8D5E0"];
        const size = effect === "rose-petals" ? 10 + Math.random() * 14 : 7 + Math.random() * 10;
        const dur = 3000 + Math.random() * 3000;
        const drift = (Math.random() - 0.5) * 60;
        const color = colors[Math.floor(Math.random() * colors.length)];
        el.style.cssText = `
          position:absolute; pointer-events:none; z-index:10;
          left:${Math.random() * 100}%;
          top:-8%;
          width:${size}px; height:${size * 0.7}px;
          background:${color};
          border-radius:50% 50% 50% 50% / 60% 60% 40% 40%;
          opacity:${0.5 + Math.random() * 0.5};
          animation:none;
          transition:none;
        `;
        container.appendChild(el);
        const startTime = Date.now();
        const spin = Math.random() * 360;
        function frame() {
          if (!active) return;
          const t = (Date.now() - startTime) / dur;
          if (t >= 1) { el.remove(); return; }
          const y = t * 108;
          const x = drift * Math.sin(t * Math.PI * 2);
          const rot = spin * t;
          el.style.transform = `translateY(${y}%) translateX(${x}px) rotate(${rot}deg)`;
          el.style.opacity = String(t > 0.8 ? (1 - t) * 5 * (0.5 + Math.random() * 0.5) : (0.5 + Math.random() * 0.5));
          requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
      } else if (effect === "snow") {
        const colors = ["#FFFFFF", "#E8F4FD", "#BDE0FE"];
        const size = 3 + Math.random() * 8;
        const dur = 2500 + Math.random() * 3500;
        const drift = (Math.random() - 0.5) * 40;
        const color = colors[Math.floor(Math.random() * colors.length)];
        el.style.cssText = `
          position:absolute; pointer-events:none; z-index:10;
          left:${Math.random() * 100}%;
          top:-5%;
          width:${size}px; height:${size}px;
          background:${color};
          border-radius:50%;
          opacity:${0.5 + Math.random() * 0.4};
        `;
        container.appendChild(el);
        const startTime = Date.now();
        function frame() {
          if (!active) return;
          const t = (Date.now() - startTime) / dur;
          if (t >= 1) { el.remove(); return; }
          const y = t * 108;
          const x = drift * t;
          el.style.transform = `translateY(${y}%) translateX(${x}px)`;
          el.style.opacity = String(t > 0.85 ? (1 - t) * 6.7 * 0.9 : 0.7 + Math.random() * 0.3);
          requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
      } else if (effect === "confetti") {
        const colors = ["#FF6B6B", "#FFD93D", "#6BCB77", "#4D96FF", "#FF9500", "#BF5AF2"];
        const size = 5 + Math.random() * 7;
        const dur = 2000 + Math.random() * 2000;
        const drift = (Math.random() - 0.5) * 50;
        const spin = Math.random() * 720 - 360;
        const color = colors[Math.floor(Math.random() * colors.length)];
        const isRect = Math.random() > 0.5;
        el.style.cssText = `
          position:absolute; pointer-events:none; z-index:10;
          left:${Math.random() * 100}%;
          top:-5%;
          width:${size}px; height:${isRect ? size * 0.4 : size}px;
          background:${color};
          border-radius:${isRect ? "2px" : "50%"};
          opacity:${0.6 + Math.random() * 0.4};
        `;
        container.appendChild(el);
        const startTime = Date.now();
        function frame() {
          if (!active) return;
          const t = (Date.now() - startTime) / dur;
          if (t >= 1) { el.remove(); return; }
          const y = t * 108;
          const x = drift * t;
          const rot = spin * t;
          el.style.transform = `translateY(${y}%) translateX(${x}px) rotate(${rot}deg)`;
          el.style.opacity = String(t > 0.8 ? (1 - t) * 5 * 0.9 : 0.8 + Math.random() * 0.2);
          requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
      } else if (effect === "stars") {
        const size = 1.5 + Math.random() * 2.5;
        const posX = Math.random() * 100;
        const posY = Math.random() * 100;
        const dur = 1800 + Math.random() * 3000;
        el.style.cssText = `
          position:absolute; pointer-events:none; z-index:10;
          left:${posX}%; top:${posY}%;
          width:${size}px; height:${size}px;
          background:white;
          border-radius:50%;
        `;
        container.appendChild(el);
        const startTime = Date.now();
        function frame() {
          if (!active) return;
          const t = (Date.now() - startTime) / dur;
          if (t >= 1) { el.remove(); return; }
          const pulse = 0.2 + 0.8 * Math.abs(Math.sin(t * Math.PI * 2));
          el.style.opacity = String(pulse);
          el.style.transform = `scale(${0.7 + 0.6 * pulse})`;
          requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
        return;
      } else if (effect === "bokeh") {
        const isGolden = experienceId === "golden-hour";
        const size = 20 + Math.random() * 40;
        const posX = Math.random() * 100;
        const posY = Math.random() * 100;
        const dur = 5000 + Math.random() * 8000;
        const colors = isGolden
          ? ["rgba(247,197,130,0.25)", "rgba(232,168,80,0.18)", "rgba(255,215,0,0.15)"]
          : ["rgba(255,200,160,0.22)", "rgba(255,150,130,0.18)", "rgba(255,220,100,0.15)"];
        const color = colors[Math.floor(Math.random() * colors.length)];
        el.style.cssText = `
          position:absolute; pointer-events:none; z-index:10;
          left:${posX}%; top:${posY}%;
          width:${size}px; height:${size}px;
          background:radial-gradient(circle, ${color} 0%, transparent 70%);
          border-radius:50%;
          filter:blur(2px);
          transform:translate(-50%,-50%);
        `;
        container.appendChild(el);
        const startTime = Date.now();
        const startY = posY;
        function frame() {
          if (!active) return;
          const t = (Date.now() - startTime) / dur;
          if (t >= 1) { el.remove(); return; }
          const drift = -10 * Math.sin(t * Math.PI);
          el.style.transform = `translate(-50%, calc(-50% + ${drift}px))`;
          const opacity = Math.sin(t * Math.PI);
          el.style.opacity = String(Math.max(0, opacity * 0.9));
          requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
        return;
      }
    }

    if (!effect) return;

    const interval = effect === "stars" || effect === "bokeh" ? 600 :
                     effect === "snow" ? 200 :
                     effect === "confetti" ? 250 : 400;

    const batchSize = effect === "snow" ? 3 :
                      effect === "stars" || effect === "bokeh" ? 1 : 2;

    function spawnBatch() {
      for (let i = 0; i < batchSize; i++) {
        timers.push(setTimeout(spawnParticle, Math.random() * interval * 0.5));
      }
    }

    spawnBatch();
    intervalId = setInterval(spawnBatch, interval);

    return () => {
      active = false;
      if (intervalId) clearInterval(intervalId);
      timers.forEach(clearTimeout);
      setTimeout(() => {
        if (container) container.innerHTML = "";
      }, 3000);
    };
  }, [effect, experienceId]);

  if (!effect) return null;

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden pointer-events-none"
      style={{ borderRadius: "inherit" }}
    />
  );
}

// ─── Live preview card ────────────────────────────────────────────────────────

function PreviewCard({
  experience,
  recipientName,
}: {
  experience: ExperienceMeta;
  recipientName: string;
}) {
  const Icon = EXPERIENCE_ICONS[experience.id];
  const isDark = experience.isDark;

  const textColor = isDark ? "text-white" : "text-white";
  const mutedColor = isDark ? "text-white/50" : "text-white/70";

  const iconMotion = getPreIconMotion(experience.id);

  return (
    <div className="hidden lg:block w-64 flex-shrink-0">
      <div className="sticky top-8">
        <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-widest mb-3 text-center">
          Choose the mood
        </p>
        <AnimatePresence mode="wait">
          <motion.div
            key={experience.id}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="w-full rounded-[2rem] overflow-hidden shadow-2xl relative"
            style={{ aspectRatio: "9/16", background: `linear-gradient(155deg, ${experience.palette.from}, ${experience.palette.via}, ${experience.palette.to})` }}
          >
            {/* Ambient particles */}
            <AmbientParticles experienceId={experience.id} />

            {/* Soft pulsing gradient overlay */}
            <motion.div
              className="absolute inset-0 pointer-events-none"
              animate={{ opacity: [0.3, 0.55, 0.3] }}
              transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
              style={{
                background: isDark
                  ? "radial-gradient(ellipse at 50% 30%, rgba(255,255,255,0.08) 0%, transparent 70%)"
                  : "radial-gradient(ellipse at 50% 30%, rgba(255,255,255,0.25) 0%, transparent 70%)",
              }}
            />

            {/* Content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center px-5 text-center">
              {/* Floating icon */}
              <motion.div
                className="w-16 h-16 rounded-full flex items-center justify-center mb-5"
                style={{ background: "rgba(255,255,255,0.2)", backdropFilter: "blur(8px)" }}
              >
                <motion.div {...iconMotion}>
                  <Icon className={`w-8 h-8 ${isDark ? "text-indigo-200" : "text-white"}`} />
                </motion.div>
              </motion.div>

              {/* Experience name */}
              <p className={`text-xs font-semibold uppercase tracking-widest mb-1.5 ${mutedColor}`}>
                {experience.name}
              </p>
              <p className={`font-serif text-lg leading-tight mb-3 ${textColor}`} style={{ textShadow: "0 2px 16px rgba(0,0,0,0.18)" }}>
                {experience.tagline}
              </p>

              {/* Recipient name hint */}
              <AnimatePresence mode="wait">
                {recipientName ? (
                  <motion.div
                    key={recipientName}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.35 }}
                    className="mt-2"
                  >
                    <p className={`text-[11px] font-medium ${mutedColor} mb-0.5`}>A gift for</p>
                    <p className={`font-serif text-xl ${textColor}`} style={{ textShadow: "0 2px 12px rgba(0,0,0,0.18)" }}>
                      {recipientName}
                    </p>
                  </motion.div>
                ) : (
                  <motion.p
                    key="placeholder"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className={`text-[11px] mt-2 ${mutedColor}`}
                    style={{ fontStyle: "italic" }}
                  >
                    Enter a name above
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="mt-3 text-center">
          <p className="text-xs font-semibold text-foreground">{experience.name}</p>
          <p className="text-[11px] text-muted-foreground">{experience.tagline}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CreatePage() {
  const [, setLocation] = useLocation();

  // Step state
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);
  const [stepError, setStepError] = useState<string | null>(null);

  // Gift state
  const [selectedExperience, setSelectedExperience] = useState(() => getSuggestedExperience("Birthday"));
  const [suggestedExperience, setSuggestedExperience] = useState(() => getSuggestedExperience("Birthday"));
  const [hasManuallyChosen, setHasManuallyChosen] = useState(false);
  const [amount, setAmount] = useState("");
  const [intent, setIntent] = useState("");
  const [customIntentMode, setCustomIntentMode] = useState(false);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledFor, setScheduledFor] = useState("");
  const [scheduledTime, setScheduledTime] = useState("09:00");
  const [occasion, setOccasion] = useState("Birthday");
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [senderName, setSenderName] = useState("");
  const [giftTitle, setGiftTitle] = useState("");
  const [personalNote, setPersonalNote] = useState("");
  const [extraLinks, setExtraLinks] = useState<string[]>([""]);
  const [aiLoading, setAiLoading] = useState<"rewrite" | "regenerate" | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showAiGlow, setShowAiGlow] = useState(false);

  // Media state
  const [videoObjectPath, setVideoObjectPath] = useState<string | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const videoBlobUrlRef = useRef<string | null>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [photosUploading, setPhotosUploading] = useState<PhotoUploadingItem[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [videoError, setVideoError] = useState<string | null>(null);

  const currentExperience = EXPERIENCE_LIST.find((e) => e.id === selectedExperience) ?? EXPERIENCE_LIST[0];

  useEffect(() => {
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    // Mark session start so landing page can detect stale drafts
    touchGiftSession();

    const rn = localStorage.getItem("gifted_recipient_name");
    if (rn) setRecipientName(rn);
    const sn = localStorage.getItem("gifted_sender_name");
    if (sn) setSenderName(sn);
    const rp = localStorage.getItem("gifted_recipient_phone");
    if (rp) setRecipientPhone(formatPhoneNumber(rp));
    const occ = localStorage.getItem("gifted_occasion");
    if (occ) setOccasion(occ);
    const gt = localStorage.getItem("gifted_gift_title");
    if (gt) setGiftTitle(gt);
    const pn = localStorage.getItem("gifted_personal_note");
    if (pn) setPersonalNote(pn);
    const el = localStorage.getItem("gifted_extra_links");
    if (el) {
      try { const parsed = JSON.parse(el); if (Array.isArray(parsed) && parsed.length > 0) setExtraLinks([...parsed, ""]); } catch { /* ignore */ }
    } else {
      const pl = localStorage.getItem("gifted_playlist_url");
      if (pl) setExtraLinks([pl, ""]);
    }
    const amt = localStorage.getItem("gifted_amount");
    if (amt && parseFloat(amt) > 0) setAmount(amt);
    const int = localStorage.getItem("gifted_intent");
    if (int) {
      setIntent(int);
      if (!ALL_PRESET_INTENTS.has(int)) setCustomIntentMode(true);
    }
    const sf = localStorage.getItem("gifted_scheduled_for");
    if (sf) { setScheduledFor(sf); setScheduleEnabled(true); }
    const st = localStorage.getItem("gifted_scheduled_time");
    if (st) setScheduledTime(st);
    const exp = localStorage.getItem("gifted_experience");
    if (exp && EXPERIENCE_LIST.find(e => e.id === exp)) {
      setSelectedExperience(exp as ExperienceId);
      setSuggestedExperience(exp as ExperienceId);
      setHasManuallyChosen(true);
    }
    // Restore video from previous session — use a signed GCS URL for reliable playback
    const vp = localStorage.getItem("gifted_video_path");
    if (vp) {
      setVideoObjectPath(vp);
      fetch(`${base}/api/storage/object-url?path=${encodeURIComponent(vp)}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => setVideoPreviewUrl(d?.url ?? `${base}/api/storage${vp}`))
        .catch(() => setVideoPreviewUrl(`${base}/api/storage${vp}`));
    }
    // Restore photos from previous session
    const pp = localStorage.getItem("gifted_photo_paths");
    if (pp) {
      try {
        const paths: string[] = JSON.parse(pp);
        Promise.all(
          paths.map(objectPath =>
            fetch(`${base}/api/storage/object-url?path=${encodeURIComponent(objectPath)}`)
              .then(r => r.ok ? r.json() : null)
              .then(d => ({ id: crypto.randomUUID(), objectPath, previewUrl: d?.url ?? `${base}/api/storage${objectPath}` }))
              .catch(() => ({ id: crypto.randomUUID(), objectPath, previewUrl: `${base}/api/storage${objectPath}` }))
          )
        ).then(items => setPhotos(items));
      } catch { /* ignore */ }
    }
  }, []);


  // Revoke any blob URL when component unmounts to free memory
  useEffect(() => {
    return () => {
      if (videoBlobUrlRef.current) {
        URL.revokeObjectURL(videoBlobUrlRef.current);
        videoBlobUrlRef.current = null;
      }
    };
  }, []);

  // Video upload — onSuccess only captures objectPath; preview URL is the local blob
  const { uploadFile, isUploading, progress, error: uploadError } = useUpload({
    basePath: `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/storage`,
    onSuccess: (response) => {
      setVideoObjectPath(response.objectPath);
      // Keep the local blob URL for preview — don't replace with server URL
    },
  });

  const handleVideoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setVideoError(null);
    if (file.size > 200 * 1024 * 1024) {
      setVideoError("Video must be under 200 MB.");
      if (videoInputRef.current) videoInputRef.current.value = "";
      return;
    }
    if (!file.type.startsWith("video/")) {
      setVideoError("Please select a video file (MP4, MOV, etc.).");
      if (videoInputRef.current) videoInputRef.current.value = "";
      return;
    }
    // Create a local blob URL immediately so the preview renders without server round-trip
    if (videoBlobUrlRef.current) URL.revokeObjectURL(videoBlobUrlRef.current);
    const blobUrl = URL.createObjectURL(file);
    videoBlobUrlRef.current = blobUrl;
    setVideoPreviewUrl(blobUrl);
    const result = await uploadFile(file);
    if (videoInputRef.current) videoInputRef.current.value = "";
    // If upload failed, clear preview so user knows to retry
    if (!result) handleRemoveVideo();
  };

  const handleRemoveVideo = () => {
    if (videoBlobUrlRef.current) {
      URL.revokeObjectURL(videoBlobUrlRef.current);
      videoBlobUrlRef.current = null;
    }
    setVideoObjectPath(null);
    setVideoPreviewUrl(null);
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    if (photoInputRef.current) photoInputRef.current.value = "";
    setPhotoError(null);
    const slotsAvailable = MAX_PHOTOS - photos.length - photosUploading.length;
    const toUpload = files.slice(0, slotsAvailable);
    if (toUpload.length < files.length) setPhotoError(`You can add up to ${MAX_PHOTOS} photos total.`);
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");

    for (const file of toUpload) {
      if (file.size > MAX_PHOTO_SIZE) { setPhotoError(`"${file.name}" is over 20 MB.`); continue; }
      if (!ACCEPTED_PHOTO_TYPES.includes(file.type)) { setPhotoError(`"${file.name}" must be JPEG, PNG, WebP, or HEIC.`); continue; }
      const uploadId = crypto.randomUUID();
      const localPreview = URL.createObjectURL(file);
      setPhotosUploading((prev) => [...prev, { id: uploadId, progress: 0, localPreview }]);
      (async () => {
        try {
          const res = await fetch(`${base}/api/storage/uploads/request-url`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
          });
          if (!res.ok) throw new Error("Failed to get upload URL");
          const { uploadURL, objectPath } = await res.json();
          setPhotosUploading((prev) => prev.map((p) => p.id === uploadId ? { ...p, progress: 30 } : p));
          await new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open("PUT", uploadURL, true);
            xhr.setRequestHeader("Content-Type", file.type);
            xhr.upload.onprogress = (ev) => {
              if (ev.lengthComputable) {
                setPhotosUploading((prev) => prev.map((p) => p.id === uploadId ? { ...p, progress: 30 + Math.round((ev.loaded / ev.total) * 65) } : p));
              }
            };
            xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("Upload failed")));
            xhr.onerror = () => reject(new Error("Upload failed"));
            xhr.send(file);
          });
          const servingUrl = `${base}/api/storage${objectPath}`;
          setPhotos((prev) => [...prev, { id: uploadId, objectPath, previewUrl: servingUrl }]);
        } catch {
          setPhotoError(`Failed to upload "${file.name}".`);
        } finally {
          setPhotosUploading((prev) => prev.filter((p) => p.id !== uploadId));
          URL.revokeObjectURL(localPreview);
        }
      })();
    }
  };

  const handleRemovePhoto = (id: string) => setPhotos((prev) => prev.filter((p) => p.id !== id));

  const saveToLocalStorage = () => {
    localStorage.removeItem("gifted_paid_id");
    if (videoObjectPath) localStorage.setItem("gifted_video_path", videoObjectPath);
    else localStorage.removeItem("gifted_video_path");
    if (photos.length > 0) localStorage.setItem("gifted_photo_paths", JSON.stringify(photos.map((p) => p.objectPath)));
    else localStorage.removeItem("gifted_photo_paths");
    if (personalNote.trim()) localStorage.setItem("gifted_personal_note", personalNote.trim());
    else localStorage.removeItem("gifted_personal_note");
    const nonEmptyLinks = extraLinks.map(l => l.trim()).filter(Boolean);
    if (nonEmptyLinks.length > 0) localStorage.setItem("gifted_extra_links", JSON.stringify(nonEmptyLinks));
    else localStorage.removeItem("gifted_extra_links");
    localStorage.removeItem("gifted_playlist_url");
    if (giftTitle.trim()) localStorage.setItem("gifted_gift_title", giftTitle.trim());
    else localStorage.removeItem("gifted_gift_title");
    localStorage.setItem("gifted_experience", selectedExperience);
    localStorage.setItem("gifted_occasion", occasion);
    if (recipientName) localStorage.setItem("gifted_recipient_name", recipientName);
    if (recipientPhone) localStorage.setItem("gifted_recipient_phone", recipientPhone);
    else localStorage.removeItem("gifted_recipient_phone");
    if (senderName) localStorage.setItem("gifted_sender_name", senderName);
    if (amount && parseFloat(amount) > 0) localStorage.setItem("gifted_amount", amount);
    else localStorage.removeItem("gifted_amount");
    if (intent) localStorage.setItem("gifted_intent", intent);
    else localStorage.removeItem("gifted_intent");
    if (scheduleEnabled && scheduledFor) {
      localStorage.setItem("gifted_scheduled_for", scheduledFor);
      localStorage.setItem("gifted_scheduled_time", scheduledTime);
    } else {
      localStorage.removeItem("gifted_scheduled_for");
      localStorage.removeItem("gifted_scheduled_time");
    }
  };

  const handlePreview = () => {
    if (amount && parseFloat(amount) > 0 && parseFloat(amount) < 10) {
      setStepError("The minimum gift balance is $10. Choose $10 or more, or leave it blank.");
      return;
    }
    if (amount && parseFloat(amount) >= 10) {
      if (!recipientPhone.trim()) {
        setStepError("A phone number is required to protect the cash balance — add it above.");
        return;
      }
      if (recipientPhone.replace(/\D/g, "").length < 10) {
        setStepError("Please enter a complete 10-digit phone number.");
        return;
      }
    }
    if (scheduleEnabled && !scheduledFor) {
      setStepError("Please pick a delivery date, or switch back to \"Send now\".");
      return;
    }
    saveToLocalStorage();
    setLocation("/preview");
  };

  const handleAI = async (mode: "rewrite" | "regenerate") => {
    if (!recipientName || !senderName || !occasion) {
      setAiError("Please fill in the recipient and sender names on the previous step first.");
      setTimeout(() => setAiError(null), 4000);
      return;
    }
    const noteToRewrite = personalNote;
    setAiLoading(mode);
    setAiError(null);
    setShowAiGlow(false);
    let generated = "";
    setPersonalNote("");
    try {
      await streamAINote(
        { currentNote: mode === "rewrite" ? noteToRewrite : undefined, occasion, recipientName, senderName, intent: intent || undefined, giftTitle: giftTitle || undefined, mode },
        (chunk) => { generated += chunk; setPersonalNote(generated); },
        () => { setAiLoading(null); setShowAiGlow(true); setTimeout(() => setShowAiGlow(false), 2000); },
        (err) => { setAiError(err); setAiLoading(null); if (!generated) setPersonalNote(noteToRewrite); }
      );
    } catch {
      setAiError("Something went wrong. Please try again.");
      setAiLoading(null);
      if (!generated) setPersonalNote(noteToRewrite);
    }
  };

  // Navigation
  // Sync steps with browser history so the browser back button goes back one step
  useEffect(() => {
    window.history.replaceState({ step: 1 }, "");
    const handlePopState = (e: PopStateEvent) => {
      const target = (e.state as { step?: number } | null)?.step ?? 1;
      setDirection(-1);
      setStepError(null);
      setStep(target);
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const goNext = () => {
    setStepError(null);
    if (step === 1) {
      if (!recipientName.trim()) { setStepError("Please enter the recipient's name."); return; }
      if (!senderName.trim()) { setStepError("Please enter your name."); return; }
    }
    if (step === 2) {
      if (!giftTitle.trim()) { setStepError("Please add a gift headline."); return; }
    }
    const next = step + 1;
    window.history.pushState({ step: next }, "");
    setDirection(1);
    setStep(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goBack = () => {
    setStepError(null);
    window.history.back();
  };

  // Context pill shown in steps 2+
  const CurrentIcon = EXPERIENCE_ICONS[currentExperience.id];
  const ContextPill = () => (
    <div
      className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sm font-medium mb-8 border"
      style={{
        background: `linear-gradient(90deg, ${currentExperience.palette.from}25, ${currentExperience.palette.via}20)`,
        borderColor: `${currentExperience.palette.from}40`,
      }}
    >
      <CurrentIcon className="w-3.5 h-3.5" />
      {recipientName || "Someone special"} · {currentExperience.name}
    </div>
  );

  return (
    <div className="min-h-screen relative">

      {/* Background tint — cross-fades with experience */}
      <AnimatePresence mode="sync">
        <motion.div
          key={selectedExperience}
          className="fixed inset-0 pointer-events-none"
          style={{
            zIndex: -1,
            background: `linear-gradient(145deg, ${currentExperience.palette.from}, ${currentExperience.palette.via}, ${currentExperience.palette.to})`,
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.07 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1 }}
        />
      </AnimatePresence>

      <div className={`mx-auto px-6 py-12 transition-all duration-500 ${step === 1 ? "max-w-5xl" : "max-w-3xl"}`}>

        {/* Progress */}
        <ProgressBar step={step} onStepClick={(s) => { setStep(s); setStepError(null); }} />

        {/* Step content */}
        <AnimatePresence mode="wait" custom={direction}>

          {/* ── Step 1: Set the scene ── */}
          {step === 1 && (
            <motion.div
              key="step1"
              custom={direction}
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="lg:flex lg:gap-12 lg:items-start">

                {/* Main content */}
                <div className="lg:flex-1">

                  {/* Step header */}
                  <div className="mb-8">
                    <h1 className="font-serif text-4xl font-medium mb-2">How should this feel?</h1>
                    <p className="text-muted-foreground">
                      Choose the mood — it shapes every detail of their reveal experience.
                    </p>
                  </div>

                  {/* Experience grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-10">
                    {EXPERIENCE_LIST.map((exp) => {
                      const isSelected = selectedExperience === exp.id;
                      const ExpIcon = EXPERIENCE_ICONS[exp.id];
                      return (
                        <button
                          key={exp.id}
                          type="button"
                          onClick={() => { setSelectedExperience(exp.id); setHasManuallyChosen(true); }}
                          className={`relative rounded-2xl overflow-hidden text-left transition-all duration-200 focus:outline-none ${
                            isSelected
                              ? "ring-4 ring-primary ring-offset-4 ring-offset-background scale-[1.03] shadow-xl"
                              : "hover:scale-[1.02] hover:shadow-lg"
                          }`}
                        >
                          <div
                            className="w-full relative flex flex-col items-center justify-center py-6 gap-2"
                            style={{
                              background: `linear-gradient(135deg, ${exp.palette.from}, ${exp.palette.via}, ${exp.palette.to})`,
                            }}
                          >
                            {/* Icon */}
                            <ExpIcon
                              className={`w-6 h-6 ${exp.isDark ? "text-indigo-200" : "text-white/90"}`}
                            />

                            {/* Badges */}
                            {suggestedExperience === exp.id && !isSelected && (
                              <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full bg-white/25 backdrop-blur-sm text-white text-[9px] font-bold tracking-wide uppercase">
                                Suggested
                              </div>
                            )}
                            {isSelected && (
                              <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-white flex items-center justify-center">
                                <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                              </div>
                            )}
                          </div>

                          <div className="px-3 py-2.5 bg-card border-x border-b border-border rounded-b-2xl">
                            <p className="text-sm font-semibold leading-tight">{exp.name}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{exp.tagline}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Divider */}
                  <div className="flex items-center gap-3 mb-8">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Then tell us who</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>

                  {/* Names */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <div className="space-y-2">
                      <Label htmlFor="recipient">Who is this for?</Label>
                      <Input
                        id="recipient"
                        placeholder="Their name"
                        value={recipientName}
                        onChange={(e) => setRecipientName(e.target.value)}
                        className="h-12 rounded-xl text-base"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sender">Who is it from?</Label>
                      <Input
                        id="sender"
                        placeholder="Your name"
                        value={senderName}
                        onChange={(e) => setSenderName(e.target.value)}
                        className="h-12 rounded-xl text-base"
                      />
                    </div>
                  </div>

                  {/* Occasion */}
                  <div className="space-y-2 mb-8">
                    <Label htmlFor="occasion">What's the occasion?</Label>
                    <Select
                      value={occasion}
                      onValueChange={(val) => {
                        setOccasion(val);
                        // Clear preset intent so new occasion's suggestions start fresh
                        if (!customIntentMode && ALL_PRESET_INTENTS.has(intent)) setIntent("");
                        const suggested = getSuggestedExperience(val);
                        setSuggestedExperience(suggested);
                        if (!hasManuallyChosen) {
                          setSelectedExperience(suggested);
                        }
                      }}
                    >
                      <SelectTrigger className="h-12 rounded-xl text-base">
                        <SelectValue placeholder="Select occasion" />
                      </SelectTrigger>
                      <SelectContent>
                        {OCCASIONS.map((occ) => (
                          <SelectItem key={occ} value={occ}>{occ}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      We'll suggest the matching experience, but you can always choose your own.
                    </p>
                  </div>

                  {/* Step error */}
                  <AnimatePresence>
                    {stepError && (
                      <motion.p
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="text-sm text-destructive mb-4"
                      >
                        {stepError}
                      </motion.p>
                    )}
                  </AnimatePresence>

                  {/* Navigation */}
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      size="lg"
                      onClick={goNext}
                      className="w-full sm:w-auto rounded-full h-13 px-8 text-base shadow-lg shadow-primary/20 hover:-translate-y-0.5 transition-all"
                    >
                      Write the moment <ArrowRight className="ml-2 w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Live preview panel */}
                <PreviewCard
                  experience={currentExperience}
                  recipientName={recipientName}
                />
              </div>
            </motion.div>
          )}

          {/* ── Step 2: Write the moment ── */}
          {step === 2 && (
            <motion.div
              key="step2"
              custom={direction}
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
              <ContextPill />

              <div className="mb-8">
                <h1 className="font-serif text-4xl font-medium mb-2">Write the moment.</h1>
                <p className="text-muted-foreground">
                  These are the words they'll read when they open your gift — write from the heart.
                </p>
              </div>

              <div className="space-y-6">

                {/* Gift headline */}
                <div
                  className="rounded-3xl p-6 border space-y-4"
                  style={{ background: "hsl(var(--card))" }}
                >
                  <div>
                    <Label htmlFor="title" className="text-base font-semibold">Gift Headline</Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      This appears as the bold hero text in their reveal — make it land.
                    </p>
                  </div>
                  <Input
                    id="title"
                    placeholder={(() => {
                      const name = recipientName || "Sarah";
                      const placeholders: Record<string, string> = {
                        Birthday: `e.g. Happy Birthday, ${name}!`,
                        Anniversary: `e.g. Here's to you, ${name}.`,
                        Graduation: `e.g. So proud of you, ${name}.`,
                        "New Baby": `e.g. Welcome to the world, little one.`,
                        Holiday: `e.g. Happy holidays, ${name}!`,
                        "Just Because": `e.g. Thinking of you, ${name}.`,
                        Wedding: `e.g. Wishing you both the very best.`,
                        "Thank You": `e.g. Thank you so much, ${name}.`,
                        Other: `e.g. This one's for you, ${name}.`,
                      };
                      return occasion
                        ? (placeholders[occasion] ?? `e.g. For ${name}.`)
                        : `e.g. A little something for ${name}.`;
                    })()}
                    value={giftTitle}
                    onChange={(e) => setGiftTitle(e.target.value)}
                    className="h-12 rounded-xl text-base font-medium"
                  />
                </div>

                {/* Personal note */}
                <div
                  className="rounded-3xl p-6 border space-y-4"
                  style={{ background: "hsl(var(--card))" }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Label htmlFor="message" className="text-base font-semibold">Personal Note <span className="text-muted-foreground font-normal text-sm">(optional)</span></Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Styled beautifully in their reveal — yours to edit, or let AI help.
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      {!personalNote.trim() ? (
                        <button
                          type="button"
                          disabled={aiLoading !== null}
                          onClick={() => handleAI("regenerate")}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all border border-primary/20"
                        >
                          {aiLoading === "regenerate" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                          {aiLoading === "regenerate" ? "Writing..." : "Write it for me"}
                        </button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={aiLoading !== null}
                            onClick={() => handleAI("rewrite")}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all border border-primary/20"
                          >
                            {aiLoading === "rewrite" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                            {aiLoading === "rewrite" ? "Polishing..." : "Polish it"}
                          </button>
                          <button
                            type="button"
                            disabled={aiLoading !== null}
                            onClick={() => handleAI("regenerate")}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50 disabled:cursor-not-allowed transition-all border border-border"
                          >
                            {aiLoading === "regenerate" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                            {aiLoading === "regenerate" ? "Writing..." : "Start fresh"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="relative">
                    <AnimatePresence>
                      {showAiGlow && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="absolute -inset-0.5 rounded-xl bg-gradient-to-r from-primary/30 via-primary/20 to-primary/30 pointer-events-none"
                          style={{ filter: "blur(4px)" }}
                        />
                      )}
                    </AnimatePresence>
                    <Textarea
                      id="message"
                      placeholder="Write a personal note (optional)..."
                      className="min-h-[160px] rounded-xl text-base resize-none relative z-10"
                      value={personalNote}
                      onChange={(e) => setPersonalNote(e.target.value)}
                    />
                    {aiLoading !== null && (
                      <div className="absolute bottom-3 right-3 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium">
                        <Sparkles className="w-3 h-3 animate-pulse" />
                        AI is writing...
                      </div>
                    )}
                  </div>

                  <AnimatePresence>
                    {aiError && (
                      <motion.p
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="text-sm text-destructive"
                      >
                        {aiError}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Step error */}
              <AnimatePresence>
                {stepError && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-sm text-destructive mt-4"
                  >
                    {stepError}
                  </motion.p>
                )}
              </AnimatePresence>

              {/* Navigation */}
              <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3 mt-8">
                <Button type="button" variant="ghost" size="lg" onClick={goBack} className="rounded-full h-13 px-6 text-base w-full sm:w-auto">
                  <ArrowLeft className="mr-2 w-4 h-4" /> Back
                </Button>
                <Button
                  type="button"
                  size="lg"
                  onClick={goNext}
                  className="w-full sm:w-auto rounded-full h-13 px-8 text-base shadow-lg shadow-primary/20 hover:-translate-y-0.5 transition-all"
                >
                  Complete the gift <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* ── Step 3: Complete the gift ── */}
          {step === 3 && (
            <motion.div
              key="step3"
              custom={direction}
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
              <ContextPill />

              <div className="mb-8">
                <h1 className="font-serif text-4xl font-medium mb-2">Complete the gift.</h1>
                <p className="text-muted-foreground">
                  Everything here is optional — add as much or as little as feels right.
                </p>
              </div>

              <div className="space-y-6">

                {/* Make it personal — video, photos, playlist */}
                <div className="rounded-3xl p-6 border space-y-5" style={{ background: "hsl(var(--card))" }}>
                  <div className="flex items-center justify-between border-b border-border pb-4">
                    <div>
                      <h2 className="text-base font-semibold">Make it personal</h2>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Video messages and photos appear as a cinematic gallery during their reveal.
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground bg-secondary px-2.5 py-1 rounded-full border border-border">Optional</span>
                  </div>

                  {/* Video + Photos row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={handleVideoSelect} />
                    {videoError && (
                      <div className="col-span-full flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-destructive/30 bg-destructive/5 text-destructive text-xs font-medium">
                        <AlertCircle className="w-4 h-4 shrink-0" /> {videoError}
                      </div>
                    )}

                    {!videoPreviewUrl && !isUploading && (
                      <button
                        type="button"
                        onClick={() => videoInputRef.current?.click()}
                        className="flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 transition-all group"
                      >
                        <div className="w-11 h-11 rounded-full bg-secondary flex items-center justify-center mb-2.5 group-hover:bg-primary/15 transition-colors">
                          <Video className="w-5 h-5 text-muted-foreground group-hover:text-primary" />
                        </div>
                        <span className="font-medium text-sm">Add a Video</span>
                        <span className="text-xs text-muted-foreground mt-0.5">Record or upload</span>
                      </button>
                    )}

                    {isUploading && (
                      <div className="flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-primary/30 bg-primary/5">
                        <Loader2 className="w-7 h-7 text-primary animate-spin mb-2.5" />
                        <span className="font-medium text-sm mb-2">Uploading...</span>
                        <div className="w-full max-w-[180px] h-1.5 bg-secondary rounded-full overflow-hidden">
                          <motion.div className="h-full bg-primary rounded-full" initial={{ width: 0 }} animate={{ width: `${progress}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground mt-1">{progress}%</span>
                      </div>
                    )}

                    {videoPreviewUrl && !isUploading && (
                      <div className="relative rounded-2xl border-2 border-primary/30 bg-primary/5 overflow-hidden">
                        <video src={videoPreviewUrl} controls playsInline className="w-full aspect-video object-cover rounded-xl" />
                        <div className="flex items-center justify-between px-3 py-2">
                          <div className="flex items-center gap-1.5 text-sm text-primary font-medium">
                            <CheckCircle2 className="w-4 h-4" /> Video added
                          </div>
                          <button type="button" onClick={handleRemoveVideo} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors">
                            <X className="w-3.5 h-3.5" /> Remove
                          </button>
                        </div>
                      </div>
                    )}

                    <input ref={photoInputRef} type="file" accept=".jpg,.jpeg,.png,.webp,.heic,.heif" multiple className="hidden" onChange={handlePhotoSelect} />

                    {photos.length === 0 && photosUploading.length === 0 && (
                      <button
                        type="button"
                        onClick={() => photoInputRef.current?.click()}
                        className="flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 transition-all group"
                      >
                        <div className="w-11 h-11 rounded-full bg-secondary flex items-center justify-center mb-2.5 group-hover:bg-primary/15 transition-colors">
                          <ImageIcon className="w-5 h-5 text-muted-foreground group-hover:text-primary" />
                        </div>
                        <span className="font-medium text-sm">Add Photos</span>
                        <span className="text-xs text-muted-foreground mt-0.5">Up to {MAX_PHOTOS} images</span>
                      </button>
                    )}
                  </div>

                  {/* Photo grid */}
                  {(photos.length > 0 || photosUploading.length > 0) && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-muted-foreground">{photos.length} of {MAX_PHOTOS} photos</span>
                        {photos.length + photosUploading.length < MAX_PHOTOS && (
                          <button type="button" onClick={() => photoInputRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-secondary hover:bg-secondary/80 transition-all border border-border">
                            <Plus className="w-3.5 h-3.5" /> Add more
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-2.5">
                        {photos.map((photo) => (
                          <div key={photo.id} className="relative aspect-square rounded-xl overflow-hidden group">
                            <img src={photo.previewUrl} alt="Uploaded photo" className="w-full h-full object-cover" />
                            <button type="button" onClick={() => handleRemovePhoto(photo.id)} className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-destructive transition-colors">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                        {photosUploading.map((item) => (
                          <div key={item.id} className="relative aspect-square rounded-xl overflow-hidden bg-secondary">
                            <img src={item.localPreview} alt="Uploading" className="w-full h-full object-cover opacity-50" />
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                              <Loader2 className="w-5 h-5 text-primary animate-spin mb-1" />
                              <span className="text-xs font-medium text-primary">{item.progress}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {photoError && <p className="text-sm text-destructive">{photoError}</p>}
                  {uploadError && <p className="text-sm text-destructive">Upload failed: {uploadError.message}</p>}

                  {/* Links — anything with a URL, multiple allowed */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Add links <span className="text-muted-foreground font-normal">— tickets, playlists, reservations, anything</span></Label>
                    <div className="space-y-2">
                      {extraLinks.map((link, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <div className="relative flex-1">
                            <Link2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                              placeholder={LINK_IDEAS[idx % LINK_IDEAS.length]}
                              className="h-11 rounded-xl text-sm pl-10 transition-all"
                              value={link}
                              onChange={(e) => {
                                const updated = [...extraLinks];
                                updated[idx] = e.target.value;
                                setExtraLinks(updated);
                              }}
                            />
                          </div>
                          {extraLinks.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setExtraLinks(extraLinks.filter((_, i) => i !== idx))}
                              className="w-9 h-9 flex items-center justify-center rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    {extraLinks.length < 5 && (
                      <button
                        type="button"
                        onClick={() => setExtraLinks([...extraLinks, ""])}
                        className="flex items-center gap-1.5 text-xs text-primary font-medium hover:underline mt-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add another link
                      </button>
                    )}
                    <p className="text-xs text-muted-foreground">Each link shows as a tap-to-open card in their gift — perfect for layering experiences.</p>
                  </div>
                </div>

                {/* Give it weight */}
                <div className="rounded-3xl p-6 border space-y-5" style={{ background: "hsl(var(--card))" }}>
                  <div className="flex items-center justify-between border-b border-border pb-4">
                    <div>
                      <h2 className="text-base font-semibold">Give it weight</h2>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Name what it's for — a number becomes a gesture.
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground bg-secondary px-2.5 py-1 rounded-full border border-border">Optional</span>
                  </div>

                  {/* Intention first */}
                  <div className="space-y-3">
                    <Label className="text-sm font-semibold">What's it for?</Label>
                    <div className="flex flex-wrap gap-2">
                      {(INTENT_MAP[occasion] ?? DEFAULT_INTENTS).map((lbl) => (
                        <button
                          key={lbl}
                          type="button"
                          onClick={() => {
                            setCustomIntentMode(false);
                            setIntent(intent === lbl ? "" : lbl);
                          }}
                          className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${
                            !customIntentMode && intent === lbl
                              ? "bg-foreground text-background border-foreground"
                              : "bg-background text-foreground border-border hover:border-foreground/30"
                          }`}
                        >
                          {lbl}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          setCustomIntentMode(true);
                          if (ALL_PRESET_INTENTS.has(intent)) setIntent("");
                        }}
                        className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${
                          customIntentMode
                            ? "bg-foreground text-background border-foreground"
                            : "bg-background text-foreground border-border hover:border-foreground/30"
                        }`}
                      >
                        Other…
                      </button>
                    </div>
                    <AnimatePresence>
                      {customIntentMode && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <Input
                            autoFocus
                            placeholder="e.g. Dinner on me, Spa day, Whatever you need…"
                            maxLength={60}
                            value={customIntentMode && !ALL_PRESET_INTENTS.has(intent) ? intent : ""}
                            onChange={(e) => setIntent(e.target.value)}
                            className="h-11 rounded-2xl mt-1"
                          />
                          {intent.length > 40 && (
                            <p className="text-xs text-muted-foreground mt-1 text-right">{intent.length}/60</p>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Amount second */}
                  <div className="space-y-3 pt-2">
                    <Label className="text-sm font-semibold">How much to add?</Label>
                    <div className="flex flex-wrap gap-2.5">
                      <button
                        type="button"
                        onClick={() => setAmount("")}
                        className={`px-5 h-11 rounded-full font-semibold text-base border transition-all ${
                          !amount
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-secondary text-secondary-foreground border-transparent hover:border-border"
                        }`}
                      >
                        None
                      </button>
                      {AMOUNTS.map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setAmount(amt)}
                          className={`px-6 h-11 rounded-full font-bold text-base border transition-all ${
                            amount === amt
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-secondary text-secondary-foreground border-transparent hover:border-border"
                          }`}
                        >
                          ${amt}
                        </button>
                      ))}
                      <div className="relative flex-1 min-w-[110px]">
                        <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          type="number"
                          placeholder="Custom"
                          className="h-11 rounded-full text-base font-bold pl-9"
                          value={!AMOUNTS.includes(amount) && amount ? amount : ""}
                          onChange={(e) => setAmount(e.target.value)}
                        />
                      </div>
                    </div>

                    {/* $10 minimum inline warning */}
                    <AnimatePresence>
                      {amount && parseFloat(amount) > 0 && parseFloat(amount) < 10 && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.2 }}
                          className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border"
                          style={{ background: "hsl(45 100% 96%)", borderColor: "hsl(38 92% 50% / 0.3)", color: "hsl(32 94% 32%)" }}
                        >
                          <AlertCircle className="w-4 h-4 flex-shrink-0" />
                          <p className="text-xs font-medium">
                            Minimum is $10 — enter $10 or more, or leave this blank.
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Live preview of balance + intent */}
                    {(amount || intent) && (
                      <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-primary/20 bg-primary/5 mt-2"
                      >
                        <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                          <Sparkles className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          {amount && <p className="text-sm font-bold text-foreground">${amount}</p>}
                          {intent && <p className="text-xs text-muted-foreground">{intent}</p>}
                          {!intent && amount && <p className="text-xs text-muted-foreground">Add an intention above to give it meaning</p>}
                        </div>
                      </motion.div>
                    )}

                    {/* Phone number */}
                    <div className="space-y-2 pt-4 border-t border-border mt-2">
                      <Label htmlFor="recipientPhone">
                        Their phone number{" "}
                        {amount && parseFloat(amount) >= 10
                          ? <span className="text-destructive text-xs font-normal">— required to receive the balance</span>
                          : <span className="text-muted-foreground text-xs font-normal">(optional)</span>
                        }
                      </Label>
                      <Input
                        id="recipientPhone"
                        type="tel"
                        inputMode="numeric"
                        placeholder="(555) 000-0000"
                        value={recipientPhone}
                        onChange={(e) => setRecipientPhone(formatPhoneNumber(e.target.value))}
                        className="h-12 rounded-xl text-base"
                      />
                      <p className="text-xs text-muted-foreground">
                        {amount && parseFloat(amount) >= 10
                          ? "Required to verify who they are when they redeem. Never used for marketing."
                          : "Add their number and we'll deliver the link — or skip it and share it yourself."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Schedule delivery */}
              <div className="rounded-3xl p-6 border space-y-4" style={{ background: "hsl(var(--card))" }}>
                <div className="flex items-center justify-between border-b border-border pb-4">
                  <div>
                    <h2 className="text-base font-semibold">Schedule delivery</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Send now or pick a future date — we'll deliver the link automatically.
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground bg-secondary px-2.5 py-1 rounded-full border border-border">Optional</span>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setScheduleEnabled(false)}
                    className={`flex-1 py-3 rounded-2xl text-sm font-medium border transition-all ${
                      !scheduleEnabled
                        ? "bg-foreground text-background border-foreground"
                        : "border-border hover:border-foreground/40 text-muted-foreground"
                    }`}
                  >
                    Send now
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setScheduleEnabled(true);
                      if (!scheduledFor) {
                        setScheduledFor(new Date(Date.now() + 86400000).toISOString().split("T")[0]);
                      }
                    }}
                    className={`flex-1 py-3 rounded-2xl text-sm font-medium border transition-all ${
                      scheduleEnabled
                        ? "bg-foreground text-background border-foreground"
                        : "border-border hover:border-foreground/40 text-muted-foreground"
                    }`}
                  >
                    Schedule for later
                  </button>
                </div>

                <AnimatePresence>
                  {scheduleEnabled && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="flex items-center gap-3 pt-1">
                        <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <Input
                          type="date"
                          value={scheduledFor}
                          min={new Date(Date.now() + 86400000).toISOString().split("T")[0]}
                          onChange={(e) => setScheduledFor(e.target.value)}
                          className="h-11 rounded-xl text-base flex-1"
                        />
                      </div>
                      <div className="flex items-center gap-3">
                        <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <Input
                          type="time"
                          value={scheduledTime}
                          onChange={(e) => setScheduledTime(e.target.value)}
                          className="h-11 rounded-xl text-base flex-1"
                        />
                      </div>
                      {scheduledFor && (
                        <p className="text-xs text-muted-foreground mt-1 pl-7">
                          {recipientName || "Your recipient"} will get the link on{" "}
                          {new Date(`${scheduledFor}T${scheduledTime}:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}{" "}
                          at{" "}
                          {new Date(`${scheduledFor}T${scheduledTime}:00`).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}.
                        </p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Navigation */}
              <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3 mt-8">
                <Button type="button" variant="ghost" size="lg" onClick={goBack} className="rounded-full h-13 px-6 text-base w-full sm:w-auto">
                  <ArrowLeft className="mr-2 w-4 h-4" /> Back
                </Button>
                <Button
                  type="button"
                  size="lg"
                  onClick={handlePreview}
                  className="w-full sm:w-auto rounded-full h-13 px-8 text-base shadow-xl shadow-primary/25 hover:-translate-y-0.5 transition-all"
                >
                  Preview your gift <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
