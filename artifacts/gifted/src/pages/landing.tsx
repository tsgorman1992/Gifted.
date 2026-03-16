import React from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Heart, Play, Music, Image as ImageIcon, CreditCard, Gift, Sparkles, ArrowRight } from "lucide-react";

export default function LandingPage() {
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
            <Button size="lg" variant="outline" className="w-full sm:w-auto rounded-full text-lg px-8 h-14 bg-white/50 backdrop-blur-sm hover:bg-white/80 transition-all duration-300">
              See how it works
            </Button>
          </motion.div>
        </div>
      </section>

      {/* How it works */}
      <section className="w-full max-w-6xl mx-auto py-24 px-6">
        <div className="text-center mb-16">
          <h2 className="font-serif text-4xl md:text-5xl font-medium mb-4">How it works</h2>
          <p className="text-lg text-muted-foreground">Personal in the moment. Flexible in the end.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { icon: Heart, title: "1. Add Meaning", desc: "Write a note, record a video, add photos, or link a playlist to set the mood." },
            { icon: Gift, title: "2. Add a Balance", desc: "Optionally add funds with an intention like 'Coffee on me' or 'Treat yourself'." },
            { icon: CreditCard, title: "3. They Redeem", desc: "They experience the reveal, then cash out their balance to Venmo or their bank." }
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
                <div className="h-64 relative">
                  <img src={`${import.meta.env.BASE_URL}images/theme-warm-glow.png`} alt="Gift theme" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/20" />
                  <div className="absolute bottom-6 left-6 text-white">
                    <p className="text-sm font-medium opacity-80 mb-1">A gift for</p>
                    <h3 className="font-serif text-4xl">Sarah</h3>
                  </div>
                </div>
                <div className="flex-1 p-8 flex flex-col gap-4">
                  <div className="w-3/4 h-4 bg-muted rounded-full" />
                  <div className="w-full h-4 bg-muted rounded-full" />
                  <div className="w-5/6 h-4 bg-muted rounded-full" />
                  
                  <div className="mt-auto p-4 rounded-xl border border-border flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Gift className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-bold">$150.00</p>
                        <p className="text-xs text-muted-foreground">Treat yourself</p>
                      </div>
                    </div>
                    <Button size="sm" variant="secondary" className="rounded-full">Reveal</Button>
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
