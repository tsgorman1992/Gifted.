import React, { useState } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Heart, Play, Music, Image as ImageIcon, CreditCard, Gift, Sparkles, ArrowRight, Check } from "lucide-react";

export default function LandingPage() {
  const [revealed, setRevealed] = useState(false);
  const [playingMusic, setPlayingMusic] = useState(false);

  return (
    <div className="w-full flex flex-col items-center overflow-hidden">
      {/* Hero Section */}
      <section className="w-full relative min-h-[90vh] flex items-center justify-center pt-12 pb-24 px-6">
        <div className="absolute inset-0 z-0 overflow-hidden">
          <img 
            src={`${import.meta.env.BASE_URL}images/hero-abstract.png`} 
            alt="Warm abstract background" 
            className="w-full h-full object-cover opacity-60 mix-blend-multiply"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/50 to-background" />
        </div>
        
        <div className="relative z-10 max-w-4xl mx-auto text-center flex flex-col items-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/80 backdrop-blur-sm border border-border mb-8 text-sm font-medium text-secondary-foreground"
          >
            <Sparkles className="w-4 h-4 text-primary" />
            <span>A new way to send money & meaning</span>
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: "easeOut" }}
            className="font-serif text-5xl md:text-7xl lg:text-8xl font-medium leading-[1.1] tracking-tight text-foreground mb-6"
          >
            Send more than <br/><span className="text-primary italic">just a gift.</span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
            className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-10 leading-relaxed"
          >
            Combine a personal message, video, photos, and a flexible cash balance into one unforgettable digital experience.
          </motion.p>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
            className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto"
          >
            <Link href="/create">
              <Button size="lg" className="w-full sm:w-auto rounded-full text-lg px-8 h-14 shadow-xl shadow-primary/20 hover:-translate-y-1 transition-all duration-300">
                Create a gift
              </Button>
            </Link>
            <Button
              size="lg"
              variant="outline"
              className="w-full sm:w-auto rounded-full text-lg px-8 h-14 bg-white/50 backdrop-blur-sm hover:bg-white/80 transition-all duration-300"
              onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })}
            >
              See how it works
            </Button>
          </motion.div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="w-full max-w-6xl mx-auto py-24 px-6">
        <div className="text-center mb-16">
          <h2 className="font-serif text-4xl md:text-5xl font-medium mb-4">How it works</h2>
          <p className="text-lg text-muted-foreground">Personal in the moment. Flexible in the end.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { icon: Heart, title: "1. Add Meaning", desc: "Write a note, record a video, add photos, or link a playlist to set the mood." },
            { icon: Gift, title: "2. Add a Balance", desc: "Optionally add funds with an intention like 'Coffee on me' or 'Treat yourself'." },
            { icon: CreditCard, title: "3. They Redeem", desc: "They experience the reveal, then instantly transfer their balance to a debit card or bank account." }
          ].map((step, i) => (
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
              <h3 className="text-xl font-bold mb-3">{step.title}</h3>
              <p className="text-muted-foreground leading-relaxed">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features Grid */}
      <section className="w-full bg-secondary/30 py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
              <h2 className="font-serif text-4xl md:text-5xl font-medium leading-tight">
                Everything they need to feel special.
              </h2>
              <ul className="space-y-6">
                {[
                  { icon: Play, title: "Video Messages", desc: "Record a heartfelt message they can keep forever." },
                  { icon: ImageIcon, title: "Photo Memories", desc: "Add up to 6 photos to remind them of the good times." },
                  { icon: Music, title: "Curated Playlists", desc: "Attach a Spotify or Apple Music link to set the vibe." },
                  { icon: CreditCard, title: "Flexible Funds", desc: "No more restrictive gift cards. They cash out how they want." },
                ].map((feature, i) => (
                  <li key={i} className="flex gap-4">
                    <div className="mt-1 w-10 h-10 rounded-full bg-background shadow-sm flex items-center justify-center shrink-0">
                      <feature.icon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="text-lg font-bold">{feature.title}</h4>
                      <p className="text-muted-foreground mt-1">{feature.desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            
            {/* Visual Mockup */}
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-accent/20 rounded-[2.5rem] transform rotate-3 blur-xl opacity-50" />
              <div className="relative bg-card rounded-[2rem] border border-border shadow-2xl overflow-hidden aspect-[4/5] flex flex-col">
                <div className="h-64 relative overflow-hidden">
                  <div
                    className="absolute inset-0 animate-gradient-shift"
                    style={{ background: "linear-gradient(270deg, #F7C59F, #E8A87C, #c9622a, #e8956a, #F7C59F)" }}
                  />
                  <div className="absolute inset-0 bg-black/20" />
                  {/* Subtle inner glow rings */}
                  <motion.div
                    className="absolute inset-0 flex items-center justify-center pointer-events-none"
                    animate={{ scale: [1, 1.08, 1], opacity: [0.15, 0.25, 0.15] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <div className="w-48 h-48 rounded-full border border-white/30" />
                  </motion.div>
                  <div className="absolute bottom-6 left-6 text-white">
                    <p className="text-sm font-medium opacity-80 mb-1">A gift for</p>
                    <h3 className="font-serif text-4xl">Sarah</h3>
                  </div>
                </div>
                <div className="flex-1 p-5 flex flex-col gap-2.5 overflow-hidden">
                  <AnimatePresence mode="wait">
                    {!revealed ? (
                      <motion.div
                        key="sealed"
                        initial={{ opacity: 1 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.25 }}
                        className="flex flex-col gap-3"
                      >
                        {/* Skeleton lines */}
                        <div className="w-3/4 h-3.5 bg-muted rounded-full" />
                        <div className="w-full h-3.5 bg-muted rounded-full" />
                        {/* Feature pills hinting what's inside */}
                        <div className="flex gap-1.5 mt-1">
                          {[
                            { icon: ImageIcon, label: "3 Photos" },
                            { icon: Play,      label: "Video" },
                            { icon: Music,     label: "Playlist" },
                          ].map(({ icon: Icon, label }) => (
                            <span key={label} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-muted text-muted-foreground text-xs">
                              <Icon className="w-3 h-3" />{label}
                            </span>
                          ))}
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="revealed"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.2 }}
                        className="flex flex-col gap-2.5"
                      >
                        {/* Message */}
                        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
                          <p className="font-serif text-base font-medium leading-snug">Happy Birthday, Sarah 🎂</p>
                          <p className="text-xs text-muted-foreground leading-relaxed">You deserve something wonderful today.</p>
                        </motion.div>

                        {/* Photo strip */}
                        <motion.div
                          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                          className="flex gap-1.5"
                        >
                          {[
                            "linear-gradient(135deg,#FBBF9A,#F7875B)",
                            "linear-gradient(135deg,#A8D8F0,#7BB8E8)",
                            "linear-gradient(135deg,#B5EAD7,#7DC9AD)",
                          ].map((bg, i) => (
                            <div key={i} className="flex-1 h-14 rounded-lg flex items-center justify-center" style={{ background: bg }}>
                              <ImageIcon className="w-4 h-4 text-white/70" />
                            </div>
                          ))}
                        </motion.div>

                        {/* Video row */}
                        <motion.div
                          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
                          className="flex items-center gap-2.5 px-3 h-11 rounded-xl"
                          style={{ background: "linear-gradient(135deg,#1a1a2e,#2d1b4e)" }}
                        >
                          <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                            <Play className="w-3 h-3 text-white ml-0.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-xs font-medium">Video message</p>
                            <div className="w-16 h-1 rounded-full bg-white/20 mt-1 overflow-hidden">
                              <motion.div
                                className="h-full rounded-full bg-white/60"
                                animate={{ width: ["0%", "45%"] }}
                                transition={{ delay: 0.6, duration: 1.5, ease: "easeOut" }}
                              />
                            </div>
                          </div>
                          <p className="text-white/50 text-xs shrink-0">0:42</p>
                        </motion.div>

                        {/* Playlist row */}
                        <motion.button
                          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
                          onClick={() => setPlayingMusic(p => !p)}
                          className="flex items-center gap-2.5 px-3 h-11 rounded-xl border border-green-200/60 dark:border-green-800/40 bg-green-50 dark:bg-green-950/30 w-full cursor-pointer"
                        >
                          <div className="w-7 h-7 rounded-md bg-green-500 flex items-center justify-center shrink-0">
                            <Music className="w-3.5 h-3.5 text-white" />
                          </div>
                          <div className="flex-1 min-w-0 text-left">
                            <p className="text-xs font-medium truncate">Golden Hour – JVKE</p>
                            <p className="text-xs text-muted-foreground">Your birthday playlist</p>
                          </div>
                          <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center shrink-0">
                            {playingMusic ? (
                              <div className="flex gap-[2px] items-end h-3.5">
                                {[0, 1, 2].map(i => (
                                  <motion.div
                                    key={i}
                                    className="w-[3px] rounded-full bg-white"
                                    animate={{ height: ["4px", "10px", "6px", "12px", "4px"] }}
                                    transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.18, ease: "easeInOut" }}
                                  />
                                ))}
                              </div>
                            ) : (
                              <Play className="w-2.5 h-2.5 text-white ml-0.5" />
                            )}
                          </div>
                        </motion.button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Balance + Reveal */}
                  <div className="mt-auto p-3.5 rounded-xl border border-border flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <motion.div
                        animate={revealed ? { scale: [1, 1.3, 1] } : {}}
                        transition={{ duration: 0.45 }}
                        className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center"
                      >
                        <Gift className="w-4 h-4 text-primary" />
                      </motion.div>
                      <div>
                        <p className="text-sm font-bold">$150.00</p>
                        <p className="text-xs text-muted-foreground">Treat yourself</p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant={revealed ? "default" : "secondary"}
                      className="rounded-full transition-all duration-300 h-8 text-xs"
                      onClick={() => setRevealed(true)}
                      disabled={revealed}
                    >
                      {revealed
                        ? <><Check className="w-3 h-3 mr-1" />Opened</>
                        : "Reveal"
                      }
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA / Waitlist */}
      <section className="w-full py-32 px-6 text-center">
        <div className="max-w-2xl mx-auto space-y-8">
          <h2 className="font-serif text-4xl md:text-6xl font-medium">Ready to send <br/>something meaningful?</h2>
          <p className="text-xl text-muted-foreground">Create your first gift in minutes. No sign up required to build a preview.</p>
          <div className="pt-4">
            <Link href="/create">
              <Button size="lg" className="rounded-full text-lg px-10 h-14 shadow-xl hover:-translate-y-1 transition-all duration-300">
                Get Started <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
