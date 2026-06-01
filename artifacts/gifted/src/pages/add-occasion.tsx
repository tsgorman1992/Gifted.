import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { Cake, CheckCircle2, ArrowLeft, Loader2 } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/+$/, "");

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

function daysInMonth(month: number): number {
  return new Date(2024, month, 0).getDate();
}

export default function AddOccasionPage() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading } = useAuth();

  const fromSignup = new URLSearchParams(window.location.search).get("from") === "signup";

  const [name, setName]   = useState("");
  const [month, setMonth] = useState("");
  const [day, setDay]     = useState("");
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [saved, setSaved]     = useState(false);
  const [savedName, setSavedName] = useState("");

  useEffect(() => {
    if (!isLoading && !isAuthenticated) setLocation("/my-gifts");
  }, [isLoading, isAuthenticated, setLocation]);

  const maxDay = month ? daysInMonth(parseInt(month)) : 31;
  const dayOptions = Array.from({ length: maxDay }, (_, i) => i + 1);

  const handleMonthChange = (m: string) => {
    setMonth(m);
    if (day && parseInt(day) > daysInMonth(parseInt(m))) setDay("");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !month || !day) return;
    setSaving(true);
    setError(null);
    try {
      const contactRes = await fetch(`${BASE}/api/gifted/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!contactRes.ok) {
        const d = await contactRes.json().catch(() => ({}));
        throw new Error((d as any).error || "Failed to save contact");
      }
      const contact = await contactRes.json();

      const occasionRes = await fetch(`${BASE}/api/gifted/contacts/${contact.id}/occasions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ label: "Birthday", month: parseInt(month), day: parseInt(day) }),
      });
      if (!occasionRes.ok) {
        const d = await occasionRes.json().catch(() => ({}));
        throw new Error((d as any).error || "Failed to save birthday");
      }

      setSavedName(name.trim());
      setSaved(true);
      setTimeout(() => setLocation("/my-gifts"), 2500);
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center px-5 pb-24">
      <AnimatePresence mode="wait">

        {saved ? (
          <motion.div
            key="saved"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="text-center max-w-sm"
          >
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>
            <h1 className="font-serif text-3xl font-medium mb-3">Done!</h1>
            <p className="text-muted-foreground text-base leading-relaxed">
              We'll remind you before{" "}
              <span className="font-semibold text-foreground">{savedName}</span>'s birthday so you have time to make it special.
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-md"
          >
            {/* Logo */}
            <div className="text-center mb-3">
              <a href="/" className="font-serif text-3xl font-bold text-foreground tracking-tight hover:opacity-70 transition-opacity">
                gifted<span className="text-primary">.</span>
              </a>
            </div>

            {/* Heading */}
            <div className="text-center mb-8">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Cake className="w-7 h-7 text-primary" />
              </div>
              <h1 className="font-serif text-3xl font-medium mb-2">
                {fromSignup ? "One last thing — who matters to you?" : "Add a birthday reminder"}
              </h1>
              <p className="text-muted-foreground text-sm leading-relaxed max-w-xs mx-auto">
                {fromSignup
                  ? "Save a birthday now and we'll remind you a week before so you can plan something special."
                  : "We'll remind you 7 days before and again on the day — so you're never scrambling last minute."}
              </p>
            </div>

            {/* Form card */}
            <div className="bg-card border border-border rounded-3xl p-8 shadow-sm">
              <form onSubmit={handleSave} className="space-y-5">
                {/* Name */}
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                    Their name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Mom, Taylor, Alex"
                    required
                    autoFocus
                    className="w-full h-11 px-4 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
                  />
                </div>

                {/* Birthday — month + day */}
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                    Their birthday
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <select
                      value={month}
                      onChange={e => handleMonthChange(e.target.value)}
                      required
                      className="h-11 px-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition text-foreground"
                    >
                      <option value="">Month</option>
                      {MONTHS.map((m, i) => (
                        <option key={m} value={String(i + 1)}>{m}</option>
                      ))}
                    </select>
                    <select
                      value={day}
                      onChange={e => setDay(e.target.value)}
                      required
                      className="h-11 px-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition text-foreground"
                    >
                      <option value="">Day</option>
                      {dayOptions.map(d => (
                        <option key={d} value={String(d)}>{d}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-sm text-red-500 text-center"
                  >
                    {error}
                  </motion.p>
                )}

                <Button
                  type="submit"
                  size="lg"
                  disabled={saving || !name.trim() || !month || !day}
                  className="w-full h-12 rounded-full text-base shadow-md"
                >
                  {saving
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</>
                    : "Save & remind me"}
                </Button>
              </form>

              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => setLocation("/my-gifts")}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Skip for now
                </button>
              </div>
            </div>

            {!fromSignup && (
              <div className="mt-5 text-center">
                <button
                  onClick={() => setLocation("/my-gifts")}
                  className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" /> Back to dashboard
                </button>
              </div>
            )}
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
