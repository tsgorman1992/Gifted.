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
  Plus, Gift, Star, Heart, Snowflake, Sun, Flower2, Calendar, AlertCircle, Link2,
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

const INTENTS = ["Coffee on me", "Treat yourself", "Date night", "Birthday money", "Baby fund", "Take a break"];
const AMOUNTS = ["25", "50", "100", "250"];
const OCCASIONS = ["Birthday", "Anniversary", "Graduation", "New Baby", "Holiday", "Just Because", "Wedding", "Other"];

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

function ProgressBar({ step }: { step: number }) {
  return (
    <div className="mb-10">
      <div className="flex items-center gap-0 mb-3">
        {STEP_LABELS.map((label, i) => {
          const stepNum = i + 1;
          const isActive = stepNum === step;
          const isDone = stepNum < step;
          return (
            <React.Fragment key={i}>
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-500 ${
                    isDone
                      ? "bg-primary text-primary-foreground"
                      : isActive
                      ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                      : "bg-border text-muted-foreground"
                  }`}
                >
                  {isDone ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    stepNum
                  )}
                </div>
                <span
                  className={`text-[11px] font-medium hidden sm:block transition-colors duration-300 ${
                    isActive ? "text-foreground" : "text-muted-foreground"
                  }`}
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

// ─── Live preview card ────────────────────────────────────────────────────────

function PreviewCard({
  experience,
  recipientName,
  onTapOpen,
}: {
  experience: ExperienceMeta;
  recipientName: string;
  onTapOpen: () => void;
}) {
  const Icon = EXPERIENCE_ICONS[experience.id];
  const isDark = experience.isDark;

  return (
    <div className="hidden lg:block w-64 flex-shrink-0">
      <div className="sticky top-8">
        <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-widest mb-3 text-center">
          Their reveal
        </p>
        <div
          className="w-full rounded-[2rem] overflow-hidden shadow-2xl"
          style={{ aspectRatio: "9/16", background: `linear-gradient(155deg, ${experience.palette.from}, ${experience.palette.via}, ${experience.palette.to})` }}
        >
          {/* Top area */}
          <div className="flex flex-col items-center justify-center h-full px-5 text-center">
            <motion.div
              key={experience.id}
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 22 }}
              className="w-14 h-14 rounded-full flex items-center justify-center mb-5"
              style={{ background: "rgba(255,255,255,0.2)", backdropFilter: "blur(8px)" }}
            >
              <Icon className={`w-7 h-7 ${isDark ? "text-indigo-200" : "text-white"}`} />
            </motion.div>

            <p className={`text-xs mb-1.5 font-medium ${isDark ? "text-white/50" : "text-white/70"}`}>
              A gift for
            </p>
            <motion.h2
              key={recipientName}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className={`font-serif text-3xl leading-tight mb-8 ${isDark ? "text-white" : "text-white"}`}
              style={{ textShadow: "0 2px 20px rgba(0,0,0,0.15)" }}
            >
              {recipientName || "Someone special"}
            </motion.h2>

            <button
              onClick={onTapOpen}
              className="w-full rounded-full py-2.5 px-4 text-center text-sm font-medium cursor-pointer transition-transform duration-150 hover:scale-105 active:scale-95"
              style={{ background: "rgba(255,255,255,0.2)", backdropFilter: "blur(8px)", color: isDark ? "rgba(255,255,255,0.85)" : "white", border: "none", outline: "none" }}
              type="button"
            >
              Tap to open
            </button>
          </div>
        </div>

        <div className="mt-3 text-center">
          <p className={`text-xs font-semibold ${isDark ? "text-foreground" : "text-foreground"}`}>
            {experience.name}
          </p>
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
  const [occasion, setOccasion] = useState("Birthday");
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [senderName, setSenderName] = useState("");
  const [giftTitle, setGiftTitle] = useState("");
  const [personalNote, setPersonalNote] = useState("");
  const [playlistUrl, setPlaylistUrl] = useState("");
  const [aiLoading, setAiLoading] = useState<"rewrite" | "regenerate" | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showAiGlow, setShowAiGlow] = useState(false);
  const [linkPlaceholderIdx, setLinkPlaceholderIdx] = useState(0);

  // Media state
  const [videoObjectPath, setVideoObjectPath] = useState<string | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const videoBlobUrlRef = useRef<string | null>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [photosUploading, setPhotosUploading] = useState<PhotoUploadingItem[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

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
    const pl = localStorage.getItem("gifted_playlist_url");
    if (pl) setPlaylistUrl(pl);
    const amt = localStorage.getItem("gifted_amount");
    if (amt && parseFloat(amt) > 0) setAmount(amt);
    const int = localStorage.getItem("gifted_intent");
    if (int) {
      setIntent(int);
      if (!INTENTS.includes(int)) setCustomIntentMode(true);
    }
    const sf = localStorage.getItem("gifted_scheduled_for");
    if (sf) { setScheduledFor(sf); setScheduleEnabled(true); }
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

  // Cycle link placeholder ideas when the field is empty and not focused
  useEffect(() => {
    if (playlistUrl) return;
    const id = setInterval(() => {
      setLinkPlaceholderIdx(i => (i + 1) % LINK_IDEAS.length);
    }, 2400);
    return () => clearInterval(id);
  }, [playlistUrl]);

  // Suggest a title when recipient + occasion are both set
  useEffect(() => {
    if (recipientName && occasion && !giftTitle) {
      const suggestions: Record<string, string> = {
        Birthday: `Happy Birthday, ${recipientName}!`,
        Anniversary: `Here's to you, ${recipientName}.`,
        Graduation: `Proud of you, ${recipientName}.`,
        "New Baby": `Welcome to the world, little one.`,
        Holiday: `Happy holidays, ${recipientName}!`,
        "Just Because": `Thinking of you, ${recipientName}.`,
        Wedding: `Wishing you both the best.`,
        Other: `This one's for you, ${recipientName}.`,
      };
      setGiftTitle(suggestions[occasion] ?? `For ${recipientName}.`);
    }
  }, [recipientName, occasion]);

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
    if (file.size > 200 * 1024 * 1024) { alert("Video must be under 200 MB."); return; }
    if (!file.type.startsWith("video/")) { alert("Please select a video file."); return; }
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
    if (playlistUrl.trim()) localStorage.setItem("gifted_playlist_url", playlistUrl.trim());
    else localStorage.removeItem("gifted_playlist_url");
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
    if (scheduleEnabled && scheduledFor) localStorage.setItem("gifted_scheduled_for", scheduledFor);
    else localStorage.removeItem("gifted_scheduled_for");
  };

  const handlePreview = () => {
    if (amount && parseFloat(amount) < 10) {
      setStepError("The minimum gift balance is $10. Choose $10 or more, or leave it blank.");
      return;
    }
    if (scheduleEnabled && !scheduledFor) {
      setStepError("Please pick a delivery date, or switch back to \"Send now\".");
      return;
    }
    saveToLocalStorage();
    setLocation("/preview");
  };

  const handleTapOpen = () => {
    saveToLocalStorage();
    setLocation("/reveal");
  };

  const handleAI = async (mode: "rewrite" | "regenerate") => {
    if (!recipientName || !senderName || !occasion) {
      setAiError("Please fill in the recipient and sender names on the previous step first.");
      setTimeout(() => setAiError(null), 4000);
      return;
    }
    setAiLoading(mode);
    setAiError(null);
    setShowAiGlow(false);
    let generated = "";
    setPersonalNote("");
    try {
      await streamAINote(
        { currentNote: mode === "rewrite" ? personalNote : undefined, occasion, recipientName, senderName, intent: intent || undefined, giftTitle: giftTitle || undefined, mode },
        (chunk) => { generated += chunk; setPersonalNote(generated); },
        () => { setAiLoading(null); setShowAiGlow(true); setTimeout(() => setShowAiGlow(false), 2000); },
        (err) => { setAiError(err); setAiLoading(null); if (!generated) setPersonalNote(""); }
      );
    } catch {
      setAiError("Something went wrong. Please try again.");
      setAiLoading(null);
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
      if (recipientPhone && recipientPhone.replace(/\D/g, "").length < 10) {
        setStepError("Please enter a complete 10-digit phone number."); return;
      }
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
        <ProgressBar step={step} />

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

                  {/* Recipient phone */}
                  <div className="space-y-2 mb-4">
                    <Label htmlFor="recipientPhone">
                      Their phone number{" "}
                      <span className="text-muted-foreground text-xs font-normal">— required to secure a cash balance</span>
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
                      Only used to verify the recipient's identity when they withdraw cash. Never shared or used for marketing.
                    </p>
                  </div>

                  {/* Occasion */}
                  <div className="space-y-2 mb-8">
                    <Label htmlFor="occasion">What's the occasion?</Label>
                    <Select
                      value={occasion}
                      onValueChange={(val) => {
                        setOccasion(val);
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
                      className="rounded-full h-13 px-8 text-base shadow-lg shadow-primary/20 hover:-translate-y-0.5 transition-all"
                    >
                      Write the moment <ArrowRight className="ml-2 w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Live preview panel */}
                <PreviewCard experience={currentExperience} recipientName={recipientName} onTapOpen={handleTapOpen} />
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
                    placeholder="e.g. Happy Birthday to my favorite person!"
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
                  <div className="flex items-start justify-between gap-4">
                    <div>
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
              <div className="flex justify-between mt-8">
                <Button type="button" variant="ghost" size="lg" onClick={goBack} className="rounded-full h-13 px-6 text-base">
                  <ArrowLeft className="mr-2 w-4 h-4" /> Back
                </Button>
                <Button
                  type="button"
                  size="lg"
                  onClick={goNext}
                  className="rounded-full h-13 px-8 text-base shadow-lg shadow-primary/20 hover:-translate-y-0.5 transition-all"
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

                  {/* Link — anything with a URL */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Add a link <span className="text-muted-foreground font-normal">— anything with a URL</span></Label>
                    <div className="relative">
                      <Link2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder={LINK_IDEAS[linkPlaceholderIdx]}
                        className="h-11 rounded-xl text-sm pl-10 transition-all"
                        value={playlistUrl}
                        onChange={(e) => setPlaylistUrl(e.target.value)}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Tickets, a reservation, a song, a playlist — they'll see a tap-to-open card.</p>
                  </div>
                </div>

                {/* Give them something to spend */}
                <div className="rounded-3xl p-6 border space-y-5" style={{ background: "hsl(var(--card))" }}>
                  <div className="flex items-center justify-between border-b border-border pb-4">
                    <div>
                      <h2 className="text-base font-semibold">Give them something to spend</h2>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Setting an intention turns a transfer into a gesture.
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground bg-secondary px-2.5 py-1 rounded-full border border-border">Optional</span>
                  </div>

                  {/* Intention first */}
                  <div className="space-y-3">
                    <Label className="text-sm font-semibold">What's the intention?</Label>
                    <p className="text-xs text-muted-foreground -mt-1">
                      Name the purpose behind the balance — it changes how it lands.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {INTENTS.map((lbl) => (
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
                          if (INTENTS.includes(intent)) setIntent("");
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
                            value={customIntentMode && !INTENTS.includes(intent) ? intent : ""}
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
                    <Label className="text-sm font-semibold">How much?</Label>
                    <div className="flex flex-wrap gap-2.5">
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
                          {!intent && amount && <p className="text-xs text-muted-foreground">Add an intention above to complete the gesture</p>}
                        </div>
                      </motion.div>
                    )}
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
                    onClick={() => setScheduleEnabled(true)}
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
                      {scheduledFor && (
                        <p className="text-xs text-muted-foreground mt-2 pl-7">
                          {recipientName || "Your recipient"} will get the link on{" "}
                          {new Date(scheduledFor + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}.
                        </p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Navigation */}
              <div className="flex justify-between mt-8">
                <Button type="button" variant="ghost" size="lg" onClick={goBack} className="rounded-full h-13 px-6 text-base">
                  <ArrowLeft className="mr-2 w-4 h-4" /> Back
                </Button>
                <Button
                  type="button"
                  size="lg"
                  onClick={handlePreview}
                  className="rounded-full h-13 px-8 text-base shadow-xl shadow-primary/25 hover:-translate-y-0.5 transition-all"
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
