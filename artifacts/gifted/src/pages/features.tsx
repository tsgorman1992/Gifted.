import React, { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Bell, Calendar, Gift, Heart, Play, Image as ImageIcon, Link2, CreditCard,
  ArrowRight, Check, Cake, Users, Sparkles, Clock, Zap, MessageSquare,
  ChevronRight, PartyPopper, Smile,
} from "lucide-react";
import { clearGiftSession } from "@/lib/session";

// ─── Link demo cycling examples ──────────────────────────────────────────────
const LINK_DEMOS = [
  { label: "2 Tickets · The Weeknd",  sub: "Tap to view tickets"    },
  { label: "8pm Friday at Nobu",       sub: "Tap to view reservation" },
  { label: "Golden Hour – JVKE",       sub: "Tap to listen"           },
  { label: "Cabin in Big Sur",         sub: "Tap to view stay"        },
  { label: "Spa day · Sunday 2pm",     sub: "Tap to open"             },
  { label: "Apple Music mix",          sub: "Tap to listen"           },
];

// ─── shared animation helpers ────────────────────────────────────────────────
const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.55, delay, ease: [0.16, 1, 0.3, 1] },
});

// ─── Mock UI primitives ───────────────────────────────────────────────────────
function PhoneFrame({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative mx-auto ${className}`} style={{ maxWidth: 300 }}>
      <div className="absolute -inset-6 bg-gradient-to-tr from-primary/25 to-amber-200/30 rounded-[3rem] blur-2xl opacity-60 pointer-events-none" />
      <div className="relative bg-card border border-border rounded-[2rem] shadow-2xl overflow-hidden">
        {/* notch */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-14 h-1.5 bg-border rounded-full" />
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Section: Hero ────────────────────────────────────────────────────────────
function HeroSection({ onStart }: { onStart: () => void }) {
  return (
    <section className="w-full relative overflow-hidden" style={{ background: "linear-gradient(160deg, #1a1209 0%, #2c1a08 50%, #1a1209 100%)" }}>
      {/* ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/20 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-12 md:py-32">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* left */}
          <div className="flex flex-col items-center lg:items-start text-center lg:text-left">
            <motion.div {...fadeUp(0.05)} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/25 bg-white/10 text-white text-xs font-medium mb-6">
              <Sparkles className="w-3 h-3" /> The complete gifting platform
            </motion.div>

            <motion.h1 {...fadeUp(0.1)} className="font-serif text-4xl md:text-6xl lg:text-7xl font-medium leading-[1.1] text-white mb-5">
              Your gifts. <br />
              <span style={{ color: "hsl(28,75%,65%)" }} className="italic">Tracked. Timed.<br />Remembered.</span>
            </motion.h1>

            <motion.p {...fadeUp(0.2)} className="text-base md:text-xl text-white/60 max-w-lg mb-8 leading-relaxed">
              gifted. is more than a gift builder — it's the layer between you and the people who matter most. Personal moments, real money, birthday reminders, live tracking. All in one place.
            </motion.p>

            <motion.div {...fadeUp(0.28)} className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <Button onClick={onStart} size="lg" className="rounded-full px-8 h-13 text-base shadow-xl shadow-primary/30 hover:-translate-y-0.5 transition-all">
                Build a moment <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
              <Button size="lg" variant="outline" asChild className="hidden sm:flex rounded-full px-8 h-13 text-base border-white/20 text-white bg-white/5 hover:bg-white/10">
                <a href="#features">Explore features</a>
              </Button>
            </motion.div>

            <motion.div {...fadeUp(0.35)} className="flex flex-wrap gap-x-6 gap-y-2 mt-6 text-xs text-white/40">
              {["No account needed to start", "Same-day payouts", "Free to try"].map(t => (
                <span key={t} className="flex items-center gap-1.5"><Check className="w-3 h-3 text-primary/70" />{t}</span>
              ))}
            </motion.div>
          </div>

          {/* right — dashboard preview mockup */}
          <motion.div {...fadeUp(0.15)} className="w-full">
            <PhoneFrame className="w-full">
              <div className="p-4 space-y-3 pb-6">
                {/* mini header */}
                <div className="flex items-center justify-between mb-1">
                  <span className="font-serif text-base font-bold">gifted.</span>
                  <div className="relative">
                    <Bell className="w-4 h-4 text-muted-foreground" />
                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-primary text-white text-[8px] font-bold flex items-center justify-center">3</span>
                  </div>
                </div>

                {/* stat cards */}
                <div className="grid grid-cols-2 gap-2">
                  {[{ label: "Sent", value: "12" }, { label: "Opened", value: "8", highlight: true }, { label: "Redeemed", value: "5" }, { label: "Total Gifted", value: "$640" }].map(s => (
                    <div key={s.label} className={`rounded-xl p-2.5 border ${s.highlight ? "border-primary/30 bg-primary/8" : "border-border bg-secondary/40"}`}>
                      <p className="text-[10px] text-muted-foreground">{s.label}</p>
                      <p className={`text-lg font-bold leading-tight ${s.highlight ? "text-primary" : ""}`}>{s.value}</p>
                    </div>
                  ))}
                </div>

                {/* notification feed preview */}
                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="px-3 py-2 border-b border-border bg-secondary/30">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Notifications</p>
                  </div>
                  {[
                    { icon: Cake, color: "bg-rose-50 text-rose-500", text: "Sarah's Birthday is today", sub: "Don't forget to send a gift!" },
                    { icon: PartyPopper, color: "bg-green-50 text-green-600", text: "Mike redeemed his $75 gift", sub: "Birthday Dinner" },
                    { icon: Gift, color: "bg-primary/10 text-primary", text: "Emma opened your gift", sub: "Happy Graduation" },
                  ].map((n, i) => (
                    <div key={i} className="flex items-center gap-2.5 px-3 py-2.5 border-b border-border last:border-0">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${n.color}`}>
                        <n.icon className="w-3 h-3" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-medium leading-tight truncate">{n.text}</p>
                        <p className="text-[9px] text-muted-foreground">{n.sub}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* contact quick-gift */}
                <div className="flex items-center gap-2.5 p-2.5 rounded-xl border border-border">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-primary text-xs font-bold">S</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold">Sarah Chen</p>
                    <p className="text-[10px] text-amber-600 font-medium flex items-center gap-1"><Cake className="w-2.5 h-2.5" />Birthday today</p>
                  </div>
                  <button className="text-[10px] px-2 py-1 rounded-full font-medium text-primary border border-primary/30 bg-primary/5">Gift her</button>
                </div>
              </div>
            </PhoneFrame>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ─── Section: The Gift Moment ─────────────────────────────────────────────────
function GiftMomentSection() {
  const [linkIdx, setLinkIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setLinkIdx(i => (i + 1) % LINK_DEMOS.length), 2600);
    return () => clearInterval(id);
  }, []);

  return (
    <section id="features" className="w-full py-20 md:py-28 px-6 bg-background">
      <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
        {/* mockup — gift UI */}
        <motion.div {...fadeUp(0)} className="order-last lg:order-first">
          <PhoneFrame>
            <div className="p-4 space-y-3 pb-6">
              {/* gift header */}
              <div className="rounded-2xl overflow-hidden aspect-video relative" style={{ background: "linear-gradient(160deg, #E8A87C, #c06b2a)" }}>
                <div className="absolute inset-0 bg-black/10" />
                <div className="absolute bottom-3 left-4 text-white">
                  <p className="text-[10px] opacity-70">A gift for</p>
                  <p className="font-serif text-2xl">Sarah</p>
                </div>
              </div>

              {/* note */}
              <div>
                <p className="font-serif text-sm font-medium leading-snug">Happy Birthday, Sarah 🎂</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">You deserve something wonderful today. I've been thinking about you — here's a little something from the heart.</p>
              </div>

              {/* photos */}
              <div className="flex gap-1.5">
                {["photo-1464349153735-7db50ed83c84","photo-1527529482837-4698179dc6ce","photo-1516450360452-9312f5e86fc7"].map(id => (
                  <div key={id} className="flex-1 aspect-square rounded-lg overflow-hidden bg-muted">
                    <img src={`https://images.unsplash.com/${id}?w=80&h=80&fit=crop&auto=format`} alt="" className="w-full h-full object-cover" loading="lazy" />
                  </div>
                ))}
              </div>

              {/* video */}
              <div className="relative rounded-xl overflow-hidden" style={{ height: 80, background: "linear-gradient(135deg,#1a1a2e,#2d1b4e)" }}>
                <img src="https://images.unsplash.com/photo-1590523277543-a94d2e4eb00b?w=320&h=160&fit=crop&auto=format" alt="" className="absolute inset-0 w-full h-full object-cover opacity-50" loading="lazy" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full bg-white/25 flex items-center justify-center backdrop-blur-sm">
                    <Play className="w-3.5 h-3.5 text-white ml-0.5" />
                  </div>
                </div>
                <p className="absolute bottom-2 left-3 text-white/70 text-[9px]">Video message · 0:42</p>
              </div>

              {/* link — cycles through examples */}
              <div className="flex items-center gap-2 p-2.5 rounded-xl border border-primary/20 bg-primary/5 overflow-hidden">
                <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ background: "hsl(28,62%,36%)" }}>
                  <Link2 className="w-3 h-3 text-white" />
                </div>
                <div className="relative flex-1 min-w-0 h-8">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={linkIdx}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      transition={{ duration: 0.25 }}
                      className="absolute inset-0 flex flex-col justify-center"
                    >
                      <p className="text-[10px] font-medium truncate">{LINK_DEMOS[linkIdx].label}</p>
                      <p className="text-[9px] text-muted-foreground">{LINK_DEMOS[linkIdx].sub}</p>
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>

              {/* balance */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-secondary/30">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Gift className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">$75.00</p>
                    <p className="text-[10px] text-muted-foreground">Date night 🌙</p>
                  </div>
                </div>
                <button className="text-[10px] px-3 py-1.5 rounded-full font-semibold text-white" style={{ background: "hsl(28,62%,36%)" }}>Redeem</button>
              </div>
            </div>
          </PhoneFrame>
        </motion.div>

        {/* copy */}
        <div className="flex flex-col gap-6">
          <motion.div {...fadeUp(0.05)}>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium mb-4">
              <Heart className="w-3 h-3" /> The gift itself
            </div>
            <h2 className="font-serif text-3xl md:text-5xl font-medium leading-tight mb-4">
              Every layer of the moment — in one gift.
            </h2>
            <p className="text-base text-muted-foreground leading-relaxed">
              gifted. isn't a gift card. It's a full moment: your words, your face, your memories, and money they can actually use — all choreographed into an experience they'll feel.
            </p>
          </motion.div>

          <div className="flex flex-col gap-3">
            {[
              { icon: MessageSquare, title: "Personal note", desc: "Write something that actually sounds like you." },
              { icon: Play, title: "Video message", desc: "Record or upload a video they can replay forever." },
              { icon: ImageIcon, title: "Up to 6 photos", desc: "Shared memories that put the gift in context." },
              { icon: Link2, title: "Any link", desc: "Concert tickets, a song, a dinner reservation — anything with a URL." },
              { icon: CreditCard, title: "Real cash balance", desc: 'Optional. Add an amount with a spending intention: "Date night", "Coffee on me", "Treat yourself".' },
            ].map((f, i) => (
              <motion.div key={f.title} {...fadeUp(0.08 + i * 0.06)} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <f.icon className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{f.title}</p>
                  <p className="text-sm text-muted-foreground">{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Section: Scheduled Delivery ─────────────────────────────────────────────
function ScheduledSection() {
  const days = ["Su","Mo","Tu","We","Th","Fr","Sa"];
  const dates = [null,null,null,null,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31];

  return (
    <section className="w-full py-20 md:py-28 px-6" style={{ background: "hsl(28,40%,97%)" }}>
      <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
        {/* copy */}
        <div className="flex flex-col gap-6">
          <motion.div {...fadeUp(0)}>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium mb-4">
              <Clock className="w-3 h-3" /> Build ahead, share when ready
            </div>
            <h2 className="font-serif text-3xl md:text-5xl font-medium leading-tight mb-4">
              Build it today. <span className="text-primary italic">Share it when the moment arrives.</span>
            </h2>
            <p className="text-base text-muted-foreground leading-relaxed">
              Put the gift together on your own time — weeks in advance if you want. Set a reminder for the day, and gifted. will nudge you when it's time. You share the link directly from your phone, just like a text.
            </p>
          </motion.div>

          <div className="flex flex-col gap-3">
            {[
              "Build the gift whenever you have time — days or weeks before the occasion",
              "Set a reminder and we'll alert you on the day so you don't forget to share",
              "You send the link yourself, from your number — it feels personal because it is",
              "They tap the link and the full gift experience opens instantly in their browser",
            ].map((t, i) => (
              <motion.div key={i} {...fadeUp(0.08 + i * 0.06)} className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="w-3 h-3 text-white" />
                </div>
                <p className="text-sm text-muted-foreground">{t}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* calendar mockup */}
        <motion.div {...fadeUp(0.1)}>
          <div className="relative mx-auto" style={{ maxWidth: 340 }}>
            <div className="absolute -inset-4 bg-primary/10 rounded-3xl blur-xl pointer-events-none" />
            <div className="relative bg-card border border-border rounded-3xl p-5 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <p className="font-semibold text-sm">December 2025</p>
                <div className="flex gap-1">
                  <div className="w-6 h-6 rounded-full border border-border flex items-center justify-center cursor-default">
                    <ChevronRight className="w-3 h-3 rotate-180 text-muted-foreground" />
                  </div>
                  <div className="w-6 h-6 rounded-full border border-border flex items-center justify-center cursor-default">
                    <ChevronRight className="w-3 h-3 text-muted-foreground" />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-1 mb-2">
                {days.map(d => <p key={d} className="text-[10px] text-center text-muted-foreground font-medium">{d}</p>)}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {dates.map((d, i) => (
                  <div key={i} className={`aspect-square flex items-center justify-center rounded-full text-xs font-medium cursor-default
                    ${d === 25 ? "bg-primary text-white shadow-md shadow-primary/30" : ""}
                    ${d === 20 || d === 22 ? "bg-secondary text-foreground" : ""}
                    ${d && d !== 25 && d !== 20 && d !== 22 ? "text-foreground hover:bg-secondary" : ""}
                    ${!d ? "" : ""}
                  `}>
                    {d}
                  </div>
                ))}
              </div>
              <div className="mt-4 p-3 rounded-2xl border border-primary/20 bg-primary/5 flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shrink-0">
                  <Bell className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-xs font-semibold">Reminder set · Dec 25</p>
                  <p className="text-[10px] text-muted-foreground">We'll remind you to share · Emma's gift</p>
                </div>
              </div>
              <div className="mt-2 p-3 rounded-2xl border border-border bg-secondary/40 flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Ready to share · Dec 20</p>
                  <p className="text-[10px] text-muted-foreground">Gift built & waiting · Mike's Anniversary</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ─── Section: Gift Tracking & Notifications ───────────────────────────────────
function TrackingSection() {
  return (
    <section className="w-full py-20 md:py-28 px-6" style={{ background: "linear-gradient(160deg, #1a1209 0%, #2c1a08 100%)" }}>
      <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
        {/* notification bell mockup */}
        <motion.div {...fadeUp(0)} className="order-last lg:order-first">
          <div className="relative mx-auto" style={{ maxWidth: 320 }}>
            <div className="absolute -inset-6 bg-primary/15 rounded-3xl blur-2xl pointer-events-none" />
            <div className="relative bg-card border border-border rounded-3xl shadow-2xl overflow-hidden">
              <div className="px-4 py-3.5 border-b border-border flex items-center justify-between bg-secondary/30">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Bell className="w-4 h-4 text-foreground" />
                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-primary text-white text-[8px] font-bold flex items-center justify-center">4</span>
                  </div>
                  <span className="text-sm font-semibold">Notifications</span>
                </div>
                <span className="text-xs text-muted-foreground">12 total</span>
              </div>
              <div className="divide-y divide-border">
                {[
                  { icon: Cake, bg: "bg-rose-50", ic: "text-rose-500", text: "Sarah's Birthday is today", sub: "Don't forget to send a gift!", time: "now", unread: true },
                  { icon: PartyPopper, bg: "bg-green-50", ic: "text-green-600", text: "Mike redeemed his $75 gift", sub: "Birthday Dinner", time: "2h ago", unread: true },
                  { icon: Gift, bg: "bg-primary/10", ic: "text-primary", text: "Emma opened your gift", sub: "Happy Graduation", time: "5h ago", unread: true },
                  { icon: Smile, bg: "bg-amber-50", ic: "text-amber-500", text: "Alex reacted 🎉 to your gift", sub: "Weekend Getaway", time: "1d ago", unread: false },
                  { icon: Cake, bg: "bg-rose-50", ic: "text-rose-500", text: "Tom's Anniversary is in 3 days", sub: "Coming up soon — send a gift", time: "1d ago", unread: false },
                ].map((n, i) => (
                  <div key={i} className="flex items-start gap-3 px-4 py-3">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${n.bg}`}>
                      <n.icon className={`w-3.5 h-3.5 ${n.ic}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs leading-snug ${n.unread ? "font-medium text-foreground" : "text-muted-foreground"}`}>{n.text}</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5">{n.sub}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-[9px] text-muted-foreground/50 whitespace-nowrap">{n.time}</span>
                      {n.unread && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* copy */}
        <div className="flex flex-col gap-6">
          <motion.div {...fadeUp(0.05)}>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/25 bg-white/10 text-white text-xs font-medium mb-4">
              <Bell className="w-3 h-3" /> Live tracking
            </div>
            <h2 className="font-serif text-3xl md:text-5xl font-medium leading-tight mb-4 text-white">
              Know the second your gift lands.
            </h2>
            <p className="text-base text-white/60 leading-relaxed">
              Your notification feed updates in real time. The moment your recipient opens the gift, claims the balance, or leaves a reaction — you'll see it immediately.
            </p>
          </motion.div>

          <div className="flex flex-col gap-4">
            {[
              { icon: Gift, title: "Opened", desc: "You'll know when they tap to reveal — not just delivered, but actually seen and felt." },
              { icon: PartyPopper, title: "Redeemed", desc: "Confirmed when they claim the cash. You know it worked." },
              { icon: Smile, title: "Reactions", desc: "Recipients can leave an emoji reaction so you feel the moment they did." },
              { icon: Cake, title: "Occasion reminders", desc: "3 days before and day-of, upcoming birthdays and occasions surface right in your feed." },
            ].map((f, i) => (
              <motion.div key={f.title} {...fadeUp(0.1 + i * 0.07)} className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                  <f.icon className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{f.title}</p>
                  <p className="text-sm text-white/50">{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Section: Occasion & Birthday Tracking ────────────────────────────────────
function OccasionSection() {
  return (
    <section className="w-full py-20 md:py-28 px-6 bg-background">
      <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
        {/* copy */}
        <div className="flex flex-col gap-6">
          <motion.div {...fadeUp(0)}>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium mb-4">
              <Cake className="w-3 h-3" /> Occasion tracking
            </div>
            <h2 className="font-serif text-3xl md:text-5xl font-medium leading-tight mb-4">
              Never miss a <span className="text-primary italic">meaningful date</span> again.
            </h2>
            <p className="text-base text-muted-foreground leading-relaxed">
              Add birthdays, anniversaries, and special occasions to your contacts. gifted. reminds you 3 days before and the morning of — right in your notification feed, with a one-tap shortcut to build the gift.
            </p>
          </motion.div>

          <div className="flex flex-col gap-3">
            {[
              "Birthdays, anniversaries, Mother's Day, Father's Day, Thanksgiving — any occasion",
              "Reminders appear 3 days before and again the day-of",
              "One tap from the reminder to start building their gift",
              "Floating holidays auto-calculate every year — set it once, forget it",
            ].map((t, i) => (
              <motion.div key={i} {...fadeUp(0.08 + i * 0.06)} className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="w-3 h-3 text-white" />
                </div>
                <p className="text-sm text-muted-foreground">{t}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* contacts mockup */}
        <motion.div {...fadeUp(0.1)}>
          <div className="relative mx-auto space-y-3" style={{ maxWidth: 340 }}>
            <div className="absolute -inset-4 bg-primary/8 rounded-3xl blur-xl pointer-events-none" />

            {/* amber reminder banner */}
            <div className="relative flex items-center gap-3 px-4 py-3 rounded-2xl border border-amber-200 bg-amber-50">
              <Bell className="w-4 h-4 text-amber-600 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-amber-900">Sarah's Birthday is today 🎂</p>
                <p className="text-[10px] text-amber-700">Dec 28 · Don't forget to send a gift</p>
              </div>
            </div>

            {/* contact cards */}
            {[
              {
                name: "Sarah Chen", initial: "S",
                occasions: [
                  { label: "Birthday", date: "Dec 28", hot: true },
                  { label: "Christmas", date: "Dec 25" },
                ],
              },
              {
                name: "Mike Torres", initial: "M",
                occasions: [
                  { label: "Anniversary", date: "Jan 14" },
                  { label: "Birthday", date: "Mar 5" },
                ],
              },
              {
                name: "Emma Walsh", initial: "E",
                occasions: [
                  { label: "Mother's Day", date: "May 11" },
                  { label: "Birthday", date: "Jul 22" },
                ],
              },
            ].map(c => (
              <div key={c.name} className="relative bg-card border border-border rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-primary text-sm font-bold">{c.initial}</span>
                    </div>
                    <p className="font-semibold text-sm">{c.name}</p>
                  </div>
                  <button className="text-[10px] px-2.5 py-1 rounded-full border border-primary/30 text-primary bg-primary/5 font-medium">Gift them</button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {c.occasions.map(o => (
                    <div key={o.label} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-medium ${o.hot ? "bg-amber-50 border border-amber-200 text-amber-800" : "bg-secondary text-muted-foreground"}`}>
                      <Cake className="w-2.5 h-2.5" />
                      {o.label} · {o.date}
                      {o.hot && <span className="text-amber-600 font-semibold">Today</span>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ─── Section: Gifting Circle ──────────────────────────────────────────────────
function GiftingCircleSection() {
  return (
    <section className="w-full py-20 md:py-28 px-6" style={{ background: "hsl(28,40%,97%)" }}>
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <motion.div {...fadeUp(0)}>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium mb-4">
              <Users className="w-3 h-3" /> Your gifting circle
            </div>
            <h2 className="font-serif text-3xl md:text-5xl font-medium leading-tight mb-4">
              Everyone who matters, in one place.
            </h2>
            <p className="text-base text-muted-foreground max-w-xl mx-auto">
              Your gifting history lives alongside each contact. Every person, every gift, every occasion — organized so you can keep showing up for the people you care about.
            </p>
          </motion.div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: Users, title: "Contact profiles", desc: "Name, phone, email — all in one card. Quick access to their gift history and upcoming occasions.", delay: 0 },
            { icon: Gift, title: "Gift history", desc: "See every gift you've sent or received, filtered by opened, redeemed, or scheduled.", delay: 0.08 },
            { icon: Zap, title: "One-tap gift", desc: 'Tap "Gift them" from any contact card to start building with their name and number pre-filled.', delay: 0.16 },
          ].map(f => (
            <motion.div key={f.title} {...fadeUp(f.delay)} className="bg-card rounded-3xl p-7 border border-border shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
                <f.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-bold text-base mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Section: Payout ─────────────────────────────────────────────────────────
function PayoutSection() {
  return (
    <section className="w-full py-20 md:py-28 px-6 bg-background">
      <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
        {/* payout mockup */}
        <motion.div {...fadeUp(0)} className="order-last lg:order-first">
          <div className="relative mx-auto" style={{ maxWidth: 320 }}>
            <div className="absolute -inset-4 bg-green-50 rounded-3xl blur-xl pointer-events-none" />
            <div className="relative bg-card border border-border rounded-3xl p-6 shadow-xl space-y-4">
              <div className="text-center pb-2 border-b border-border">
                <p className="text-3xl font-bold">$75.00</p>
                <p className="text-sm text-muted-foreground">Yours to claim — same day</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { name: "Venmo", color: "#3D95CE", abbr: "V" },
                  { name: "Cash App", color: "#00D632", abbr: "$" },
                  { name: "PayPal", color: "#003087", abbr: "P" },
                  { name: "Zelle", color: "#6B1F7C", abbr: "Z" },
                ].map(m => (
                  <button key={m.name} className="flex items-center gap-2.5 p-3 rounded-xl border border-border hover:border-primary/30 hover:bg-primary/5 transition-all text-left">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0" style={{ background: m.color }}>
                      {m.abbr}
                    </div>
                    <span className="text-sm font-medium">{m.name}</span>
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 p-3 rounded-xl bg-green-50 border border-green-100">
                <Zap className="w-4 h-4 text-green-600 shrink-0" />
                <p className="text-xs text-green-800 font-medium">Sent same day</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* copy */}
        <div className="flex flex-col gap-6">
          <motion.div {...fadeUp(0.05)}>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-50 text-green-700 text-xs font-medium border border-green-100 mb-4">
              <Zap className="w-3 h-3" /> Same-day payouts
            </div>
            <h2 className="font-serif text-3xl md:text-5xl font-medium leading-tight mb-4">
              Real money. Their way. <span className="text-primary italic">Same day.</span>
            </h2>
            <p className="text-base text-muted-foreground leading-relaxed">
              No gift cards. No restrictions. No waiting. Recipients choose how they want to receive the balance — Venmo, Cash App, PayPal, or Zelle — and we send it directly to them, same day.
            </p>
          </motion.div>

          <div className="flex flex-col gap-3">
            {[
              "They choose their preferred payout method — you don't need to know it in advance",
              "5% platform fee, shown upfront at checkout. No subscriptions, no surprises",
              "Payments processed securely by Stripe — PCI-compliant, bank-grade security",
              "Balances never expire. They can redeem when they're ready",
            ].map((t, i) => (
              <motion.div key={i} {...fadeUp(0.08 + i * 0.06)} className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="w-3 h-3 text-green-700" />
                </div>
                <p className="text-sm text-muted-foreground">{t}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}


// ─── Mobile: single visual + copy per feature ─────────────────────────────────
function MobileFeaturesScroll() {
  const days = ["S","M","T","W","T","F","S"];
  const dates = [null,null,null,null,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31];

  return (
    <section className="lg:hidden w-full bg-background">

      {/* ── 1. Dashboard ── */}
      <div className="px-5 py-10 border-b border-border">
        <motion.div {...fadeUp(0)}>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-4">
            <Bell className="w-3 h-3" /> Your dashboard
          </div>
          <h2 className="font-serif text-2xl font-medium leading-snug mb-2">
            Everything, always in view.
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-6">
            Stats, live notifications, and upcoming occasions — your gifting life at a glance the moment you open the app.
          </p>
        </motion.div>

        <motion.div {...fadeUp(0.1)}>
          <div className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-serif text-sm font-bold">gifted.</span>
              <div className="relative">
                <Bell className="w-4 h-4 text-muted-foreground" />
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-primary text-white text-[8px] font-bold flex items-center justify-center">3</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[{ l: "Sent", v: "12" }, { l: "Opened", v: "8", hi: true }, { l: "Redeemed", v: "5" }, { l: "Total Gifted", v: "$640" }].map(s => (
                <div key={s.l} className={`rounded-xl p-2.5 border ${s.hi ? "border-primary/30 bg-primary/8" : "border-border bg-secondary/40"}`}>
                  <p className="text-[10px] text-muted-foreground">{s.l}</p>
                  <p className={`text-base font-bold leading-tight ${s.hi ? "text-primary" : ""}`}>{s.v}</p>
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="px-3 py-2 border-b border-border bg-secondary/30">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Notifications</p>
              </div>
              {[
                { icon: Cake, bg: "bg-rose-50", ic: "text-rose-500", text: "Sarah's Birthday is today", sub: "Don't forget to send a gift!" },
                { icon: PartyPopper, bg: "bg-green-50", ic: "text-green-600", text: "Mike redeemed his $75 gift", sub: "Birthday Dinner" },
                { icon: Gift, bg: "bg-primary/10", ic: "text-primary", text: "Emma opened your gift", sub: "Happy Graduation" },
              ].map((n, i) => (
                <div key={i} className="flex items-center gap-2.5 px-3 py-2.5 border-b border-border last:border-0">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${n.bg}`}>
                    <n.icon className={`w-3 h-3 ${n.ic}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium leading-tight truncate">{n.text}</p>
                    <p className="text-[10px] text-muted-foreground">{n.sub}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2.5 p-2.5 rounded-xl border border-border">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-primary text-xs font-bold">S</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold">Sarah Chen</p>
                <p className="text-[10px] text-amber-600 font-medium flex items-center gap-1"><Cake className="w-2.5 h-2.5" />Birthday today</p>
              </div>
              <button className="text-[10px] px-2.5 py-1 rounded-full font-medium text-primary border border-primary/30 bg-primary/5 shrink-0">Gift her</button>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ── 2. Payout ── */}
      <div className="px-5 py-10 border-b border-border" style={{ background: "hsl(28,40%,98%)" }}>
        <motion.div {...fadeUp(0)}>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-50 text-green-700 text-xs font-medium border border-green-100 mb-4">
            <Zap className="w-3 h-3" /> Same-day payouts
          </div>
          <h2 className="font-serif text-2xl font-medium leading-snug mb-2">
            Real money. Their way. <span className="text-primary italic">Same day.</span>
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-6">
            No gift cards, no restrictions. They pick Venmo, Cash App, PayPal, or Zelle — and we send it directly, same day.
          </p>
        </motion.div>

        <motion.div {...fadeUp(0.1)}>
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
            <div className="text-center pb-3 border-b border-border">
              <p className="text-3xl font-bold">$75.00</p>
              <p className="text-sm text-muted-foreground">Yours to claim — same day</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { name: "Venmo", color: "#3D95CE", abbr: "V" },
                { name: "Cash App", color: "#00D632", abbr: "$" },
                { name: "PayPal", color: "#003087", abbr: "P" },
                { name: "Zelle", color: "#6B1F7C", abbr: "Z" },
              ].map(m => (
                <div key={m.name} className="flex items-center gap-2.5 p-3 rounded-xl border border-border">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0" style={{ background: m.color }}>
                    {m.abbr}
                  </div>
                  <span className="text-sm font-medium">{m.name}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 p-3 rounded-xl bg-green-50 border border-green-100">
              <Zap className="w-4 h-4 text-green-600 shrink-0" />
              <p className="text-xs text-green-800 font-medium">Sent same day</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ── 3. Scheduled / Calendar ── */}
      <div className="px-5 py-10 border-b border-border">
        <motion.div {...fadeUp(0)}>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-4">
            <Clock className="w-3 h-3" /> Build ahead
          </div>
          <h2 className="font-serif text-2xl font-medium leading-snug mb-2">
            Build it today. <span className="text-primary italic">Share it when the moment arrives.</span>
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-6">
            Create the gift weeks in advance, set a reminder, and we'll nudge you when it's time to share from your own phone.
          </p>
        </motion.div>

        <motion.div {...fadeUp(0.1)}>
          <div className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-sm">December 2025</p>
              <div className="flex gap-1">
                <div className="w-6 h-6 rounded-full border border-border flex items-center justify-center">
                  <ChevronRight className="w-3 h-3 rotate-180 text-muted-foreground" />
                </div>
                <div className="w-6 h-6 rounded-full border border-border flex items-center justify-center">
                  <ChevronRight className="w-3 h-3 text-muted-foreground" />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {days.map((d, i) => <p key={i} className="text-[10px] text-center text-muted-foreground font-medium">{d}</p>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {dates.map((d, i) => (
                <div key={i} className={`aspect-square flex items-center justify-center rounded-full text-xs font-medium
                  ${d === 25 ? "bg-primary text-white shadow-sm" : ""}
                  ${d === 20 || d === 22 ? "bg-secondary text-foreground" : ""}
                  ${d && d !== 25 && d !== 20 && d !== 22 ? "text-foreground" : ""}
                `}>
                  {d}
                </div>
              ))}
            </div>
            <div className="p-3 rounded-2xl border border-primary/20 bg-primary/5 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shrink-0">
                <Bell className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-xs font-semibold">Reminder set · Dec 25</p>
                <p className="text-[10px] text-muted-foreground">We'll remind you to share · Emma's gift</p>
              </div>
            </div>
            <div className="p-3 rounded-2xl border border-border bg-secondary/40 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Ready to share · Dec 20</p>
                <p className="text-[10px] text-muted-foreground">Gift built & waiting · Mike's Anniversary</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ── 4. Occasion tracking ── */}
      <div className="px-5 py-10 border-b border-border" style={{ background: "hsl(28,40%,98%)" }}>
        <motion.div {...fadeUp(0)}>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-4">
            <Cake className="w-3 h-3" /> Occasion tracking
          </div>
          <h2 className="font-serif text-2xl font-medium leading-snug mb-2">
            Never miss a <span className="text-primary italic">meaningful date</span> again.
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-6">
            Add birthdays and anniversaries to your contacts. We remind you 3 days before and the morning of — with a one-tap shortcut to start the gift.
          </p>
        </motion.div>

        <motion.div {...fadeUp(0.1)}>
          <div className="space-y-2.5">
            <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-amber-200 bg-amber-50">
              <Bell className="w-4 h-4 text-amber-600 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-amber-900">Sarah's Birthday is today 🎂</p>
                <p className="text-[10px] text-amber-700">Dec 28 · Don't forget to send a gift</p>
              </div>
            </div>
            {[
              { name: "Sarah Chen", init: "S", occasions: [{ label: "Birthday", date: "Dec 28", hot: true }, { label: "Christmas", date: "Dec 25" }] },
              { name: "Mike Torres", init: "M", occasions: [{ label: "Anniversary", date: "Jan 14" }, { label: "Birthday", date: "Mar 5" }] },
              { name: "Emma Walsh", init: "E", occasions: [{ label: "Mother's Day", date: "May 11" }, { label: "Birthday", date: "Jul 22" }] },
            ].map(c => (
              <div key={c.name} className="bg-card border border-border rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-primary text-sm font-bold">{c.init}</span>
                    </div>
                    <p className="font-semibold text-sm">{c.name}</p>
                  </div>
                  <button className="text-[10px] px-2.5 py-1 rounded-full border border-primary/30 text-primary bg-primary/5 font-medium">Gift them</button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {c.occasions.map(o => (
                    <div key={o.label} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-medium ${o.hot ? "bg-amber-50 border border-amber-200 text-amber-800" : "bg-secondary text-muted-foreground"}`}>
                      <Cake className="w-2.5 h-2.5" />
                      {o.label} · {o.date}
                      {o.hot && <span className="text-amber-600 font-semibold">Today</span>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* ── 5. Compact remaining features ── */}
      <div className="px-5 py-10">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">Also included</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: Gift,         title: "Full gift moment", desc: "Note, video, photos, a link, and real cash — one experience." },
            { icon: Play,         title: "Video message",    desc: "Record or upload a video they can replay forever." },
            { icon: ImageIcon,    title: "Up to 6 photos",   desc: "Shared memories that put the gift in context." },
            { icon: Link2,        title: "Any link",         desc: "Tickets, a song, a reservation — anything with a URL." },
            { icon: Users,        title: "Gifting circle",   desc: "Everyone you gift, their history, and occasions — organized." },
            { icon: Bell,         title: "Live tracking",    desc: "Know when they open it, redeem it, or react." },
          ].map((f, i) => (
            <motion.div key={f.title} {...fadeUp(i * 0.04)} className="p-3.5 rounded-2xl border border-border bg-card">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center mb-2.5">
                <f.icon className="w-4 h-4 text-primary" />
              </div>
              <p className="text-xs font-semibold mb-1 leading-snug">{f.title}</p>
              <p className="text-[10px] text-muted-foreground leading-snug">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Section: Final CTA ───────────────────────────────────────────────────────
function CtaSection({ onStart }: { onStart: () => void }) {
  return (
    <section className="w-full py-16 md:py-36 px-6" style={{ background: "linear-gradient(160deg, #1a1209 0%, #2c1a08 100%)" }}>
      <div className="max-w-3xl mx-auto text-center">
        <motion.div {...fadeUp(0)}>
          <div className="w-16 h-16 rounded-3xl bg-primary/20 flex items-center justify-center mx-auto mb-8">
            <Gift className="w-8 h-8 text-primary" />
          </div>
          <h2 className="font-serif text-4xl md:text-6xl font-medium text-white mb-5">
            Someone out there <br />deserves this.
          </h2>
          <p className="text-base md:text-xl text-white/50 mb-10 max-w-xl mx-auto">
            No account needed to build your first gift. Create one now, sign in to track everything.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button onClick={onStart} size="lg" className="rounded-full px-10 h-14 text-base shadow-xl shadow-primary/30 hover:-translate-y-0.5 transition-all">
              Build a moment <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
            <Button size="lg" variant="outline" asChild className="rounded-full px-10 h-14 text-base border-white/20 text-white bg-white/5 hover:bg-white/10">
              <Link href="/sign-in">Create free account</Link>
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function FeaturesPage() {
  const [, setLocation] = useLocation();

  function handleStart() {
    clearGiftSession();
    setLocation("/create");
  }

  return (
    <div className="w-full flex flex-col">
      <HeroSection onStart={handleStart} />
      {/* Mobile: single visual + copy per feature */}
      <MobileFeaturesScroll />
      {/* Desktop: full editorial sections with mockups */}
      <div className="hidden lg:block">
        <GiftMomentSection />
        <ScheduledSection />
        <TrackingSection />
        <OccasionSection />
        <GiftingCircleSection />
        <PayoutSection />
      </div>
      <CtaSection onStart={handleStart} />
    </div>
  );
}
