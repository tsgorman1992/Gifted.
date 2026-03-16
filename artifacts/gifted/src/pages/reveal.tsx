import React, { useState, useEffect } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { Button } from "@/components/ui/button";
import { Play, Heart, Sparkles } from "lucide-react";
import { mockGiftData } from "@/lib/mock-data";

interface ExperiencePalette {
  gradientFrom: string;
  gradientVia: string;
  gradientTo: string;
}

const EXPERIENCE_PALETTES: Record<string, ExperiencePalette> = {
  "confetti-burst":  { gradientFrom: "#FF6B6B", gradientVia: "#FFD93D", gradientTo: "#6BCB77" },
  "golden-hour":     { gradientFrom: "#F7C59F", gradientVia: "#E8A87C", gradientTo: "#D4813A" },
  "garden-bloom":    { gradientFrom: "#FFB7C5", gradientVia: "#C7CEEA", gradientTo: "#B5EAD7" },
  "midnight-stars":  { gradientFrom: "#0f0c29", gradientVia: "#302b63", gradientTo: "#24243e" },
  "rose-petal":      { gradientFrom: "#FFB7C5", gradientVia: "#FF8FAB", gradientTo: "#E8A7B1" },
  "snow-flurry":     { gradientFrom: "#BDE0FE", gradientVia: "#A2D2FF", gradientTo: "#CDB4DB" },
  "sunrise":         { gradientFrom: "#FFCBA4", gradientVia: "#FF9A8B", gradientTo: "#FF6A88" },
};

const DEFAULT_EXPERIENCE = "confetti-burst";

function getGradientStyle(experience: string): React.CSSProperties {
  const p = EXPERIENCE_PALETTES[experience] ?? EXPERIENCE_PALETTES[DEFAULT_EXPERIENCE];
  return {
    background: `linear-gradient(135deg, ${p.gradientFrom}, ${p.gradientVia}, ${p.gradientTo})`,
  };
}

function fireAnimation(experience: string) {
  switch (experience) {
    case "confetti-burst": {
      const duration = 3500;
      const end = Date.now() + duration;
      const colors = ["#FF6B6B", "#FFD93D", "#6BCB77", "#4D96FF", "#FF9500", "#BF5AF2"];
      const frame = () => {
        confetti({ particleCount: 7, angle: 60, spread: 60, origin: { x: 0 }, colors });
        confetti({ particleCount: 7, angle: 120, spread: 60, origin: { x: 1 }, colors });
        if (Date.now() < end) requestAnimationFrame(frame);
      };
      frame();
      break;
    }
    case "golden-hour": {
      const duration = 4000;
      const end = Date.now() + duration;
      const colors = ["#F7C59F", "#E8A87C", "#FFD700", "#FFC200", "#FFECB3"];
      const frame = () => {
        confetti({
          particleCount: 4,
          angle: 90,
          spread: 80,
          origin: { x: Math.random(), y: 1 },
          colors,
          gravity: 0.3,
          scalar: 1.2,
          drift: 0.5,
        });
        if (Date.now() < end) requestAnimationFrame(frame);
      };
      frame();
      break;
    }
    case "midnight-stars": {
      const duration = 3500;
      const end = Date.now() + duration;
      const colors = ["#C0C0C0", "#FFFFFF", "#E8E8FF", "#B8B8FF", "#9090CC"];
      const starShape = confetti.shapeFromText({ text: "★", scalar: 2 });
      const frame = () => {
        confetti({
          particleCount: 5,
          angle: 90,
          spread: 70,
          origin: { x: Math.random(), y: 1 },
          colors,
          gravity: 0.2,
          scalar: 1.4,
          shapes: [starShape],
          drift: (Math.random() - 0.5) * 0.5,
        });
        if (Date.now() < end) requestAnimationFrame(frame);
      };
      frame();
      break;
    }
    case "sunrise": {
      const duration = 3500;
      const end = Date.now() + duration;
      const colors = ["#FFCBA4", "#FF9A8B", "#FF6A88", "#FFA07A", "#FFD580"];
      const frame = () => {
        confetti({ particleCount: 5, angle: 65, spread: 50, origin: { x: 0 }, colors, scalar: 0.9 });
        confetti({ particleCount: 5, angle: 115, spread: 50, origin: { x: 1 }, colors, scalar: 0.9 });
        if (Date.now() < end) requestAnimationFrame(frame);
      };
      frame();
      break;
    }
    case "garden-bloom":
    case "rose-petal":
    case "snow-flurry": {
      fireDOMParticles(experience);
      break;
    }
    default: {
      const duration = 3000;
      const end = Date.now() + duration;
      const frame = () => {
        confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 }, colors: ["#d49a89", "#f3e5e1", "#b56a56"] });
        confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 }, colors: ["#d49a89", "#f3e5e1", "#b56a56"] });
        if (Date.now() < end) requestAnimationFrame(frame);
      };
      frame();
    }
  }
}

function fireDOMParticles(experience: string) {
  const styleId = "gifted-particle-styles";
  if (!document.getElementById(styleId)) {
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
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
    document.head.appendChild(style);
  }

  const configs: Record<string, { colors: string[]; sizes: [number, number]; count: number; duration: [number, number]; keyframe: string; shape?: string }> = {
    "garden-bloom": {
      colors: ["#FFB7C5", "#B5EAD7", "#C7CEEA", "#FFDAC1", "#E2F0CB"],
      sizes: [10, 20],
      count: 55,
      duration: [3500, 6000],
      keyframe: "gifted-petal-fall",
    },
    "rose-petal": {
      colors: ["#FFB7C5", "#FFFFFF", "#FF8FAB", "#FFC0CB", "#FFE4E8"],
      sizes: [12, 22],
      count: 50,
      duration: [3000, 5500],
      keyframe: "gifted-petal-fall",
    },
    "snow-flurry": {
      colors: ["#FFFFFF", "#E8F4FD", "#BDE0FE", "#E0EFFF"],
      sizes: [6, 14],
      count: 70,
      duration: [3000, 6500],
      keyframe: "gifted-snow-fall",
      shape: "circle",
    },
  };

  const cfg = configs[experience];
  if (!cfg) return;

  const container = document.createElement("div");
  container.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden;";
  document.body.appendChild(container);

  for (let i = 0; i < cfg.count; i++) {
    setTimeout(() => {
      const el = document.createElement("div");
      const size = cfg.sizes[0] + Math.random() * (cfg.sizes[1] - cfg.sizes[0]);
      const duration = cfg.duration[0] + Math.random() * (cfg.duration[1] - cfg.duration[0]);
      const drift = (Math.random() - 0.5) * 200;
      const spin = Math.random() * 720 - 360;
      const color = cfg.colors[Math.floor(Math.random() * cfg.colors.length)];
      const left = Math.random() * 100;

      el.className = "gifted-particle";
      el.style.cssText = `
        left: ${left}%;
        top: 0;
        width: ${size}px;
        height: ${size * 0.7}px;
        background: ${color};
        --drift: ${drift}px;
        --spin: ${spin}deg;
        animation: ${cfg.keyframe} ${duration}ms ease-in forwards;
        ${cfg.shape === "circle" ? "border-radius: 50%; height: " + size + "px;" : ""}
        opacity: ${0.7 + Math.random() * 0.3};
      `;
      container.appendChild(el);
    }, Math.random() * 2500);
  }

  setTimeout(() => {
    container.remove();
  }, 9000);
}

export default function RevealPage() {
  const [isOpen, setIsOpen] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [experience, setExperience] = useState(DEFAULT_EXPERIENCE);

  useEffect(() => {
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");

    const storedVideoPath = localStorage.getItem("gifted_video_path");
    if (storedVideoPath) {
      setVideoUrl(`${base}/api/storage${storedVideoPath}`);
    }

    const storedPhotoPaths = localStorage.getItem("gifted_photo_paths");
    if (storedPhotoPaths) {
      try {
        const paths: string[] = JSON.parse(storedPhotoPaths);
        setPhotoUrls(paths.map((p) => `${base}/api/storage${p}`));
      } catch { /* ignore */ }
    }

    const storedExperience = localStorage.getItem("gifted_experience");
    if (storedExperience && EXPERIENCE_PALETTES[storedExperience]) {
      setExperience(storedExperience);
    }
  }, []);

  useEffect(() => {
    document.body.style.overflow = isOpen ? "auto" : "hidden";
    return () => { document.body.style.overflow = "auto"; };
  }, [isOpen]);

  const handleOpen = () => {
    setIsOpen(true);
    fireAnimation(experience);
  };

  const gradientStyle = getGradientStyle(experience);

  return (
    <div className="w-full min-h-screen bg-background relative">

      {/* Pre-reveal envelope */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            exit={{ opacity: 0, y: -50, scale: 0.95 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center p-6"
          >
            <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-40">
              <div className="w-full h-full blur-2xl" style={gradientStyle} />
            </div>

            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.8 }}
              className="relative z-10 flex flex-col items-center text-center"
            >
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-8">
                <Heart className="w-8 h-8 text-primary animate-pulse" />
              </div>
              <p className="text-lg font-medium text-muted-foreground mb-2">A gift for</p>
              <h1 className="font-serif text-5xl md:text-7xl mb-12">{mockGiftData.recipientName}</h1>

              <Button
                onClick={handleOpen}
                size="lg"
                className="rounded-full h-16 px-10 text-xl shadow-2xl shadow-primary/30 hover:scale-105 transition-all duration-300"
              >
                Tap to open
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Revealed gift content */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="w-full pb-32"
          >
            {/* Hero Cover */}
            <div className="w-full h-[60vh] md:h-[70vh] relative flex items-end">
              <div className="absolute inset-0">
                <div className="w-full h-full" style={gradientStyle} />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
              </div>

              <div className="relative z-10 w-full max-w-4xl mx-auto px-6 pb-12">
                <motion.div
                  initial={{ y: 30, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.5, duration: 0.8 }}
                >
                  <h1 className="font-serif text-5xl md:text-7xl font-medium text-foreground mb-4">
                    {mockGiftData.title}
                  </h1>
                  <p className="text-xl text-muted-foreground">Sent with love by {mockGiftData.senderName}</p>
                </motion.div>
              </div>
            </div>

            <div className="max-w-4xl mx-auto px-6 space-y-16 -mt-8 relative z-20">

              {/* Note */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="bg-card/80 backdrop-blur-xl rounded-[2rem] p-8 md:p-12 border border-white/20 shadow-xl"
              >
                <p className="font-serif text-2xl md:text-3xl leading-relaxed text-foreground text-center">
                  "{mockGiftData.message}"
                </p>
              </motion.div>

              {/* Video */}
              {videoUrl ? (
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.9 }}
                  className="w-full rounded-[2rem] bg-secondary border border-border relative overflow-hidden"
                >
                  {!isVideoPlaying ? (
                    <div
                      className="w-full aspect-video relative cursor-pointer group"
                      onClick={() => setIsVideoPlaying(true)}
                    >
                      <video
                        src={videoUrl}
                        preload="metadata"
                        playsInline
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                        <div className="w-20 h-20 rounded-full bg-white/30 backdrop-blur-md flex items-center justify-center text-white border border-white/40 group-hover:bg-primary group-hover:border-primary transition-all duration-300 shadow-xl">
                          <Play className="w-8 h-8 ml-1" fill="currentColor" />
                        </div>
                      </div>
                      <div className="absolute bottom-4 left-4 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-sm text-white text-sm font-medium">
                        A message from {mockGiftData.senderName}
                      </div>
                    </div>
                  ) : (
                    <video
                      src={videoUrl}
                      controls
                      autoPlay
                      playsInline
                      className="w-full aspect-video object-cover"
                    />
                  )}
                </motion.div>
              ) : (
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.9 }}
                  className="w-full aspect-video rounded-[2rem] bg-secondary border border-border relative overflow-hidden group cursor-pointer"
                >
                  <img
                    src="https://images.unsplash.com/photo-1516627145497-ae6968895b74?w=1200&h=800&fit=crop"
                    alt="Video thumbnail"
                    className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                    <div className="w-20 h-20 rounded-full bg-white/30 backdrop-blur-md flex items-center justify-center text-white border border-white/40 group-hover:bg-primary group-hover:border-primary transition-all duration-300 shadow-xl">
                      <Play className="w-8 h-8 ml-1" fill="currentColor" />
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Photos */}
              {(() => {
                const displayPhotos = photoUrls.length > 0 ? photoUrls : [
                  "https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37?w=800&fit=crop",
                  "https://images.unsplash.com/photo-1511895426328-dc8714191300?w=800&fit=crop",
                  "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=800&fit=crop",
                ];
                return (
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 1.1 }}
                    className="grid grid-cols-2 md:grid-cols-3 gap-4"
                  >
                    {displayPhotos.map((url, i) => (
                      <div
                        key={i}
                        className={`rounded-3xl overflow-hidden bg-secondary aspect-square ${i === 0 ? "md:col-span-2 md:aspect-[2/1]" : ""}`}
                      >
                        <img src={url} alt="Memory" className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </motion.div>
                );
              })()}

              {/* Balance Reveal */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 1.3 }}
                className="w-full bg-primary text-primary-foreground rounded-[2.5rem] p-10 md:p-16 text-center relative overflow-hidden shadow-2xl shadow-primary/20"
              >
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/10 rounded-full blur-3xl" />

                <div className="relative z-10 flex flex-col items-center">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 backdrop-blur-sm mb-6 text-sm font-medium">
                    <Sparkles className="w-4 h-4" />
                    <span>{mockGiftData.intent}</span>
                  </div>

                  <h3 className="text-xl md:text-2xl font-medium opacity-90 mb-2">You received</h3>
                  <div className="font-serif text-7xl md:text-9xl mb-8 tracking-tighter">
                    ${mockGiftData.amount}
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
              </motion.div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
