import React, { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowRight, ArrowLeft, Video, Music, Image as ImageIcon,
  DollarSign, Sparkles, RefreshCw, Loader2, X, CheckCircle2,
  Plus, Gift, Star, Heart, Snowflake, Sun, Flower2, Calendar, Clock, AlertCircle, Link2, RotateCcw, Smartphone, Play, Users, Lock, Flame, Zap, Trophy, GripVertical,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import QRCodeLib from "qrcode";
import { useUpload } from "@workspace/object-storage-web";
import { resetCompletedGiftState } from "@/lib/session";
import { GiftRecoveryBanner } from "@/components/gift-recovery-banner";

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
  "mothers-day":    Flower2,
  "fathers-day":    Star,
  "smoke-amber":    Flame,
  "carbon-steel":   Zap,
  "electric-night": Trophy,
};

const INTENT_MAP: Record<string, string[]> = {
  "Birthday":     ["Treat yourself", "Night out", "That thing you've been eyeing", "Weekend away", "Birthday dinner"],
  "Anniversary":  ["Date night", "Weekend getaway", "Something special", "Just for you", "Our tradition"],
  "Love":         ["Something from the heart", "Date night", "Just because I love you", "Treat yourself, love", "Because you're everything"],
  "Graduation":   ["First apartment fund", "Travel before life gets busy", "New chapter, your choice", "Celebrate yourself", "Next adventure"],
  "New Baby":     ["Baby essentials", "Coffee & survival", "Self-care, seriously", "Family day out", "Nesting fund"],
  "Holiday":      ["Holiday treat", "Something you need", "Festive dinner", "Your wishlist", "Cozy night in"],
  "Just Because": ["Coffee on me", "Treat yourself", "No reason needed", "Just a little something", "Because I could"],
  "Wedding":      ["Honeymoon fund", "First home together", "Date nights ahead", "Something special", "New adventure"],
  "Thank You":    ["Coffee on me", "Lunch on me", "A small thank you", "Treat yourself", "You deserve it"],
  "Mother's Day": ["Flowers & brunch", "Spa day", "Something you love", "The best mom around", "Treat yourself"],
  "Father's Day": ["Golf day", "Dinner on me", "Best dad ever", "Treat yourself", "Something special"],
  "Other":        ["Treat yourself", "Coffee on me", "Something special", "Your choice", "Take a break"],
};
const DEFAULT_INTENTS = ["Coffee on me", "Treat yourself", "Date night", "Something special", "Take a break"];
const ALL_PRESET_INTENTS = new Set(Object.values(INTENT_MAP).flat());
const AMOUNTS = ["10", "25", "50", "100", "250"];
const OCCASIONS = ["Birthday", "Anniversary", "Love", "Graduation", "New Baby", "Holiday", "Just Because", "Wedding", "Thank You", "Mother's Day", "Father's Day", "Other"];

const MAX_PHOTOS = 6;
const MAX_PHOTO_SIZE = 20 * 1024 * 1024;
const ACCEPTED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];

const LINK_IDEAS = [
  "YouTube video...",
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
  "SoundCloud track...",
  "Anything with a URL...",
];

const LINK_LABEL_WORDS = [
  "anything",
  "concert tickets",
  "a dinner",
  "a playlist",
  "an Airbnb",
  "a song",
  "show tickets",
  "a mix",
];

// ─── URL helpers ──────────────────────────────────────────────────────────────

function autoCorrectUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function isValidUrl(url: string): boolean {
  const corrected = autoCorrectUrl(url);
  try {
    const u = new URL(corrected);
    return (u.protocol === "http:" || u.protocol === "https:") && u.hostname.includes(".");
  } catch {
    return false;
  }
}

// ─── Phone formatting ─────────────────────────────────────────────────────────

function formatPhoneNumber(value: string): string {
  // International number — preserve as typed, just strip invalid chars
  if (value.trimStart().startsWith("+")) {
    return value.replace(/[^\d\s\-()+]/g, "");
  }
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
    personalDetail?: string;
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

const STEP_LABELS = ["Set the scene", "Write the moment", "Complete the moment"];

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

type AmbientParticleEffect = "petals" | "rose-petals" | "snow" | "confetti" | "stars" | "bokeh" | "florals" | "embers" | "sparks";

function getAmbientEffect(experienceId: string): AmbientParticleEffect | null {
  switch (experienceId) {
    case "garden-bloom":   return "petals";
    case "rose-petal":     return "rose-petals";
    case "snow-flurry":    return "snow";
    case "confetti-burst": return "confetti";
    case "midnight-stars": return "stars";
    case "golden-hour":    return "bokeh";
    case "sunrise":        return "bokeh";
    case "mothers-day":    return "florals";
    case "fathers-day":    return "bokeh";
    case "smoke-amber":    return "embers";
    case "carbon-steel":   return "stars";
    case "electric-night": return "sparks";
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
    case "mothers-day":
      return { animate: { scale: [1, 1.18, 1, 1.1, 1] }, transition: { repeat: Infinity, duration: 1.4, ease: "easeInOut" } };
    case "fathers-day":
      return { animate: { scale: [1, 1.08, 1], opacity: [0.85, 1, 0.85] }, transition: { repeat: Infinity, duration: 2.6, ease: "easeInOut" } };
    case "smoke-amber":
      return { animate: { scale: [1, 1.1, 1], opacity: [0.75, 1, 0.75] }, transition: { repeat: Infinity, duration: 2.2, ease: "easeInOut" } };
    case "carbon-steel":
      return { animate: { opacity: [0.4, 1, 0.4], scale: [0.9, 1.08, 0.9] }, transition: { repeat: Infinity, duration: 1.6, ease: "easeInOut" } };
    case "electric-night":
      return { animate: { y: [0, -10, 0] }, transition: { repeat: Infinity, duration: 0.8, ease: "easeInOut" } };
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

      // Measure container so fall distance uses pixels, not element-relative %
      const containerH = container.offsetHeight || 300;

      if (effect === "petals" || effect === "rose-petals") {
        const colors = effect === "rose-petals"
          ? ["#FFB7C5", "#FF8FAB", "#E8A7B1", "#FFC0CB", "#fda4af"]
          : ["#FFB7C5", "#C7CEEA", "#B5EAD7", "#FFFFFF", "#E8D5E0"];
        const size = effect === "rose-petals" ? 10 + Math.random() * 14 : 7 + Math.random() * 10;
        const dur = 3000 + Math.random() * 3000;
        const drift = (Math.random() - 0.5) * 60;
        const color = colors[Math.floor(Math.random() * colors.length)];
        const startY = -containerH * 0.08;
        const totalFall = containerH * 1.16;
        el.style.cssText = `
          position:absolute; pointer-events:none; z-index:10;
          left:${Math.random() * 100}%;
          top:0;
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
          const y = startY + t * totalFall;
          const x = drift * Math.sin(t * Math.PI * 2);
          const rot = spin * t;
          el.style.transform = `translateY(${y}px) translateX(${x}px) rotate(${rot}deg)`;
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
        const startY = -containerH * 0.05;
        const totalFall = containerH * 1.1;
        el.style.cssText = `
          position:absolute; pointer-events:none; z-index:10;
          left:${Math.random() * 100}%;
          top:0;
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
          const y = startY + t * totalFall;
          const x = drift * t;
          el.style.transform = `translateY(${y}px) translateX(${x}px)`;
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
        const startY = -containerH * 0.05;
        const totalFall = containerH * 1.1;
        el.style.cssText = `
          position:absolute; pointer-events:none; z-index:10;
          left:${Math.random() * 100}%;
          top:0;
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
          const y = startY + t * totalFall;
          const x = drift * t;
          const rot = spin * t;
          el.style.transform = `translateY(${y}px) translateX(${x}px) rotate(${rot}deg)`;
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
        const size = isGolden ? 40 + Math.random() * 60 : 20 + Math.random() * 40;
        const posX = Math.random() * 100;
        const posY = Math.random() * 100;
        const dur = 5000 + Math.random() * 8000;
        // Golden hour: use warm WHITE / cream so they contrast against the amber background
        // (amber-on-amber is invisible; white-on-amber reads as a sunlit glow)
        const colors = isGolden
          ? ["rgba(255,255,255,0.55)", "rgba(255,252,220,0.50)", "rgba(255,245,180,0.45)"]
          : ["rgba(255,200,160,0.22)", "rgba(255,150,130,0.18)", "rgba(255,220,100,0.15)"];
        const color = colors[Math.floor(Math.random() * colors.length)];
        const driftX = (Math.random() - 0.5) * 40;
        el.style.cssText = `
          position:absolute; pointer-events:none; z-index:10;
          left:${posX}%; top:${posY}%;
          width:${size}px; height:${size}px;
          background:radial-gradient(circle, ${color} 0%, transparent 70%);
          border-radius:50%;
          filter:blur(${isGolden ? 4 : 2}px);
          transform:translate(-50%,-50%);
        `;
        container.appendChild(el);
        const startTime = Date.now();
        function frame() {
          if (!active) return;
          const t = (Date.now() - startTime) / dur;
          if (t >= 1) { el.remove(); return; }
          const driftY = isGolden ? -30 * Math.sin(t * Math.PI) : -10 * Math.sin(t * Math.PI);
          el.style.transform = `translate(calc(-50% + ${driftX * Math.sin(t * Math.PI)}px), calc(-50% + ${driftY}px))`;
          const opacity = Math.sin(t * Math.PI);
          el.style.opacity = String(Math.max(0, opacity * (isGolden ? 1 : 0.9)));
          requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
        return;
      } else if (effect === "florals") {
        const emojis = ["🌸", "🌺", "🌷", "💐", "🌸", "🌺"];
        const emoji = emojis[Math.floor(Math.random() * emojis.length)];
        const size = 20 + Math.random() * 16;
        const dur = 3500 + Math.random() * 3000;
        const drift = (Math.random() - 0.5) * 55;
        const spin = (Math.random() - 0.5) * 180;
        const startY = -containerH * 0.08;
        const totalFall = containerH * 1.16;
        el.style.cssText = `
          position:absolute; pointer-events:none; z-index:10;
          left:${Math.random() * 100}%;
          top:0;
          font-size:${size}px;
          line-height:1;
          user-select:none;
          opacity:0.85;
        `;
        el.textContent = emoji;
        container.appendChild(el);
        const startTime = Date.now();
        function frame() {
          if (!active) return;
          const t = (Date.now() - startTime) / dur;
          if (t >= 1) { el.remove(); return; }
          const y = startY + t * totalFall;
          const x = drift * Math.sin(t * Math.PI * 1.5);
          const rot = spin * t;
          el.style.transform = `translateY(${y}px) translateX(${x}px) rotate(${rot}deg)`;
          el.style.opacity = String(t > 0.8 ? (1 - t) * 5 * 0.85 : 0.85);
          requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
        return;
      } else if (effect === "embers") {
        const emberColors = ["#FF8C00","#E06000","#FFA53A","#FFD060","#FF5500","#FFB347"];
        const color = emberColors[Math.floor(Math.random() * emberColors.length)];
        const size = 2 + Math.random() * 4;
        const dur = 3000 + Math.random() * 3000;
        const drift = (Math.random() - 0.5) * 35;
        const startY = containerH + 6;
        el.style.cssText = `
          position:absolute; pointer-events:none; z-index:10;
          left:${Math.random() * 100}%;
          top:${startY}px;
          width:${size}px; height:${size}px;
          background:radial-gradient(circle, ${color} 0%, ${color}88 50%, transparent 100%);
          border-radius:50%;
          box-shadow:0 0 ${size * 2}px ${color}AA;
        `;
        container.appendChild(el);
        const startTime = Date.now();
        function frame() {
          if (!active) return;
          const t = (Date.now() - startTime) / dur;
          if (t >= 1 || parseFloat(el.style.top) < -10) { el.remove(); return; }
          const progress = startY - t * (containerH * 1.15);
          const x = drift * Math.sin(t * Math.PI * 2.5);
          const alpha = t < 0.1 ? t * 10 : t > 0.65 ? (1 - t) / 0.35 : 1;
          el.style.top = `${progress}px`;
          el.style.transform = `translateX(${x}px)`;
          el.style.opacity = String(alpha * 0.9);
          requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
        return;
      } else if (effect === "sparks") {
        const sparkColors = ["#00D4FF","#FF6B00","#FF0080","#00FF88","#FFD700","#BF5AF2","#FFFFFF"];
        const color = sparkColors[Math.floor(Math.random() * sparkColors.length)];
        const size = 2 + Math.random() * 3.5;
        const dur = 800 + Math.random() * 1200;
        const vx = (Math.random() - 0.5) * containerH * 0.4;
        const vy = -(containerH * (0.2 + Math.random() * 0.5));
        const startX = Math.random() * 100;
        const startY = 80 + Math.random() * 20;
        el.style.cssText = `
          position:absolute; pointer-events:none; z-index:10;
          left:${startX}%; top:${startY}%;
          width:${size}px; height:${size}px;
          background:${color};
          border-radius:50%;
          box-shadow:0 0 ${size * 3}px ${color};
        `;
        container.appendChild(el);
        const startTime = Date.now();
        function frame() {
          if (!active) return;
          const t = (Date.now() - startTime) / dur;
          if (t >= 1) { el.remove(); return; }
          const easedT = 1 - Math.pow(1 - t, 2);
          const x = vx * easedT;
          const y = vy * easedT + 0.5 * 980 * t * t * (containerH / 400);
          const alpha = t < 0.1 ? t * 10 : 1 - t;
          el.style.transform = `translate(${x}px, ${y}px)`;
          el.style.opacity = String(Math.max(0, alpha));
          requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
        return;
      }
    }

    if (!effect) return;

    const interval = effect === "stars" || effect === "bokeh" ? 600 :
                     effect === "florals" ? 500 :
                     effect === "snow" ? 200 :
                     effect === "confetti" ? 250 :
                     effect === "embers" ? 350 :
                     effect === "sparks" ? 280 : 400;

    const batchSize = effect === "snow" ? 3 :
                      effect === "stars" || effect === "bokeh" ? 1 :
                      effect === "florals" ? 1 :
                      effect === "embers" ? 2 :
                      effect === "sparks" ? 2 : 2;

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
    <div className="hidden lg:block w-[340px] flex-shrink-0">
      <div className="sticky top-24 flex flex-col items-center">
        <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-widest mb-3 text-center">
          Choose the mood
        </p>
        <div className="w-full rounded-[2.25rem] p-[3px] ring-1 ring-black/10 shadow-[0_32px_80px_rgba(0,0,0,0.22)]" style={{ background: "rgba(0,0,0,0.06)" }}>
          {/* 3-dot notch */}
          <div className="flex items-center justify-center gap-1 py-2">
            <div className="w-1.5 h-1.5 rounded-full bg-black/20" />
            <div className="w-4 h-1.5 rounded-full bg-black/20" />
            <div className="w-1.5 h-1.5 rounded-full bg-black/20" />
          </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={experience.id}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="w-full rounded-[2rem] overflow-hidden relative"
            style={{ aspectRatio: "9/16", background: `linear-gradient(155deg, ${experience.palette.from}, ${experience.palette.via}, ${experience.palette.to})` }}
          >
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

            {/* Ambient particles — rendered after overlay so they appear on top */}
            <AmbientParticles experienceId={experience.id} />

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
        </div>

        <div className="mt-4 text-center">
          <p className="text-sm font-semibold text-foreground">{experience.name}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{experience.tagline}</p>
        </div>
      </div>
    </div>
  );
}

// ─── "Continue on phone" QR card ─────────────────────────────────────────────

interface ContinueOnPhoneProps {
  recipientName: string;
  senderName: string;
  recipientPhone: string;
  occasion: string;
  selectedExperience: string;
  giftTitle: string;
  personalNote: string;
  extraLinks: Array<{url: string; label: string}>;
  amount: string;
  intent: string;
  scheduledFor: string;
  scheduledTime: string;
}

function ContinueOnPhone(props: ContinueOnPhoneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  const QR_SIZE = 160; // CSS display size in px

  useEffect(() => {
    if (!canvasRef.current) return;
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    // Keep payload lean — phone just needs to reach step 3 for camera roll uploads.
    // Long text (note/title) stays on desktop; links omitted to keep QR scannable.
    const payload: Record<string, unknown> = {
      r: props.recipientName,
      s: props.senderName,
      occ: props.occasion,
      exp: props.selectedExperience,
      amt: props.amount,
      int: props.intent,
      step: 3,
    };
    if (props.recipientPhone) payload.p = props.recipientPhone;
    if (props.scheduledFor)   payload.sf = props.scheduledFor;
    if (props.scheduledTime)  payload.st = props.scheduledTime;
    // Include title/note only if short enough to keep the QR scannable
    if (props.giftTitle && props.giftTitle.length <= 80)   payload.title = props.giftTitle;
    if (props.personalNote && props.personalNote.length <= 200) payload.note = props.personalNote;
    try {
      const encoded = btoa(encodeURIComponent(JSON.stringify(payload)));
      const continueUrl = `https://gifted.page${base}/create?draft=${encoded}`;
      // 'M' error correction (15%) keeps modules large enough to scan at 160px display size.
      // Render 2× internally for HiDPI crispness; CSS pins the display size.
      const renderSize = QR_SIZE * 2;
      QRCodeLib.toCanvas(canvasRef.current, continueUrl, {
        width: renderSize,
        margin: 2,
        color: { dark: "#000000", light: "#ffffff" },
        errorCorrectionLevel: 'M',
      }).then(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const size = canvas.width;
        const rectW = size * 0.38;
        const rectH = size * 0.16;
        const rectX = (size - rectW) / 2;
        const rectY = (size - rectH) / 2;
        const radius = rectH * 0.25;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(rectX + radius, rectY);
        ctx.lineTo(rectX + rectW - radius, rectY);
        ctx.quadraticCurveTo(rectX + rectW, rectY, rectX + rectW, rectY + radius);
        ctx.lineTo(rectX + rectW, rectY + rectH - radius);
        ctx.quadraticCurveTo(rectX + rectW, rectY + rectH, rectX + rectW - radius, rectY + rectH);
        ctx.lineTo(rectX + radius, rectY + rectH);
        ctx.quadraticCurveTo(rectX, rectY + rectH, rectX, rectY + rectH - radius);
        ctx.lineTo(rectX, rectY + radius);
        ctx.quadraticCurveTo(rectX, rectY, rectX + radius, rectY);
        ctx.closePath();
        ctx.fill();
        const fontSize = Math.round(size * 0.075);
        ctx.font = `bold ${fontSize}px Georgia, serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        const totalW = ctx.measureText('gifted.').width;
        const startX = size / 2 - totalW / 2;
        const midY = size / 2;
        ctx.fillStyle = '#000000';
        ctx.fillText('gifted', startX, midY);
        const giftedW = ctx.measureText('gifted').width;
        ctx.fillStyle = 'hsl(28,62%,36%)';
        ctx.fillText('.', startX + giftedW, midY);
        setReady(true);
      }).catch(() => {});
    } catch { /* ignore */ }
  }, [props.recipientName, props.senderName, props.recipientPhone, props.occasion, props.selectedExperience, props.giftTitle, props.personalNote, props.extraLinks, props.amount, props.intent, props.scheduledFor, props.scheduledTime]);

  return (
    <div className="hidden md:flex items-center gap-4 rounded-2xl border border-primary/20 bg-primary/5 p-4 mb-5 overflow-hidden">
      {/* QR code — fixed size, never expands */}
      <div className="shrink-0" style={{ width: QR_SIZE, height: QR_SIZE }}>
        {!ready && (
          <div
            className="rounded-xl bg-muted animate-pulse"
            style={{ width: QR_SIZE, height: QR_SIZE }}
          />
        )}
        <div
          className="rounded-xl border border-border bg-white p-1.5 overflow-hidden"
          style={{
            width: QR_SIZE,
            height: QR_SIZE,
            minWidth: QR_SIZE,
            opacity: ready ? 1 : 0,
            position: ready ? "static" : "absolute",
            pointerEvents: ready ? "auto" : "none",
            transition: "opacity 0.3s ease",
          }}
        >
          <canvas
            ref={canvasRef}
            style={{ display: "block", width: "100%", height: "100%", maxWidth: QR_SIZE - 12, maxHeight: QR_SIZE - 12 }}
          />
        </div>
      </div>

      {/* Text — takes remaining space, truncates safely */}
      <div className="flex-1 min-w-0 overflow-hidden">
        <div className="flex items-center gap-2 mb-1">
          <Smartphone className="w-4 h-4 text-primary shrink-0" />
          <p className="text-sm font-semibold text-foreground leading-tight">Your camera roll is on your phone</p>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Scan this QR code to open gifted. on your phone — everything you've filled in so far will be waiting for you, right at the video &amp; photo step.
        </p>
        <p className="text-xs text-muted-foreground/60 mt-2">
          Or keep going here and upload files from this computer ↓
        </p>
      </div>
    </div>
  );
}

// ─── Sortable photo item ──────────────────────────────────────────────────────

function SortablePhoto({ photo, onRemove }: { photo: PhotoItem; onRemove: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: photo.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : undefined,
  };
  return (
    <div ref={setNodeRef} style={style} className="relative aspect-square rounded-xl overflow-hidden group touch-none">
      <img src={photo.previewUrl} alt="Uploaded photo" className="w-full h-full object-cover" />
      <div
        {...attributes}
        {...listeners}
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
        aria-label="Drag to reorder"
      />
      <div className="absolute top-1 left-1 w-5 h-5 rounded-md bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <GripVertical className="w-3 h-3 text-white" />
      </div>
      <button
        type="button"
        onClick={() => onRemove(photo.id)}
        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-destructive transition-colors z-10"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CreatePage() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, user } = useAuth();

  // Step state
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);
  const [stepError, setStepError] = useState<string | null>(null);
  const [showEmptyMomentWarning, setShowEmptyMomentWarning] = useState(false);

  // Cycling link label word
  const [linkLabelIdx, setLinkLabelIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setLinkLabelIdx(i => (i + 1) % LINK_LABEL_WORDS.length), 2600);
    return () => clearInterval(id);
  }, []);

  // Gift state
  const [selectedExperience, setSelectedExperience] = useState(() => getSuggestedExperience("Birthday"));
  const [suggestedExperience, setSuggestedExperience] = useState(() => getSuggestedExperience("Birthday"));
  const [hasManuallyChosen, setHasManuallyChosen] = useState(false);
  const [amount, setAmount] = useState("");
  const [customAmountInput, setCustomAmountInput] = useState("");
  const [intent, setIntent] = useState("");
  const [customIntentMode, setCustomIntentMode] = useState(false);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [isGroup, setIsGroup] = useState(false);
  const [scheduledFor, setScheduledFor] = useState("");
  const [scheduledTime, setScheduledTime] = useState("09:00");
  const [occasion, setOccasion] = useState("Birthday");
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [quickContacts, setQuickContacts] = useState<Array<{ id: string; name: string; phone: string | null }>>([]);
  const [showAllContacts, setShowAllContacts] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [phoneValidating, setPhoneValidating] = useState(false);
  const [senderName, setSenderName] = useState("");
  const [giftTitle, setGiftTitle] = useState("");
  const [personalNote, setPersonalNote] = useState("");
  const [extraLinks, setExtraLinks] = useState<Array<{url: string; label: string}>>([{url: "", label: ""}]);
  const [linkErrors, setLinkErrors] = useState<Record<number, string>>({});
  const [labelErrors, setLabelErrors] = useState<Record<number, string>>({});
  const [aiLoading, setAiLoading] = useState<"rewrite" | "regenerate" | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showAiGlow, setShowAiGlow] = useState(false);
  const [showNudge, setShowNudge] = useState(false);
  const [noteWasUserAuthored, setNoteWasUserAuthored] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const submittingRef = useRef(false);

  // Edit mode — set when launched with ?edit_gift_id=GIFT_ID from the preview page
  const [editGiftId,     setEditGiftId]     = useState<string | null>(null);
  const [editGiftPaid,   setEditGiftPaid]   = useState(false);
  const [editGiftAmount, setEditGiftAmount] = useState<string | null>(null);
  const [editSaving,     setEditSaving]     = useState(false);

  // Sender notification phone — used by scheduler to text the sender when scheduled gift fires
  // Pre-filled from user account (persistent) or localStorage (fallback for non-users)
  const [senderNotifyPhone, setSenderNotifyPhone] = useState(() =>
    localStorage.getItem("gifted_sender_phone") ?? ""
  );

  // Once auth loads, prefer the account phone over localStorage
  useEffect(() => {
    if (user?.phone && !senderNotifyPhone) {
      setSenderNotifyPhone(formatPhoneNumber(user.phone));
    }
  }, [user?.phone]);

  // Physical gift tracking state
  const [trackingCarrier, setTrackingCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingOpen, setTrackingOpen] = useState(false);
  const [trackingStatus, setTrackingStatus] = useState<"idle" | "checking" | "valid" | "invalid" | "warn">("idle");
  const [trackingMessage, setTrackingMessage] = useState("");

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
  const isTestMode = new URLSearchParams(window.location.search).get("test") === "true";

  useEffect(() => {
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");

    // Capture utm_content for conversion tracking.
    // localStorage is the fast path (same device/browser).
    // Server-side pendingAcquisitionSource is the cross-device fallback —
    // written on every click so the most-recent email signal always wins.
    const utmParams = new URLSearchParams(window.location.search);
    const utmContent = utmParams.get("utm_content");
    if (utmContent && !localStorage.getItem("gifted_acquisition_source")) {
      localStorage.setItem("gifted_acquisition_source", utmContent);
    }
    const validSources = ["drip1", "drip2", "drip3", "abandoned_nudge", "digest"];
    if (utmContent && validSources.includes(utmContent)) {
      fetch(`${base}/api/gifted/acquisition-source`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ utmContent }),
      }).catch(() => {});
    }

    // ── Edit mode: ?edit_gift_id=GIFT_ID ────────────────────────────────────
    // Launched from preview.tsx when sender wants to edit an already-created gift.
    // Skip the hasPaidUnshared guard and localStorage restore — fetch the gift
    // directly from the API and pre-fill all fields.
    const urlParams = new URLSearchParams(window.location.search);
    const editId = urlParams.get("edit_gift_id");
    if (editId) {
      setEditGiftId(editId);
      // Remove the param from the URL without reloading
      window.history.replaceState({}, "", window.location.pathname);
      fetch(`${base}/api/gifted/gifts/${editId}`, { credentials: "include" })
        .then(r => r.json())
        .then((gift: Record<string, unknown>) => {
          if (typeof gift.recipientName === "string") setRecipientName(gift.recipientName);
          if (typeof gift.senderName    === "string") setSenderName(gift.senderName);
          if (typeof gift.occasion      === "string") setOccasion(gift.occasion);
          if (typeof gift.giftTitle     === "string") setGiftTitle(gift.giftTitle);
          if (typeof gift.personalNote  === "string") setPersonalNote(gift.personalNote);
          if (typeof gift.recipientPhone === "string") setRecipientPhone(gift.recipientPhone);
          if (typeof gift.experience === "string" && EXPERIENCE_LIST.find(e => e.id === gift.experience)) {
            setSelectedExperience(gift.experience as ExperienceId);
            setSuggestedExperience(gift.experience as ExperienceId);
            setHasManuallyChosen(true);
          }
          if (Array.isArray(gift.extraLinks) && gift.extraLinks.length > 0) {
            const normalized = (gift.extraLinks as Array<{url: string; label: string}>).map(l =>
              typeof l === "string" ? { url: l, label: "" } : l
            );
            setExtraLinks([...normalized, { url: "", label: "" }]);
          }
          if (typeof gift.videoPath === "string") {
            setVideoObjectPath(gift.videoPath);
            setVideoPreviewUrl(`${base}/api/storage${gift.videoPath}`);
          }
          if (Array.isArray(gift.photoPaths) && gift.photoPaths.length > 0) {
            const photoItems = (gift.photoPaths as string[]).map(p => ({
              id: crypto.randomUUID(),
              objectPath: p,
              previewUrl: `${base}/api/storage${p}`,
            }));
            setPhotos(photoItems);
          }
          if (gift.paid) {
            setEditGiftPaid(true);
            if (typeof gift.amount === "string" && parseFloat(gift.amount) > 0) {
              setEditGiftAmount(gift.amount);
            }
          } else {
            // Not yet paid — allow editing amount freely
            if (typeof gift.amount === "string" && parseFloat(gift.amount) > 0) {
              setAmount(gift.amount);
              if (!AMOUNTS.includes(gift.amount)) setCustomAmountInput(gift.amount);
            }
          }
          if (typeof gift.scheduledFor === "string") {
            // Convert UTC back to Eastern for display
            const sfDate = new Date(gift.scheduledFor as string);
            const etParts = new Intl.DateTimeFormat("en-US", {
              timeZone: "America/New_York",
              year: "numeric", month: "2-digit", day: "2-digit",
              hour: "2-digit", minute: "2-digit", hour12: false,
            }).formatToParts(sfDate);
            const y  = etParts.find(p => p.type === "year")?.value   ?? "";
            const m  = etParts.find(p => p.type === "month")?.value  ?? "";
            const d  = etParts.find(p => p.type === "day")?.value    ?? "";
            const h  = etParts.find(p => p.type === "hour")?.value   ?? "09";
            const mi = etParts.find(p => p.type === "minute")?.value ?? "00";
            setScheduledFor(`${y}-${m}-${d}`);
            setScheduledTime(`${h}:${mi}`);
            setScheduleEnabled(true);
          }
        })
        .catch(() => {});
      return; // skip normal init path
    }

    // If the user has a paid gift that hasn't been shared yet, redirect back to
    // the preview confirmation screen. This prevents accidentally creating a
    // duplicate gift (and being double-charged) after hitting the back button
    // or clicking "Build a moment" before sharing the first paid gift.
    // Once the link is shared (gifted_link_shared is set) we allow a fresh start.
    const hasPaidUnshared =
      localStorage.getItem("gifted_paid_id") &&
      !localStorage.getItem("gifted_link_shared");
    if (hasPaidUnshared) {
      setLocation("/preview");
      return;
    }
    // Clear any completed-gift state from a prior gift so the preview page
    // cannot accidentally restore a stale gift ID into this new session.
    resetCompletedGiftState();

    // ── Restore from ?draft= QR handoff (mobile continuation) ──────────────
    try {
      const params = new URLSearchParams(window.location.search);
      const draftParam = params.get("draft");
      if (draftParam) {
        const payload = JSON.parse(decodeURIComponent(atob(draftParam)));
        if (payload.r) setRecipientName(payload.r);
        if (payload.s) setSenderName(payload.s);
        if (payload.p) setRecipientPhone(payload.p);
        if (payload.occ) setOccasion(payload.occ);
        if (payload.exp && EXPERIENCE_LIST.find(e => e.id === payload.exp)) {
          setSelectedExperience(payload.exp as ExperienceId);
          setSuggestedExperience(payload.exp as ExperienceId);
          setHasManuallyChosen(true);
        }
        if (payload.title) setGiftTitle(payload.title);
        if (payload.note) setPersonalNote(payload.note);
        if (Array.isArray(payload.links) && payload.links.length > 0) {
          setExtraLinks([...payload.links, { url: "", label: "" }]);
        }
        if (payload.amt && parseFloat(payload.amt) > 0) {
          setAmount(payload.amt);
          if (!AMOUNTS.includes(payload.amt)) setCustomAmountInput(payload.amt);
        }
        if (payload.int) setIntent(payload.int);
        if (payload.sf) { setScheduledFor(payload.sf); setScheduleEnabled(true); }
        if (payload.st) setScheduledTime(payload.st);
        if (payload.step === 3) { setStep(3); }
        // Remove ?draft= from URL without reloading
        const clean = window.location.pathname + window.location.hash;
        window.history.replaceState({}, "", clean);
        return; // skip localStorage restore — draft is the source of truth
      }
    } catch { /* malformed draft param — fall through to localStorage */ }

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
      try {
        const parsed = JSON.parse(el);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const normalized = parsed.map((item: string | {url: string; label: string}) =>
            typeof item === "string" ? { url: item, label: "" } : item
          );
          setExtraLinks([...normalized, {url: "", label: ""}]);
        }
      } catch { /* ignore */ }
    } else {
      const pl = localStorage.getItem("gifted_playlist_url");
      if (pl) setExtraLinks([{url: pl, label: ""}, {url: "", label: ""}]);
    }
    const amt = localStorage.getItem("gifted_amount");
    if (amt && parseFloat(amt) > 0) {
      setAmount(amt);
      if (!AMOUNTS.includes(amt)) setCustomAmountInput(amt);
    }
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
    const tc = localStorage.getItem("gifted_tracking_carrier");
    if (tc) { setTrackingCarrier(tc); setTrackingOpen(true); }
    const tn = localStorage.getItem("gifted_tracking_number");
    if (tn) setTrackingNumber(tn);

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

  // Auto-save key form fields to localStorage as the user types so that
  // navigating away mid-build (e.g. opening a new tab to look up a link)
  // never loses their work. Skips the very first run so we don't overwrite
  // localStorage with empty state before the mount restore above settles.
  const autoSaveRestoredRef = useRef(false);
  const autoSaveTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!autoSaveRestoredRef.current) {
      autoSaveRestoredRef.current = true;
      return;
    }
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      if (recipientName) localStorage.setItem("gifted_recipient_name", recipientName);
      else localStorage.removeItem("gifted_recipient_name");
      if (senderName) localStorage.setItem("gifted_sender_name", senderName);
      else localStorage.removeItem("gifted_sender_name");
      if (recipientPhone) localStorage.setItem("gifted_recipient_phone", recipientPhone);
      else localStorage.removeItem("gifted_recipient_phone");
      if (giftTitle.trim()) localStorage.setItem("gifted_gift_title", giftTitle.trim());
      else localStorage.removeItem("gifted_gift_title");
      if (personalNote.trim()) localStorage.setItem("gifted_personal_note", personalNote.trim());
      else localStorage.removeItem("gifted_personal_note");
      if (amount && parseFloat(amount) > 0) localStorage.setItem("gifted_amount", amount);
      else localStorage.removeItem("gifted_amount");
      if (intent) localStorage.setItem("gifted_intent", intent);
      else localStorage.removeItem("gifted_intent");
      localStorage.setItem("gifted_occasion", occasion);
      localStorage.setItem("gifted_experience", selectedExperience);
      const nonEmptyLinks = extraLinks.filter(l => l.url.trim());
      if (nonEmptyLinks.length > 0) {
        localStorage.setItem("gifted_extra_links", JSON.stringify(
          nonEmptyLinks.map(l => ({ url: l.url.trim(), label: l.label.trim() }))
        ));
      } else {
        localStorage.removeItem("gifted_extra_links");
      }
    }, 500);
    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); };
  }, [recipientName, senderName, recipientPhone, giftTitle, personalNote, amount, intent, occasion, selectedExperience, extraLinks]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch contacts for quick-pick chips when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    fetch(`${base}/api/gifted/contacts`, { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then((rows: Array<{ id: string; name: string; phone?: string | null }>) => {
        setQuickContacts(rows.map(c => ({ id: c.id, name: c.name, phone: c.phone ?? null })));
      })
      .catch(() => {});
  }, [isAuthenticated]);


  // Pre-fill sender name from saved profile (only when the field is still empty)
  useEffect(() => {
    if (!isAuthenticated) return;
    const apiBase = import.meta.env.BASE_URL.replace(/\/$/, "");
    fetch(`${apiBase}/api/gifted/profile`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then((data: { displayName: string | null } | null) => {
        if (data?.displayName) {
          setSenderName(prev => prev.trim() ? prev : data.displayName!);
        }
      })
      .catch(() => {});
  }, [isAuthenticated]);

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
      setVideoError("This video exceeds the 200 MB limit. Please choose a shorter or lower-quality clip.");
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

  const photoSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

  const handlePhotoDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setPhotos((prev) => {
        const oldIdx = prev.findIndex((p) => p.id === active.id);
        const newIdx = prev.findIndex((p) => p.id === over.id);
        return arrayMove(prev, oldIdx, newIdx);
      });
    }
  };

  // Debounced tracking number verification
  useEffect(() => {
    if (!trackingCarrier || !trackingNumber || trackingNumber.length < 6) {
      setTrackingStatus("idle");
      setTrackingMessage("");
      return;
    }
    setTrackingStatus("checking");
    const timer = setTimeout(async () => {
      try {
        const base = import.meta.env.BASE_URL.replace(/\/$/, "");
        const res = await fetch(`${base}/api/gifted/tracking/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ carrier: trackingCarrier, trackingNumber }),
        });
        const data = await res.json() as { valid: boolean | null; message: string };
        if (data.valid === true) setTrackingStatus("valid");
        else if (data.valid === false) setTrackingStatus("invalid");
        else setTrackingStatus("warn");
        setTrackingMessage(data.message ?? "");
      } catch {
        setTrackingStatus("warn");
        setTrackingMessage("Couldn't verify right now — you can still save the gift.");
      }
    }, 900);
    return () => clearTimeout(timer);
  }, [trackingCarrier, trackingNumber]);

  const saveToLocalStorage = () => {
    localStorage.removeItem("gifted_paid_id");
    if (trackingCarrier && trackingNumber) {
      localStorage.setItem("gifted_tracking_carrier", trackingCarrier);
      localStorage.setItem("gifted_tracking_number", trackingNumber);
    } else {
      localStorage.removeItem("gifted_tracking_carrier");
      localStorage.removeItem("gifted_tracking_number");
    }
    if (videoObjectPath) localStorage.setItem("gifted_video_path", videoObjectPath);
    else localStorage.removeItem("gifted_video_path");
    if (photos.length > 0) localStorage.setItem("gifted_photo_paths", JSON.stringify(photos.map((p) => p.objectPath)));
    else localStorage.removeItem("gifted_photo_paths");
    if (personalNote.trim()) localStorage.setItem("gifted_personal_note", personalNote.trim());
    else localStorage.removeItem("gifted_personal_note");
    const nonEmptyLinks = extraLinks.filter(l => l.url.trim()).map(l => ({ url: autoCorrectUrl(l.url.trim()), label: l.label.trim() }));
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

  const validatePhone = async (phone: string): Promise<boolean> => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) return true;
    setPhoneValidating(true);
    try {
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${base}/api/gifted/validate-phone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      if (!res.ok) return true;
      const data = await res.json();
      if (data.valid === false) {
        setPhoneError("This number doesn't appear to be valid. Please double-check it.");
        return false;
      }
      setPhoneError(null);
      return true;
    } catch {
      return true;
    } finally {
      setPhoneValidating(false);
    }
  };

  const handlePhoneBlur = async () => {
    const digits = recipientPhone.replace(/\D/g, "");
    if (digits.length < 10) return;
    await validatePhone(recipientPhone);
  };

  const handlePreview = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    try {
    if (isUploading) {
      setStepError("Please wait — your video is still uploading.");
      return;
    }
    const filledLinks = extraLinks.filter(l => l.url.trim());
    const newErrors: Record<number, string> = {};
    extraLinks.forEach((link, idx) => {
      const raw = link.url.trim();
      if (!raw) return;
      if (!isValidUrl(raw)) {
        newErrors[idx] = "This doesn't look like a valid URL — please check it.";
      }
    });
    if (Object.keys(newErrors).length > 0) {
      setLinkErrors(newErrors);
      setStepError("Some links look invalid — please fix them before continuing.");
      return;
    }
    const newLabelErrors: Record<number, string> = {};
    extraLinks.forEach((link, idx) => {
      if (link.url.trim() && !link.label.trim()) {
        newLabelErrors[idx] = "Add a label so they know what this link is.";
      }
    });
    if (Object.keys(newLabelErrors).length > 0) {
      setLabelErrors(newLabelErrors);
      setStepError("Each link needs a label — scroll up to fill them in.");
      return;
    }
    if (amount && parseFloat(amount) > 0 && parseFloat(amount) < 10) {
      setStepError("The minimum gift balance is $10. Choose $10 or more, or leave it blank.");
      return;
    }
    if (amount && parseFloat(amount) >= 10) {
      if (!recipientPhone.trim()) {
        setStepError("A phone number is required to protect the cash balance — add it above.");
        return;
      }
      const isIntlRecipient = recipientPhone.trimStart().startsWith("+");
      if (!isIntlRecipient && recipientPhone.replace(/\D/g, "").length < 10) {
        setStepError("Please enter a complete phone number. For international numbers, start with +.");
        return;
      }
    }
    if (recipientPhone.replace(/\D/g, "").length >= 7) {
      const valid = await validatePhone(recipientPhone);
      if (!valid) {
        setStepError("The phone number doesn't appear to be valid. Please check it above.");
        return;
      }
    }
    if (scheduleEnabled && !scheduledFor) {
      setStepError("Please pick a delivery date, or switch back to \"Send now\".");
      return;
    }
    saveToLocalStorage();

    setIsCreating(true);
    setEditSaving(true);
    setStepError(null);
    try {
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");

      const nonEmptyLinks = extraLinks.filter(l => l.url.trim()).map(l => ({
        url: l.url.trim(),
        label: l.label.trim(),
      }));

      // ── Edit mode: PATCH content fields, skip payment entirely ──────────────
      if (editGiftId) {
        const patchPayload: Record<string, unknown> = {
          recipientName,
          senderName,
          experience: selectedExperience,
          occasion,
          giftTitle: giftTitle.trim() || giftTitle,
          personalNote: personalNote.trim() || null,
          extraLinks: nonEmptyLinks,
        };
        if (recipientPhone) patchPayload.recipientPhone = recipientPhone;
        if (videoObjectPath) patchPayload.videoPath = videoObjectPath;
        if (photos.length > 0) patchPayload.photoPaths = photos.map(p => p.objectPath);

        const patchRes = await fetch(`${base}/api/gifted/gifts/${editGiftId}/content`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(patchPayload),
        });

        if (!patchRes.ok) {
          const err = await patchRes.json().catch(() => ({})) as { error?: string };
          throw new Error(err.error || "Failed to save changes");
        }

        setLocation(`/preview?gift_id=${editGiftId}`);
        return;
      }

      // ── Normal create flow ───────────────────────────────────────────────────
      let iKey = localStorage.getItem("gifted_create_ikey");
      if (!iKey) {
        iKey = crypto.randomUUID();
        localStorage.setItem("gifted_create_ikey", iKey);
      }

      // Normalize sender notify phone — prefer state (which seeds from account > localStorage)
      const isIntlSender = senderNotifyPhone.trimStart().startsWith("+");
      const senderPhoneClean = senderNotifyPhone.replace(/\D/g, "");
      const senderPhone = isIntlSender
        ? (senderPhoneClean.length >= 7 ? `+${senderPhoneClean}` : undefined)
        : senderPhoneClean.length >= 10
          ? (senderPhoneClean.length === 10 ? `+1${senderPhoneClean}` : `+${senderPhoneClean}`)
          : undefined;

      // Persist to localStorage for non-users; also save to account if logged in + phone changed
      if (senderPhone) {
        localStorage.setItem("gifted_sender_phone", senderNotifyPhone);
        if (isAuthenticated && senderNotifyPhone !== (user?.phone ?? "")) {
          fetch(`${base}/api/auth/profile`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ phone: senderNotifyPhone }),
          }).catch(() => {});
        }
      }

      const payload: Record<string, unknown> = {
        recipientName,
        senderName,
        experience: selectedExperience,
        occasion,
        giftTitle: giftTitle.trim() || giftTitle,
        idempotencyKey: iKey,
      };
      if (recipientPhone) payload.recipientPhone = recipientPhone;
      if (senderPhone) payload.senderPhone = senderPhone;
      if (personalNote.trim()) payload.personalNote = personalNote.trim();
      if (videoObjectPath) payload.videoPath = videoObjectPath;
      if (photos.length > 0) payload.photoPaths = photos.map(p => p.objectPath);
      if (nonEmptyLinks.length > 0) payload.extraLinks = nonEmptyLinks;
      if (amount && parseFloat(amount) > 0) payload.amount = amount;
      if (intent) payload.intent = intent;
      if (scheduleEnabled && scheduledFor) payload.scheduledFor = `${scheduledFor}T${scheduledTime}:00`;
      if (trackingCarrier && trackingNumber) {
        payload.trackingCarrier = trackingCarrier;
        payload.trackingNumber = trackingNumber;
      }
      if (isTestMode) payload.isTest = true;
      if (isGroup) payload.isGroup = true;
      payload.hasPersonalTouch = noteWasUserAuthored || !!videoObjectPath || photos.length > 0;

      const res = await fetch(`${base}/api/gifted/gifts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to create gift");

      const { id } = await res.json() as { id: string };
      localStorage.setItem("gifted_gift_id", id);

      setLocation("/preview");
    } catch (err) {
      setStepError(err instanceof Error ? err.message : "Something went wrong — please try again.");
      setIsCreating(false);
      setEditSaving(false);
    }
    } finally {
      submittingRef.current = false;
    }
  };

  const handleAI = async (mode: "rewrite" | "regenerate", personalDetail?: string) => {
    if (!recipientName || !senderName || !occasion) {
      setAiError("Please fill in the recipient and sender names on the previous step first.");
      setTimeout(() => setAiError(null), 4000);
      return;
    }
    const noteToRewrite = personalNote;
    setAiLoading(mode);
    setAiError(null);
    setShowAiGlow(false);
    setShowNudge(false);
    let generated = "";
    setPersonalNote("");
    try {
      await streamAINote(
        { currentNote: mode === "rewrite" ? noteToRewrite : undefined, occasion, recipientName, senderName, intent: intent || undefined, giftTitle: giftTitle || undefined, mode, personalDetail },
        (chunk) => { generated += chunk; setPersonalNote(generated); },
        () => {
          setAiLoading(null);
          setShowAiGlow(true);
          setTimeout(() => setShowAiGlow(false), 2000);
          // Only show the nudge after a pure regenerate with no user input
          if (mode === "regenerate" && !personalDetail && !noteWasUserAuthored) {
            setShowNudge(true);
          }
        },
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
    if (isUploading) {
      setStepError("Please wait — your video is still uploading.");
      return;
    }
    if (step === 1) {
      if (!recipientName.trim()) { setStepError("Please enter the recipient's name."); return; }
      if (!senderName.trim()) { setStepError("Please enter your name."); return; }
    }
    if (step === 2) {
      const hasContent = giftTitle.trim() || personalNote.trim() || videoPreviewUrl || photos.length > 0;
      if (!hasContent && !showEmptyMomentWarning) {
        setShowEmptyMomentWarning(true);
        return;
      }
    }
    setShowEmptyMomentWarning(false);
    const next = step + 1;
    window.history.pushState({ step: next }, "");
    setDirection(1);
    setStep(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goBack = () => {
    setStepError(null);
    setShowEmptyMomentWarning(false);
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
      <GiftRecoveryBanner />

      {/* Test mode banner */}
      {isTestMode && (
        <div className="sticky top-0 z-50 bg-amber-400/15 border-b border-amber-400/30 px-4 py-2.5 flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300 font-medium">
          <span className="text-base">🧪</span>
          Test mode — this gift won't appear in your main feed
        </div>
      )}

      {/* Edit mode banner */}
      {editGiftId && (
        <div className="sticky top-0 z-50 bg-primary/10 border-b border-primary/20 px-4 py-2.5 flex items-center gap-2 text-sm text-primary font-medium">
          <Lock className="w-3.5 h-3.5 shrink-0" />
          Editing gift — balance is locked. Hit "Save changes" when done.
        </div>
      )}

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

      <div className={`mx-auto px-6 py-12 transition-all duration-500 ${step === 1 ? "max-w-6xl" : "max-w-3xl"}`}>

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
              <div className="lg:flex lg:gap-16 lg:items-start">

                {/* Main content */}
                <div className="lg:flex-1 min-w-0">
                  <div className="max-w-xl">

                  {/* Step header */}
                  <div className="mb-8">
                    <h1 className="font-serif text-4xl font-medium mb-2">How should this feel?</h1>
                    <p className="text-muted-foreground">
                      Choose the mood — it shapes every detail of their reveal experience.
                    </p>
                  </div>

                  {/* Mobile mood preview — live animated banner */}
                  <div className="sm:hidden mb-4 relative rounded-2xl overflow-hidden" style={{ height: 120 }}>
                    {/* Gradient layer fades in on experience change */}
                    <motion.div
                      key={selectedExperience}
                      initial={{ opacity: 0.4 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.35 }}
                      className="absolute inset-0"
                      style={{
                        background: `linear-gradient(135deg, ${currentExperience.palette.from}, ${currentExperience.palette.via}, ${currentExperience.palette.to})`,
                      }}
                    />
                    <div className="absolute inset-0 bg-black/10 pointer-events-none" />
                    {/* Particles restart on experience change via key */}
                    <AmbientParticles key={`p-${selectedExperience}`} experienceId={selectedExperience} />
                    {/* Soft pulse overlay */}
                    <motion.div
                      className="absolute inset-0 pointer-events-none"
                      animate={{ opacity: [0.15, 0.4, 0.15] }}
                      transition={{ repeat: Infinity, duration: 3.5, ease: "easeInOut" }}
                      style={{
                        background: currentExperience.isDark
                          ? "radial-gradient(ellipse at 50% 30%, rgba(255,255,255,0.08) 0%, transparent 70%)"
                          : "radial-gradient(ellipse at 50% 30%, rgba(255,255,255,0.22) 0%, transparent 70%)",
                      }}
                    />
                    {/* Name + icon */}
                    <div className="relative z-10 h-full flex items-center justify-center gap-4">
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
                        style={{ background: "rgba(255,255,255,0.2)", backdropFilter: "blur(8px)" }}
                      >
                        <CurrentIcon className={`w-6 h-6 ${currentExperience.isDark ? "text-indigo-200" : "text-white"}`} />
                      </div>
                      <div>
                        <p className="text-white font-semibold text-sm leading-tight">{currentExperience.name}</p>
                        <p className="text-white/70 text-xs mt-0.5">{currentExperience.tagline}</p>
                      </div>
                    </div>
                  </div>

                  {/* Experience grid */}
                  <div className="grid grid-cols-3 sm:grid-cols-3 gap-2.5 sm:gap-3 mb-10">
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
                              ? "ring-[3px] ring-primary ring-offset-2 ring-offset-background scale-[1.04] shadow-xl"
                              : "hover:scale-[1.02] hover:shadow-lg"
                          }`}
                        >
                          <div
                            className="w-full relative flex flex-col items-center justify-center py-4 sm:py-6 gap-1.5 sm:gap-2"
                            style={{
                              background: `linear-gradient(135deg, ${exp.palette.from}, ${exp.palette.via}, ${exp.palette.to})`,
                            }}
                          >
                            <ExpIcon
                              className={`w-5 h-5 sm:w-6 sm:h-6 ${exp.isDark ? "text-indigo-200" : "text-white/90"}`}
                            />

                            {suggestedExperience === exp.id && !isSelected && (
                              <div className="absolute top-1.5 right-1.5 px-1 py-0.5 rounded-full bg-white/25 backdrop-blur-sm text-white text-[8px] font-bold tracking-wide uppercase hidden sm:block">
                                Suggested
                              </div>
                            )}
                            {isSelected && (
                              <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-white flex items-center justify-center">
                                <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                              </div>
                            )}
                          </div>

                          {/* Name + tagline — hidden on mobile (banner handles this) */}
                          <div className="hidden sm:block px-3 py-2.5 bg-card border-x border-b border-border rounded-b-2xl">
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
                        autoComplete="off"
                        value={recipientName}
                        onChange={(e) => { setRecipientName(e.target.value); setSelectedContactId(null); }}
                        className="h-11 rounded-xl text-base"
                      />
                      {quickContacts.length > 0 && (() => {
                        const LIMIT = 10;
                        const visible = showAllContacts ? quickContacts : quickContacts.slice(0, LIMIT);
                        const overflow = quickContacts.length - LIMIT;
                        return (
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Users className="w-3 h-3 shrink-0" />
                              <span>Quick pick</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {visible.map(c => {
                                const firstName = c.name.trim().split(" ")[0];
                                const isActive = selectedContactId === c.id;
                                return (
                                  <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => {
                                      setRecipientName(firstName);
                                      setSelectedContactId(c.id);
                                      if (c.phone && !recipientPhone) setRecipientPhone(c.phone);
                                    }}
                                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                                      isActive
                                        ? "bg-primary text-white border-primary"
                                        : "bg-muted/60 text-foreground border-border hover:bg-primary/10 hover:border-primary/40"
                                    }`}
                                  >
                                    {c.name}
                                  </button>
                                );
                              })}
                              {!showAllContacts && overflow > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setShowAllContacts(true)}
                                  className="px-2.5 py-1 rounded-full text-xs font-medium border border-dashed border-border text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
                                >
                                  +{overflow} more
                                </button>
                              )}
                              {showAllContacts && quickContacts.length > LIMIT && (
                                <button
                                  type="button"
                                  onClick={() => setShowAllContacts(false)}
                                  className="px-2.5 py-1 rounded-full text-xs font-medium border border-dashed border-border text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
                                >
                                  Show less
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sender">Who is it from?</Label>
                      <Input
                        id="sender"
                        placeholder="Your name"
                        autoComplete="given-name"
                        value={senderName}
                        onChange={(e) => setSenderName(e.target.value)}
                        className="h-11 rounded-xl text-base"
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
                      <SelectTrigger className="h-11 rounded-xl text-base">
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

                  {/* Group Moment toggle */}
                  <div className="mb-8">
                    <button
                      type="button"
                      onClick={() => setIsGroup(g => !g)}
                      className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border transition-all ${
                        isGroup
                          ? "bg-violet-50 border-violet-200 dark:bg-violet-950/20 dark:border-violet-800"
                          : "bg-secondary border-transparent hover:border-border"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl leading-none">👥</span>
                        <div className="text-left">
                          <p className={`text-sm font-semibold ${isGroup ? "text-violet-700 dark:text-violet-300" : "text-foreground"}`}>
                            Group Moment
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Share to a group chat — anyone can leave a reaction
                          </p>
                        </div>
                      </div>
                      <div className={`w-11 h-6 rounded-full transition-colors flex items-center px-0.5 ${isGroup ? "bg-violet-500" : "bg-border"}`}>
                        <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${isGroup ? "translate-x-5" : "translate-x-0"}`} />
                      </div>
                    </button>
                    {isGroup && (
                      <p className="text-xs text-violet-600 dark:text-violet-400 mt-2 pl-1">
                        Free to send — no balance, no phone number required. Just vibes. ✨
                      </p>
                    )}
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
                    <Label htmlFor="title" className="text-base font-semibold">Gift Headline <span className="text-muted-foreground font-normal text-sm">(optional)</span></Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      The big hero text in their reveal — write your own or pick a suggestion below.
                    </p>
                  </div>
                  <Input
                    id="title"
                    placeholder={(() => {
                      const name = recipientName?.trim().split(" ")[0] || "them";
                      const placeholders: Record<string, string> = {
                        Birthday: `e.g. Happy Birthday, ${name}!`,
                        Anniversary: "e.g. Here's to us.",
                        Love: `e.g. You mean everything to me, ${name}.`,
                        Graduation: `e.g. So proud of you, ${name}.`,
                        "New Baby": "e.g. Welcome to the world.",
                        Holiday: `e.g. Happy holidays, ${name}!`,
                        "Just Because": `e.g. Thinking of you, ${name}.`,
                        Wedding: "e.g. Wishing you both the very best.",
                        "Thank You": `e.g. Thank you so much, ${name}.`,
                        "Mother's Day": `e.g. Happy Mother's Day, ${name}!`,
                        "Father's Day": `e.g. Happy Father's Day, ${name}!`,
                        Other: `e.g. This one's for you, ${name}.`,
                      };
                      return `${placeholders[occasion] ?? `e.g. This one's for you, ${name}.`} — or pick a suggestion below`;
                    })()}
                    value={giftTitle}
                    onChange={(e) => setGiftTitle(e.target.value)}
                    className="h-12 rounded-xl text-base font-medium"
                  />
                  {/* Suggestion chips — occasion-aware, tap to populate */}
                  {(() => {
                    const name = recipientName?.trim().split(" ")[0] || "";
                    const n = name || "you";
                    const suggestions: Record<string, string[]> = {
                      Birthday: [
                        `Happy Birthday, ${n}!`,
                        `This one's for you, ${n}.`,
                        `Here's to you, ${n}.`,
                        `Wishing you the best, ${n}.`,
                      ],
                      Anniversary: [
                        "Here's to us.",
                        "Another year of loving you.",
                        "For the one I choose, every day.",
                        `Still my favorite person, ${n}.`,
                      ],
                      Love: [
                        `You mean everything to me, ${n}.`,
                        "Just because I love you.",
                        "For you, always.",
                        `Lucky to have you, ${n}.`,
                      ],
                      Graduation: [
                        `So proud of you, ${n}.`,
                        "Look how far you've come.",
                        `The world is yours, ${n}.`,
                        "This is just the beginning.",
                      ],
                      "New Baby": [
                        "Welcome to the world.",
                        "The newest little one.",
                        "A gift for the growing family.",
                        "So much love for you.",
                      ],
                      Holiday: [
                        `Happy holidays, ${n}!`,
                        "Wishing you the best this season.",
                        "A little holiday cheer.",
                        `Thinking of you this season, ${n}.`,
                      ],
                      "Just Because": [
                        `Thinking of you, ${n}.`,
                        "No reason needed.",
                        "Just because.",
                        `You deserve this, ${n}.`,
                      ],
                      Wedding: [
                        "Wishing you both the very best.",
                        "To the happy couple.",
                        "Here's to your new chapter.",
                        "So much love to you both.",
                      ],
                      "Thank You": [
                        `Thank you so much, ${n}.`,
                        "This is long overdue.",
                        "You didn't have to — but I'm glad you did.",
                        `Grateful for you, ${n}.`,
                      ],
                      "Mother's Day": [
                        `Happy Mother's Day, ${n}!`,
                        "For the woman who does it all.",
                        `Everything I am, because of you, ${n}.`,
                        "Thank you for everything.",
                      ],
                      "Father's Day": [
                        `Happy Father's Day, ${n}!`,
                        "For the best dad around.",
                        `Grateful for you every day, ${n}.`,
                        "This one's long overdue.",
                      ],
                      Other: [
                        `This one's for you, ${n}.`,
                        "A little something special.",
                        `For you, ${n}.`,
                        "You deserve it.",
                      ],
                    };
                    const chips = occasion && suggestions[occasion]
                      ? suggestions[occasion]
                      : [`A little something for ${n}.`, `This one's for you, ${n}.`, `For you, ${n}.`, "You deserve this."];
                    return (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {chips.map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setGiftTitle(s)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                              giftTitle === s
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-muted/60 text-foreground border-border hover:bg-primary/10 hover:border-primary/40"
                            }`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    );
                  })()}
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
                      placeholder={(() => {
                        const name = recipientName || "them";
                        const notePlaceholders: Record<string, string> = {
                          Love:         `e.g. You mean the world to me, ${name}.`,
                          Anniversary:  `e.g. Every year with you is my favorite, ${name}.`,
                          Wedding:      `e.g. Wishing you both a lifetime of joy.`,
                          "Mother's Day": `e.g. Thank you for everything you do, ${name}.`,
                          "Father's Day": `e.g. So grateful for you every day, ${name}.`,
                        };
                        return notePlaceholders[occasion] ?? "Write a personal note (optional)...";
                      })()}
                      className="min-h-[160px] rounded-xl text-base resize-none relative z-10"
                      value={personalNote}
                      onChange={(e) => {
                        setPersonalNote(e.target.value);
                        if (!noteWasUserAuthored && e.target.value.trim()) setNoteWasUserAuthored(true);
                      }}
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

                  {/* Nudge strip — appears after pure AI generation, dismissed on chip tap or × */}
                  <AnimatePresence>
                    {showNudge && aiLoading === null && (
                      <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="flex items-start gap-3 px-4 py-3 rounded-xl border border-primary/20 bg-primary/5"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-muted-foreground leading-snug mb-2">
                            Mention something specific and this'll feel more like you.
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {["their laugh", "a memory you share", "something they're into"].map((chip) => (
                              <button
                                key={chip}
                                type="button"
                                onClick={() => {
                                  setNoteWasUserAuthored(true);
                                  setShowNudge(false);
                                  handleAI("regenerate", chip);
                                }}
                                className="px-3 py-1 rounded-full text-xs font-medium border border-primary/30 bg-background text-primary hover:bg-primary/10 transition-colors"
                              >
                                {chip}
                              </button>
                            ))}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowNudge(false)}
                          className="text-muted-foreground hover:text-foreground transition-colors mt-0.5 shrink-0 text-xs"
                          aria-label="Dismiss"
                        >
                          ✕
                        </button>
                      </motion.div>
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

              {/* Soft warning — shown when Next is hit with no content at all */}
              <AnimatePresence>
                {showEmptyMomentWarning && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-950/30 p-4"
                  >
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-amber-900 dark:text-amber-200 leading-tight">Your moment is a bit bare</p>
                        <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5 leading-relaxed">
                          You haven't added a headline, note, video, or photos. The reveal will just show the recipient's name — add something personal to make it land.
                        </p>
                        <div className="flex gap-2 mt-3">
                          <button
                            type="button"
                            onClick={() => setShowEmptyMomentWarning(false)}
                            className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-amber-600 text-white hover:bg-amber-700 transition-colors"
                          >
                            Add something
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setShowEmptyMomentWarning(false);
                              const next = step + 1;
                              window.history.pushState({ step: next }, "");
                              setDirection(1);
                              setStep(next);
                              window.scrollTo({ top: 0, behavior: "smooth" });
                            }}
                            className="px-3.5 py-1.5 rounded-full text-xs font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
                          >
                            Continue anyway
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
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
                  Complete the moment <ArrowRight className="ml-2 w-4 h-4" />
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
                <h1 className="font-serif text-4xl font-medium mb-2">Complete the moment.</h1>
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

                  {/* Continue on phone QR — desktop only */}
                  <ContinueOnPhone
                    recipientName={recipientName}
                    senderName={senderName}
                    recipientPhone={recipientPhone}
                    occasion={occasion}
                    selectedExperience={selectedExperience}
                    giftTitle={giftTitle}
                    personalNote={personalNote}
                    extraLinks={extraLinks}
                    amount={amount}
                    intent={intent}
                    scheduledFor={scheduledFor}
                    scheduledTime={scheduledTime}
                  />

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
                        <span className="text-xs text-muted-foreground mt-0.5">Record or upload · Max 200 MB</span>
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
                      <DndContext sensors={photoSensors} collisionDetection={closestCenter} onDragEnd={handlePhotoDragEnd}>
                        <SortableContext items={photos.map(p => p.id)} strategy={rectSortingStrategy}>
                          <div className="grid grid-cols-3 gap-2.5">
                            {photos.map((photo) => (
                              <SortablePhoto key={photo.id} photo={photo} onRemove={handleRemovePhoto} />
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
                        </SortableContext>
                      </DndContext>
                    </div>
                  )}

                  {photoError && <p className="text-sm text-destructive">{photoError}</p>}
                  {uploadError && <p className="text-sm text-destructive">Upload failed: {uploadError.message}</p>}

                  {/* Links — anything with a URL, multiple allowed */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Add links <span className="text-muted-foreground font-normal">— tickets, playlists, reservations, anything</span></Label>
                    <div className="space-y-3">
                      {extraLinks.map((link, idx) => {
                        const hasError = !!linkErrors[idx];
                        return (
                          <div key={idx} className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-2">
                              <div className="relative flex-1">
                                <Link2 className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 ${hasError ? "text-destructive" : "text-muted-foreground"}`} />
                                <Input
                                  placeholder={idx === 0 ? LINK_IDEAS[linkLabelIdx % LINK_IDEAS.length] : LINK_IDEAS[idx % LINK_IDEAS.length]}
                                  className={`h-11 rounded-xl text-sm pl-10 transition-all ${hasError ? "border-destructive focus-visible:ring-destructive/30" : ""}`}
                                  value={link.url}
                                  onChange={(e) => {
                                    const updated = [...extraLinks];
                                    updated[idx] = { ...updated[idx], url: e.target.value };
                                    setExtraLinks(updated);
                                    if (linkErrors[idx]) {
                                      const errs = { ...linkErrors };
                                      delete errs[idx];
                                      setLinkErrors(errs);
                                    }
                                  }}
                                  onBlur={(e) => {
                                    const raw = e.target.value.trim();
                                    if (!raw) return;
                                    const corrected = autoCorrectUrl(raw);
                                    const updated = [...extraLinks];
                                    updated[idx] = { ...updated[idx], url: corrected };
                                    setExtraLinks(updated);
                                    if (!isValidUrl(raw)) {
                                      setLinkErrors(prev => ({ ...prev, [idx]: "This doesn't look like a valid URL — please check it." }));
                                    } else {
                                      const errs = { ...linkErrors };
                                      delete errs[idx];
                                      setLinkErrors(errs);
                                    }
                                  }}
                                />
                              </div>
                              {extraLinks.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setExtraLinks(extraLinks.filter((_, i) => i !== idx));
                                    const errs = { ...linkErrors };
                                    delete errs[idx];
                                    setLinkErrors(errs);
                                  }}
                                  className="w-9 h-9 flex items-center justify-center rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                            {hasError && (
                              <p className="text-xs text-destructive flex items-center gap-1.5 pl-1">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                {linkErrors[idx]}
                              </p>
                            )}
                            {link.url.trim() && !hasError && (link.url.includes("youtube.com") || link.url.includes("youtu.be")) && (
                              <motion.div
                                initial={{ opacity: 0, y: -4 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex items-center gap-1.5 pl-1"
                              >
                                <div className="flex items-center gap-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-100 rounded-full px-2.5 py-1">
                                  <Play className="w-3 h-3 fill-red-600" />
                                  Plays inline — no tap required
                                </div>
                              </motion.div>
                            )}
                            {link.url.trim() && !hasError && (
                              <div className="space-y-1">
                                <Input
                                  placeholder='Label — what is this? e.g. "Concert tickets" or "Our song"'
                                  className={`h-9 rounded-xl text-sm transition-all ${labelErrors[idx] ? "border-destructive focus-visible:ring-destructive/30" : ""}`}
                                  value={link.label}
                                  onChange={(e) => {
                                    const updated = [...extraLinks];
                                    updated[idx] = { ...updated[idx], label: e.target.value };
                                    setExtraLinks(updated);
                                    if (labelErrors[idx]) {
                                      const errs = { ...labelErrors };
                                      delete errs[idx];
                                      setLabelErrors(errs);
                                    }
                                  }}
                                />
                                {labelErrors[idx] && (
                                  <p className="text-xs text-destructive flex items-center gap-1.5 pl-1">
                                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                    {labelErrors[idx]}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {extraLinks.length < 5 && (
                      <button
                        type="button"
                        onClick={() => setExtraLinks([...extraLinks, {url: "", label: ""}])}
                        className="flex items-center gap-1.5 text-xs text-primary font-medium hover:underline mt-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add another link
                      </button>
                    )}
                    <p className="text-xs text-muted-foreground">Each link shows as a tap-to-open card in their gift — YouTube links play inline right inside the moment.</p>
                  </div>
                </div>

                {/* Give it weight — hidden for group moments */}
                {!isGroup && <div className="rounded-3xl p-6 border space-y-5" style={{ background: "hsl(var(--card))" }}>
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
                    {editGiftPaid ? (
                      /* Locked — balance was already paid */
                      <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-border bg-muted/40">
                        <Lock className="w-4 h-4 text-muted-foreground shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {editGiftAmount ? `$${parseFloat(editGiftAmount).toFixed(2)} balance` : "No balance"}
                          </p>
                          <p className="text-xs text-muted-foreground">Locked — payment already received</p>
                        </div>
                      </div>
                    ) : (
                    <div className="flex flex-wrap gap-2.5">
                      <button
                        type="button"
                        onClick={() => { setAmount(""); setCustomAmountInput(""); }}
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
                          onClick={() => { setAmount(amt); setCustomAmountInput(""); }}
                          className={`px-6 h-11 rounded-full font-bold text-base border transition-all ${
                            amount === amt && !customAmountInput
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
                          className={`h-11 rounded-full text-base font-bold pl-9 ${customAmountInput ? "ring-2 ring-primary/30 border-primary" : ""}`}
                          value={customAmountInput}
                          onChange={(e) => { const v = e.target.value; setCustomAmountInput(v); setAmount(v); }}
                        />
                      </div>
                    </div>
                    )}

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

                    {/* Phone number — only needed when there's a cash balance to protect */}
                    {amount && parseFloat(amount) >= 10 && (
                    <div className="space-y-2 pt-4 border-t border-border mt-2">
                      <Label htmlFor="recipientPhone">
                        Recipient's mobile number{" "}
                        <span className="text-destructive text-xs font-normal">— required</span>
                      </Label>
                      <Input
                        id="recipientPhone"
                        type="tel"
                        inputMode="tel"
                        placeholder="(555) 000-0000 or +27..."
                        value={recipientPhone}
                        onChange={(e) => {
                          setPhoneError(null);
                          setRecipientPhone(formatPhoneNumber(e.target.value));
                        }}
                        onBlur={handlePhoneBlur}
                        className={`h-12 rounded-xl text-base${phoneError ? " border-destructive" : ""}`}
                      />
                      {phoneError && (
                        <p className="text-xs text-destructive">{phoneError}</p>
                      )}
                      {!phoneError && (
                        <p className="text-xs text-muted-foreground">
                          We'll text a 6-digit code to <strong>their</strong> number when they go to redeem — enter theirs, not yours.
                        </p>
                      )}
                    </div>
                    )}
                  </div>
                </div>}
              </div>

              {/* Physical gift tracking */}
              <div className="rounded-3xl p-6 border space-y-4" style={{ background: "hsl(var(--card))" }}>
                <div className="flex items-center justify-between border-b border-border pb-4">
                  <div>
                    <h2 className="text-base font-semibold">Add a physical gift</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Sending something in the mail? Add tracking so they can follow it.
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground bg-secondary px-2.5 py-1 rounded-full border border-border">Optional</span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setTrackingOpen(!trackingOpen);
                    if (trackingOpen) {
                      setTrackingCarrier("");
                      setTrackingNumber("");
                    }
                  }}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border text-sm font-medium transition-all ${
                    trackingOpen
                      ? "bg-primary/5 border-primary/30 text-primary"
                      : "bg-secondary border-transparent text-foreground hover:border-border"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">📦</span>
                    {trackingOpen ? "Physical gift added" : "Add package tracking"}
                  </div>
                  <span className={`transition-transform duration-200 text-xs ${trackingOpen ? "rotate-180" : ""}`}>▼</span>
                </button>

                <AnimatePresence>
                  {trackingOpen && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.22 }}
                      className="overflow-hidden space-y-4"
                    >
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Carrier</Label>
                        <Select value={trackingCarrier} onValueChange={setTrackingCarrier}>
                          <SelectTrigger className="h-11 rounded-xl">
                            <SelectValue placeholder="Select a carrier…" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="usps">USPS</SelectItem>
                            <SelectItem value="ups">UPS</SelectItem>
                            <SelectItem value="fedex">FedEx</SelectItem>
                            <SelectItem value="dhl">DHL</SelectItem>
                            <SelectItem value="canada-post">Canada Post</SelectItem>
                            <SelectItem value="amazon">Amazon Logistics</SelectItem>
                            <SelectItem value="lasership">LaserShip</SelectItem>
                            <SelectItem value="ontrac">OnTrac</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Tracking number</Label>
                        <Input
                          placeholder="e.g. 1Z999AA10123456784"
                          value={trackingNumber}
                          onChange={(e) => setTrackingNumber(e.target.value.trim())}
                          className="h-11 rounded-xl text-sm font-mono"
                          spellCheck={false}
                          autoCapitalize="characters"
                        />
                      </div>

                      {trackingCarrier && trackingNumber && trackingNumber.length >= 6 && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className={`flex items-start gap-2 px-3 py-2.5 rounded-xl text-xs ${
                            trackingStatus === "valid"   ? "bg-green-50 text-green-700 border border-green-200" :
                            trackingStatus === "invalid" ? "bg-red-50 text-red-700 border border-red-200" :
                            trackingStatus === "warn"    ? "bg-amber-50 text-amber-700 border border-amber-200" :
                            "bg-muted/60 text-muted-foreground border border-border"
                          }`}
                        >
                          <span className="shrink-0 mt-0.5">
                            {trackingStatus === "checking" ? "⏳" :
                             trackingStatus === "valid"    ? "✓" :
                             trackingStatus === "invalid"  ? "✗" :
                             trackingStatus === "warn"     ? "⚠️" : "📦"}
                          </span>
                          <span>
                            {trackingStatus === "checking"
                              ? "Verifying tracking number…"
                              : trackingMessage || "A live tracking timeline will appear in their gift reveal."}
                          </span>
                        </motion.div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
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

                <div className="flex items-center rounded-2xl p-1 gap-1" style={{ background: "hsl(var(--secondary))" }}>
                  <button
                    type="button"
                    onClick={() => setScheduleEnabled(false)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                      !scheduleEnabled
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground/70"
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
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                      scheduleEnabled
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground/70"
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
                          We'll notify you on{" "}
                          {new Date(`${scheduledFor}T${scheduledTime}:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}{" "}
                          at{" "}
                          {new Date(`${scheduledFor}T${scheduledTime}:00`).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} ET — with the link to forward to {recipientName || "them"}.
                        </p>
                      )}

                      {/* Sender notification phone — captured here so scheduler can text them on delivery day */}
                      <div className="mt-3 space-y-1.5 pl-7">
                        <label className="text-xs font-semibold text-foreground">
                          Your phone number{" "}
                          <span className="font-normal text-muted-foreground">— so we can text you when it's time</span>
                        </label>
                        <Input
                          type="tel"
                          inputMode="tel"
                          placeholder="(555) 000-0000 or +27..."
                          value={senderNotifyPhone}
                          onChange={(e) => setSenderNotifyPhone(formatPhoneNumber(e.target.value))}
                          className="h-11 rounded-xl text-base"
                        />
                        <p className="text-xs text-muted-foreground">
                          We'll text{senderNotifyPhone ? ` ${senderNotifyPhone}` : " you"} on {scheduledFor ? new Date(`${scheduledFor}T${scheduledTime}:00`).toLocaleDateString("en-US", { month: "long", day: "numeric" }) : "the day"} with the link to send to {recipientName || "them"}.{isAuthenticated ? " Saved to your account." : ""}
                        </p>
                      </div>
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
                  disabled={isUploading || isCreating}
                  className="w-full sm:w-auto rounded-full h-13 px-8 text-base shadow-xl shadow-primary/25 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="mr-2 w-4 h-4 animate-spin" /> Video uploading…
                    </>
                  ) : isCreating ? (
                    <>
                      <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                      {editGiftId ? "Saving changes…" : "Creating your gift…"}
                    </>
                  ) : editGiftId ? (
                    <>
                      Save changes <ArrowRight className="ml-2 w-4 h-4" />
                    </>
                  ) : (
                    <>
                      Preview & send <ArrowRight className="ml-2 w-4 h-4" />
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
