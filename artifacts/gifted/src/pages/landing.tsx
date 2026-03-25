import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Heart, Play, Music, Image as ImageIcon, CreditCard, Gift, Sparkles, ArrowRight, RotateCcw, ExternalLink, Link2 } from "lucide-react";

import { clearGiftSession, isGiftSessionStale } from "@/lib/session";

type Phase = "sealed" | "opening" | "revealed";

const PHOTOS = [
  "https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=200&h=160&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1552053831-71594a27632d?w=200&h=160&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1529543544282-ea669407fca3?w=200&h=160&fit=crop&auto=format",
];

const HOW_STEPS = [
  { icon: Heart,      label: "Build the moment",   desc: "Write a note that sounds like you. Add a video message, photos, or link anything — concert tickets, a restaurant reservation, a song." },
  { icon: Gift,       label: "Add a real balance",  desc: "Fund it with whatever feels right. Add a spending intention like 'Coffee on me' or 'Date night' so they know it was thoughtful, not lazy." },
  { icon: CreditCard, label: "They open. They feel it.", desc: "A choreographed reveal plays through your content. When it lands, they provide their payout details and our team sends the balance directly to them — same day." },
];

const FEATURES = [
  { icon: Play,       title: "Video Messages",  desc: "Record a heartfelt message they can keep forever." },
  { icon: ImageIcon,  title: "Photo Memories",  desc: "Add up to 6 photos to remind them of the good times." },
  { icon: Link2,      title: "Add Any Link",     desc: "Concert tickets, a dinner reservation, a song — anything with a URL becomes part of the gift." },
  { icon: CreditCard, title: "Flexible Funds",  desc: "No more restrictive gift cards. Recipients choose Venmo, Cash App, PayPal, or Zelle — and we send the balance same day." },
];

const LINK_DEMOS = [
  { label: "2 Tickets · The Weeknd",  sub: "Tap to view tickets"    },
  { label: "8pm Friday at Nobu",       sub: "Tap to view reservation" },
  { label: "Golden Hour – JVKE",       sub: "Tap to listen"           },
  { label: "Cabin in Big Sur",         sub: "Tap to view stay"        },
  { label: "Spa day · Sunday 2pm",     sub: "Tap to open"             },
];

export default function LandingPage() {
  const [, setLocation] = useLocation();
  const [phase, setPhase] = useState<Phase>("sealed");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [linkDemoIdx, setLinkDemoIdx] = useState(0);

  // Clear stale sessions when someone visits the homepage after 8+ hours.
  useEffect(() => {
    if (isGiftSessionStale()) clearGiftSession();
  }, []);

  // Cycle the link demo card when in revealed state
  useEffect(() => {
    if (phase !== "revealed") return;
    const id = setInterval(() => setLinkDemoIdx(i => (i + 1) % LINK_DEMOS.length), 2600);
    return () => clearInterval(id);
  }, [phase]);

  function handleNewGift() {
    clearGiftSession();
    setLocation("/create");
  }

  function startReveal() {
    if (timerRef.current) clearTimeout(timerRef.current);
    setPhase("opening");
    timerRef.current = setTimeout(() => setPhase("revealed"), 1400);
  }

  function handleReplay() {
    if (timerRef.current) clearTimeout(timerRef.current);
    setPhase("sealed");
    timerRef.current = setTimeout(startReveal, 1200);
  }

  useEffect(() => {
    timerRef.current = setTimeout(startReveal, 4000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  return (
    <div className="w-full flex flex-col items-center overflow-hidden">

      {/* ── Hero ── */}
      <section className="w-full relative py-12 md:py-24 px-6">
        <div className="absolute inset-0 z-0 overflow-hidden">
          <img
            src={`${import.meta.env.BASE_URL}images/hero-abstract.png`}
            alt="Warm abstract background"
            className="w-full h-full object-cover opacity-60 mix-blend-multiply"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/50 to-background" />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto w-full grid lg:grid-cols-[1fr_400px] gap-10 lg:gap-16 items-center">
          <div className="flex flex-col items-center lg:items-start text-center lg:text-left">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: "easeOut" }}
            className="font-serif text-5xl md:text-7xl lg:text-8xl font-medium leading-[1.1] tracking-tight text-foreground mb-4 md:mb-6"
          >
            Send more than <br /><span className="text-primary italic">just a gift.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
            className="text-base md:text-xl text-muted-foreground max-w-xl mb-8 md:mb-10 leading-relaxed"
          >
            A video, your photos, a personal note, and real money they can actually use. All wrapped into one moment they'll remember.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
            className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto"
          >
            <Button onClick={handleNewGift} size="lg" className="w-full sm:w-auto rounded-full text-base md:text-lg px-8 h-13 md:h-14 shadow-xl shadow-primary/20 hover:-translate-y-1 transition-all duration-300">
              Build a moment
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="w-full sm:w-auto rounded-full text-base md:text-lg px-8 h-13 md:h-14 bg-white/50 backdrop-blur-sm hover:bg-white/80 transition-all duration-300"
              onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })}
            >
              See how it works
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="flex flex-row flex-wrap items-center gap-x-5 gap-y-1.5 mt-5"
          >
            {["No account needed", "3 minutes", "Same-day payouts"].map((t, i) => (
              <span key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap">
                <span className="w-1.5 h-1.5 rounded-full bg-primary/60 shrink-0" />
                {t}
              </span>
            ))}
          </motion.div>
          </div>{/* end left col */}

          {/* Right column: interactive demo */}
          <div className="relative w-full mx-auto lg:mx-0">
            <div className="absolute -inset-4 bg-gradient-to-tr from-primary/20 to-accent/20 rounded-[2.5rem] transform rotate-3 blur-xl opacity-50 pointer-events-none" />
            <div className="relative bg-card rounded-[2rem] border border-border shadow-2xl overflow-hidden aspect-[3/5] flex flex-col">

              {/* Header */}
              <div className="h-36 sm:h-52 relative overflow-hidden flex-shrink-0">
                <AnimatePresence mode="wait">
                  {phase !== "revealed" ? (
                    <motion.div key="envelope" className="absolute inset-0" exit={{ opacity: 0, scale: 1.04 }} transition={{ duration: 0.35 }}>
                      <div className="absolute inset-0" style={{ background: "linear-gradient(160deg, #E8A87C, #D4813A, #b8632a)" }} />
                      <div className="absolute inset-0 pointer-events-none overflow-hidden">
                        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom-right, transparent 49.5%, rgba(0,0,0,0.12) 49.5%, rgba(0,0,0,0.12) 50.5%, transparent 50.5%)" }} />
                        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom-left, transparent 49.5%, rgba(0,0,0,0.12) 49.5%, rgba(0,0,0,0.12) 50.5%, transparent 50.5%)" }} />
                      </div>
                      <motion.div
                        className="absolute top-0 left-0 right-0 pointer-events-none"
                        style={{ height: "55%", clipPath: "polygon(0 0, 100% 0, 50% 85%)", background: "linear-gradient(180deg, #c06b2a, #D4813A)", transformOrigin: "top center" }}
                        animate={phase === "opening" ? { rotateX: -170, opacity: 0 } : { rotateX: 0, opacity: 1 }}
                        transition={{ duration: 0.75, ease: [0.25, 0.1, 0.25, 1] }}
                      />
                      <motion.div
                        className="absolute inset-0 flex flex-col items-center justify-center gap-2"
                        animate={phase === "opening" ? { opacity: 0, scale: 0.85, y: 10 } : { opacity: 1, scale: 1, y: 0 }}
                        transition={{ duration: 0.4 }}
                      >
                        <motion.div
                          className="w-14 h-14 rounded-full bg-red-700 shadow-lg flex items-center justify-center border-2 border-red-400/40"
                          animate={phase === "sealed" ? { scale: [1, 1.05, 1] } : {}}
                          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                        >
                          <Heart className="w-7 h-7 text-white fill-white" />
                        </motion.div>
                        <div className="text-center mt-1">
                          <p className="text-white/70 text-xs tracking-wide uppercase font-medium">A gift for</p>
                          <p className="text-white font-serif text-3xl mt-0.5">Sarah</p>
                        </div>
                      </motion.div>
                      {phase === "opening" && (
                        <motion.div
                          className="absolute inset-0 pointer-events-none"
                          style={{ background: "linear-gradient(105deg, transparent 30%, rgba(255,220,130,0.55) 50%, transparent 70%)", backgroundSize: "200% 100%" }}
                          initial={{ backgroundPosition: "-100% 0" }}
                          animate={{ backgroundPosition: "200% 0" }}
                          transition={{ duration: 0.9, ease: "easeInOut" }}
                        />
                      )}
                    </motion.div>
                  ) : (
                    <motion.div key="gradient-header" className="absolute inset-0" initial={{ opacity: 0, scale: 1.06 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
                      <div className="absolute inset-0 animate-gradient-shift" style={{ background: "linear-gradient(270deg, #F7C59F, #E8A87C, #c9622a, #e8956a, #F7C59F)" }} />
                      <div className="absolute inset-0 bg-black/15" />
                      <motion.div className="absolute inset-0 flex items-center justify-center pointer-events-none" animate={{ scale: [1, 1.08, 1], opacity: [0.12, 0.22, 0.12] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}>
                        <div className="w-44 h-44 rounded-full border border-white/25" />
                      </motion.div>
                      <div className="absolute bottom-5 left-6 text-white">
                        <p className="text-xs font-medium opacity-75 mb-0.5">A gift for</p>
                        <h3 className="font-serif text-4xl">Sarah</h3>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Content */}
              <div className="flex-1 p-4 flex flex-col gap-2 overflow-hidden">
                <AnimatePresence mode="wait">
                  {phase === "sealed" && (
                    <motion.div key="sealed-body" exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }} className="flex flex-col gap-3">
                      <div className="w-3/4 h-3.5 bg-muted rounded-full animate-pulse" />
                      <div className="w-full h-3.5 bg-muted rounded-full animate-pulse" />
                      <div className="flex gap-1.5 mt-0.5">
                        {[{ icon: ImageIcon, label: "3 Photos" }, { icon: Play, label: "Video" }, { icon: Link2, label: "Link" }].map(({ icon: Icon, label }) => (
                          <span key={label} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-muted text-muted-foreground text-xs">
                            <Icon className="w-3 h-3" />{label}
                          </span>
                        ))}
                      </div>
                      <motion.button
                        onClick={startReveal}
                        className="mt-1 w-full py-2.5 rounded-xl text-sm font-medium text-white shadow-md flex items-center justify-center gap-2 cursor-pointer"
                        style={{ background: "linear-gradient(135deg, hsl(28,62%,36%), hsl(28,62%,48%))" }}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.97 }}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        Tap to open
                      </motion.button>
                    </motion.div>
                  )}
                  {phase === "opening" && (
                    <motion.div key="opening-body" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-2.5">
                      {[1, 2, 3].map(i => (
                        <motion.div key={i} className="h-3.5 bg-muted rounded-full" style={{ width: `${[75, 100, 85][i - 1]}%` }} animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }} />
                      ))}
                    </motion.div>
                  )}
                  {phase === "revealed" && (
                    <motion.div key="revealed-body" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} className="flex flex-col gap-2.5">
                      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
                        <p className="font-serif text-base font-medium leading-snug">Happy Birthday, Sarah 🎂</p>
                        <p className="text-xs text-muted-foreground">You deserve something wonderful today.</p>
                      </motion.div>
                      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="flex gap-1.5">
                        {PHOTOS.map((src, i) => (
                          <div key={i} className="flex-1 h-16 rounded-lg overflow-hidden bg-muted">
                            <img src={src} alt="" className="w-full h-full object-cover" loading="lazy" />
                          </div>
                        ))}
                      </motion.div>
                      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="relative rounded-xl overflow-hidden" style={{ height: "120px", background: "linear-gradient(135deg,#1a1a2e,#2d1b4e)" }}>
                        <img src="https://images.unsplash.com/photo-1519046904884-53103b34b206?w=320&h=180&fit=crop&auto=format" alt="" className="absolute inset-0 w-full h-full object-cover opacity-30 blur-[1px] scale-105" loading="lazy" />
                        <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 55%)" }} />
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/25 backdrop-blur-sm flex items-center justify-center">
                          <Play className="w-4 h-4 text-white ml-0.5" />
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 px-3 pb-2.5 flex items-end gap-2">
                          <div className="flex-1">
                            <p className="text-white text-[10px] font-medium mb-1.5 leading-none">Video message</p>
                            <div className="w-full h-[3px] rounded-full bg-white/25 overflow-hidden">
                              <motion.div className="h-full rounded-full bg-white/80" animate={{ width: ["0%", "45%"] }} transition={{ delay: 0.5, duration: 1.8, ease: "easeOut" }} />
                            </div>
                          </div>
                          <p className="text-white/50 text-[10px] shrink-0 pb-0.5">0:42</p>
                        </div>
                      </motion.div>
                      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="flex items-center gap-2.5 px-3 h-11 rounded-xl border border-primary/20 bg-primary/5 overflow-hidden">
                        <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 flex-shrink-0" style={{ background: "hsl(28,62%,36%)" }}>
                          <Link2 className="w-3.5 h-3.5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0 relative h-9 flex flex-col justify-center">
                          <AnimatePresence mode="wait">
                            <motion.div key={linkDemoIdx} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.28 }} className="absolute inset-0 flex flex-col justify-center">
                              <p className="text-xs font-medium truncate">{LINK_DEMOS[linkDemoIdx].label}</p>
                              <p className="text-xs text-muted-foreground">{LINK_DEMOS[linkDemoIdx].sub}</p>
                            </motion.div>
                          </AnimatePresence>
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Balance card */}
                <div className="mt-auto p-3 rounded-xl border border-border flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <motion.div animate={phase === "revealed" ? { scale: [1, 1.3, 1] } : {}} transition={{ duration: 0.45 }} className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                      <Gift className="w-4 h-4 text-primary" />
                    </motion.div>
                    <div>
                      <p className="text-sm font-bold">$50.00</p>
                      <p className="text-xs text-muted-foreground">Treat yourself</p>
                    </div>
                  </div>
                  {phase === "revealed" ? (
                    <Button size="sm" variant="outline" className="rounded-full h-8 text-xs gap-1" onClick={handleReplay}>
                      <RotateCcw className="w-3 h-3" />Replay
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground animate-pulse">
                      {phase === "opening" ? "Opening…" : ""}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>{/* end right col */}

        </div>{/* end grid */}
      </section>

      {/* ── How It Works ── */}
      <section id="how-it-works" className="w-full max-w-6xl mx-auto py-12 md:py-24 px-6">
        <div className="text-center mb-8 md:mb-16">
          <h2 className="font-serif text-3xl md:text-5xl font-medium mb-3">How it works</h2>
          <p className="text-base md:text-lg text-muted-foreground">Personal in the moment. Flexible in the end.</p>
        </div>

        {/* Mobile: vertical timeline */}
        <div className="md:hidden">
          {HOW_STEPS.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.12, duration: 0.45, ease: "easeOut" }}
              className="flex gap-4"
            >
              {/* Left: circle + connector */}
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm shrink-0 shadow-md shadow-primary/25">
                  {i + 1}
                </div>
                {i < HOW_STEPS.length - 1 && (
                  <div className="w-px flex-1 bg-border my-2 min-h-[2rem]" />
                )}
              </div>

              {/* Right: content */}
              <div className={`flex-1 pt-1.5 ${i < HOW_STEPS.length - 1 ? "pb-8" : "pb-2"}`}>
                <div className="flex items-center gap-2 mb-1.5">
                  <step.icon className="w-4 h-4 text-primary shrink-0" />
                  <h3 className="font-bold text-base">{step.label}</h3>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Desktop: 3-column cards */}
        <div className="hidden md:grid grid-cols-3 gap-8">
          {HOW_STEPS.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.2 }}
              className="bg-card rounded-3xl p-8 border border-border shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                <step.icon className="w-7 h-7 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-3">{i + 1}. {step.label}</h3>
              <p className="text-muted-foreground leading-relaxed">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Features strip ── */}
      <section className="w-full bg-secondary/30 py-10 md:py-16 px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
          {FEATURES.map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.4 }}
              className="flex flex-col gap-3"
            >
              <div className="w-10 h-10 rounded-full bg-background shadow-sm flex items-center justify-center">
                <feature.icon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h4 className="text-sm font-bold">{feature.title}</h4>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{feature.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="w-full py-16 md:py-32 px-6 text-center">
        <div className="max-w-2xl mx-auto space-y-5 md:space-y-8">
          <h2 className="font-serif text-3xl md:text-6xl font-medium">Someone out there<br />deserves this.</h2>
          <p className="text-base md:text-xl text-muted-foreground">Takes 3 minutes. No account needed to start.</p>
          <div className="pt-2 md:pt-4">
            <Button onClick={handleNewGift} size="lg" className="w-full sm:w-auto rounded-full text-base md:text-lg px-10 h-13 md:h-14 shadow-xl hover:-translate-y-1 transition-all duration-300">
              Get Started <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </div>
        </div>
      </section>

    </div>
  );
}
