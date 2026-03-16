import React, { useState, useRef } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, Video, Music, Image as ImageIcon, DollarSign, Sparkles, RefreshCw, Loader2, X, CheckCircle2 } from "lucide-react";
import { useUpload } from "@workspace/object-storage-web";

const THEMES = [
  { id: "warm", name: "Warm Glow", img: "theme-warm-glow.png" },
  { id: "midnight", name: "Midnight", img: "theme-midnight.png" },
  { id: "garden", name: "Garden", img: "theme-garden.png" }
];

const INTENTS = ["Coffee on me", "Treat yourself", "Date night", "Birthday money", "Baby fund", "Take a break"];
const AMOUNTS = ["25", "50", "100", "250"];
const OCCASIONS = ["Birthday", "Anniversary", "Graduation", "New Baby", "Holiday", "Just Because", "Wedding", "Other"];

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

  if (!response.ok || !response.body) {
    onError("Request failed");
    return;
  }

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
        } catch {
          // ignore malformed chunks
        }
      }
    }
  }
}

export default function CreatePage() {
  const [, setLocation] = useLocation();
  const [selectedTheme, setSelectedTheme] = useState("warm");
  const [amount, setAmount] = useState("");
  const [intent, setIntent] = useState("");
  const [occasion, setOccasion] = useState("Birthday");
  const [recipientName, setRecipientName] = useState("Sarah");
  const [senderName, setSenderName] = useState("Jamie");
  const [giftTitle, setGiftTitle] = useState("Happy Birthday, Sarah! 🎂");
  const [personalNote, setPersonalNote] = useState(
    "I couldn't be there in person, but I wanted to make sure you felt celebrated today. Use this to treat yourself to something nice. Miss you!"
  );
  const [aiLoading, setAiLoading] = useState<"rewrite" | "regenerate" | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showAiGlow, setShowAiGlow] = useState(false);

  const [videoObjectPath, setVideoObjectPath] = useState<string | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const { uploadFile, isUploading, progress, error: uploadError } = useUpload({
    basePath: `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/storage`,
    onSuccess: (response) => {
      setVideoObjectPath(response.objectPath);
      const servingUrl = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/storage${response.objectPath}`;
      setVideoPreviewUrl(servingUrl);
    },
  });

  const handleVideoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = 100 * 1024 * 1024;
    if (file.size > maxSize) {
      alert("Video must be under 100 MB.");
      return;
    }

    if (!file.type.startsWith("video/")) {
      alert("Please select a video file.");
      return;
    }

    await uploadFile(file);
    if (videoInputRef.current) videoInputRef.current.value = "";
  };

  const handleRemoveVideo = () => {
    setVideoObjectPath(null);
    setVideoPreviewUrl(null);
  };

  const handlePreview = (e: React.FormEvent) => {
    e.preventDefault();
    if (videoObjectPath) {
      localStorage.setItem("gifted_video_path", videoObjectPath);
    } else {
      localStorage.removeItem("gifted_video_path");
    }
    setLocation("/preview");
  };

  const handleAI = async (mode: "rewrite" | "regenerate") => {
    if (!recipientName || !senderName || !occasion) {
      setAiError("Please fill in the recipient, sender, and occasion first.");
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
        {
          currentNote: mode === "rewrite" ? personalNote : undefined,
          occasion,
          recipientName,
          senderName,
          intent: intent || undefined,
          giftTitle: giftTitle || undefined,
          mode,
        },
        (chunk) => {
          generated += chunk;
          setPersonalNote(generated);
        },
        () => {
          setAiLoading(null);
          setShowAiGlow(true);
          setTimeout(() => setShowAiGlow(false), 2000);
        },
        (err) => {
          setAiError(err);
          setAiLoading(null);
          if (!generated) setPersonalNote("I couldn't be there in person, but I wanted to make sure you felt celebrated today.");
        }
      );
    } catch {
      setAiError("Something went wrong. Please try again.");
      setAiLoading(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <div className="mb-10">
        <h1 className="font-serif text-4xl font-medium mb-3">Create a gift</h1>
        <p className="text-muted-foreground text-lg">Build a moment they won't forget.</p>
      </div>

      <form onSubmit={handlePreview} className="space-y-12">
        {/* Section 1: The Basics */}
        <section className="bg-card p-8 rounded-3xl shadow-sm border border-border space-y-6">
          <h2 className="text-xl font-bold border-b border-border pb-4">The Basics</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="recipient">Who is this for?</Label>
              <Input
                id="recipient"
                placeholder="e.g. Sarah"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                className="h-12 rounded-xl text-base"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sender">Who is it from?</Label>
              <Input
                id="sender"
                placeholder="e.g. Jamie"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                className="h-12 rounded-xl text-base"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="occasion">Occasion</Label>
            <Select value={occasion} onValueChange={setOccasion}>
              <SelectTrigger className="h-12 rounded-xl text-base">
                <SelectValue placeholder="Select occasion" />
              </SelectTrigger>
              <SelectContent>
                {OCCASIONS.map((occ) => (
                  <SelectItem key={occ} value={occ}>{occ}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Gift Headline</Label>
            <Input
              id="title"
              placeholder="e.g. Happy Birthday to my favorite person!"
              value={giftTitle}
              onChange={(e) => setGiftTitle(e.target.value)}
              className="h-12 rounded-xl text-base font-medium"
              required
            />
          </div>

          {/* Personal Note with AI */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="message">Personal Note</Label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={aiLoading !== null}
                  onClick={() => handleAI("rewrite")}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all border border-primary/20"
                >
                  {aiLoading === "rewrite" ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  {aiLoading === "rewrite" ? "Rewriting..." : "Rewrite with AI"}
                </button>
                <button
                  type="button"
                  disabled={aiLoading !== null}
                  onClick={() => handleAI("regenerate")}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50 disabled:cursor-not-allowed transition-all border border-border"
                >
                  {aiLoading === "regenerate" ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" />
                  )}
                  {aiLoading === "regenerate" ? "Generating..." : "Regenerate"}
                </button>
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
                placeholder="Write something meaningful..."
                className="min-h-[140px] rounded-xl text-base resize-none relative z-10 transition-all"
                value={personalNote}
                onChange={(e) => setPersonalNote(e.target.value)}
                required
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

            <p className="text-xs text-muted-foreground">
              Use AI to improve your note or generate a fresh one based on the occasion and intent you've set.
            </p>
          </div>
        </section>

        {/* Section 2: Add Meaning */}
        <section className="bg-card p-8 rounded-3xl shadow-sm border border-border space-y-6">
          <div className="border-b border-border pb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold">Add Meaning</h2>
            <span className="text-sm text-muted-foreground">Optional</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <input
              ref={videoInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={handleVideoSelect}
            />

            {!videoPreviewUrl && !isUploading && (
              <button
                type="button"
                onClick={() => videoInputRef.current?.click()}
                className="flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 transition-all group"
              >
                <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
                  <Video className="w-5 h-5 text-muted-foreground group-hover:text-primary" />
                </div>
                <span className="font-medium">Add a Video</span>
                <span className="text-xs text-muted-foreground mt-1">Record or upload</span>
              </button>
            )}

            {isUploading && (
              <div className="flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-primary/30 bg-primary/5">
                <Loader2 className="w-8 h-8 text-primary animate-spin mb-3" />
                <span className="font-medium text-sm mb-2">Uploading video...</span>
                <div className="w-full max-w-[200px] h-2 bg-secondary rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-primary rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
                <span className="text-xs text-muted-foreground mt-1.5">{progress}%</span>
              </div>
            )}

            {videoPreviewUrl && !isUploading && (
              <div className="relative rounded-2xl border-2 border-primary/30 bg-primary/5 overflow-hidden">
                <video
                  src={videoPreviewUrl}
                  controls
                  playsInline
                  className="w-full aspect-video object-cover rounded-xl"
                />
                <div className="flex items-center justify-between px-4 py-2">
                  <div className="flex items-center gap-1.5 text-sm text-primary font-medium">
                    <CheckCircle2 className="w-4 h-4" />
                    Video added
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveVideo}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                    Remove
                  </button>
                </div>
              </div>
            )}

            {uploadError && (
              <p className="text-sm text-destructive col-span-full">
                Upload failed: {uploadError.message}
              </p>
            )}

            <button type="button" className="flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 transition-all group">
              <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
                <ImageIcon className="w-5 h-5 text-muted-foreground group-hover:text-primary" />
              </div>
              <span className="font-medium">Add Photos</span>
              <span className="text-xs text-muted-foreground mt-1">Up to 6 images</span>
            </button>
          </div>

          <div className="space-y-2 mt-4">
            <Label>Spotify or Apple Music Playlist</Label>
            <div className="relative">
              <Music className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="Paste playlist URL here..."
                className="h-12 rounded-xl text-base pl-12"
                defaultValue="https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M"
              />
            </div>
          </div>
        </section>

        {/* Section 3: Add a Balance */}
        <section className="bg-card p-8 rounded-3xl shadow-sm border border-border space-y-6">
          <div className="border-b border-border pb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold">Add a Balance</h2>
            <span className="text-sm text-muted-foreground">Optional</span>
          </div>

          <div className="space-y-4">
            <Label>Gift Amount</Label>
            <div className="flex flex-wrap gap-3">
              {AMOUNTS.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setAmount(amt)}
                  className={`px-6 h-12 rounded-full font-bold text-lg border transition-all ${
                    amount === amt
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-secondary text-secondary-foreground border-transparent hover:border-border"
                  }`}
                >
                  ${amt}
                </button>
              ))}
              <div className="relative flex-1 min-w-[120px]">
                <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type="number"
                  placeholder="Custom"
                  className="h-12 rounded-full text-lg font-bold pl-10"
                  value={!AMOUNTS.includes(amount) && amount ? amount : ""}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-4">
            <Label>What is the intention behind this balance?</Label>
            <p className="text-xs text-muted-foreground -mt-2">
              Setting an intention helps the AI write a more personal note for you.
            </p>
            <div className="flex flex-wrap gap-2">
              {INTENTS.map((lbl) => (
                <button
                  key={lbl}
                  type="button"
                  onClick={() => setIntent(intent === lbl ? "" : lbl)}
                  className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${
                    intent === lbl
                      ? "bg-foreground text-background border-foreground"
                      : "bg-background text-foreground border-border hover:border-foreground/30"
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Section 4: Visual Theme */}
        <section className="space-y-6">
          <h2 className="text-xl font-bold px-2">Choose a Visual Theme</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {THEMES.map((theme) => (
              <button
                key={theme.id}
                type="button"
                onClick={() => setSelectedTheme(theme.id)}
                className={`relative rounded-2xl overflow-hidden text-left transition-all ${
                  selectedTheme === theme.id ? "ring-4 ring-primary ring-offset-4 ring-offset-background" : "hover:opacity-80"
                }`}
              >
                <div className="aspect-[4/3] bg-muted w-full relative">
                  <img
                    src={`${import.meta.env.BASE_URL}images/${theme.img}`}
                    alt={theme.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4">
                    <span className="text-white font-medium">{theme.name}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Submit */}
        <div className="sticky bottom-6 z-20 flex justify-end">
          <Button type="submit" size="lg" className="rounded-full h-14 px-8 text-lg shadow-xl shadow-primary/25 hover:-translate-y-1 transition-all">
            Preview your gift <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </div>
      </form>
    </div>
  );
}
