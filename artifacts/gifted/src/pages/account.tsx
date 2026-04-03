import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-context";
import { Loader2, CheckCircle2, User, Wallet, ArrowLeft, LogOut, Cake } from "lucide-react";

type PayoutMethod = "venmo" | "cashapp" | "zelle" | "";

interface Profile {
  displayName: string | null;
  payoutMethod: string | null;
  payoutHandle: string | null;
  birthday: string | null;
}

const PAYOUT_OPTIONS: { value: PayoutMethod; label: string; placeholder: string }[] = [
  { value: "venmo",   label: "Venmo",    placeholder: "@your-venmo-handle"  },
  { value: "cashapp", label: "Cash App", placeholder: "$your-cashtag"       },
  { value: "zelle",   label: "Zelle",    placeholder: "Phone or email"      },
];

const MONTHS = [
  { value: "01", label: "January" },
  { value: "02", label: "February" },
  { value: "03", label: "March" },
  { value: "04", label: "April" },
  { value: "05", label: "May" },
  { value: "06", label: "June" },
  { value: "07", label: "July" },
  { value: "08", label: "August" },
  { value: "09", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

function daysInMonth(month: string): number {
  const m = parseInt(month, 10);
  if ([1, 3, 5, 7, 8, 10, 12].includes(m)) return 31;
  if ([4, 6, 9, 11].includes(m)) return 30;
  return 29; // February — allow 29 for leap years
}

const base = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function AccountPage() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading, user, logout } = useAuth();

  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [error, setError]           = useState<string | null>(null);

  const [displayName, setDisplayName]   = useState("");
  const [payoutMethod, setPayoutMethod] = useState<PayoutMethod>("");
  const [payoutHandle, setPayoutHandle] = useState("");
  const [bdMonth, setBdMonth]           = useState("");
  const [bdDay, setBdDay]               = useState("");

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setLocation("/sign-in");
    }
  }, [isLoading, isAuthenticated, setLocation]);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetch(`${base}/api/gifted/profile`, { credentials: "include" })
      .then(r => r.json())
      .then((data: Profile) => {
        setDisplayName(data.displayName || "");
        setPayoutMethod((data.payoutMethod as PayoutMethod) || "");
        setPayoutHandle(data.payoutHandle || "");
        if (data.birthday) {
          const [mm, dd] = data.birthday.split("-");
          setBdMonth(mm || "");
          setBdDay(dd || "");
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [isAuthenticated]);

  // Keep day in range when month changes
  useEffect(() => {
    if (bdMonth && bdDay) {
      const max = daysInMonth(bdMonth);
      if (parseInt(bdDay, 10) > max) setBdDay(String(max).padStart(2, "0"));
    }
  }, [bdMonth]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    const birthday = bdMonth && bdDay ? `${bdMonth}-${bdDay}` : null;

    try {
      const res = await fetch(`${base}/api/gifted/profile`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName:  displayName.trim() || null,
          payoutMethod: payoutMethod || null,
          payoutHandle: payoutHandle.trim() || null,
          birthday,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(d.error || "Failed to save");
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  const selectedPayout = PAYOUT_OPTIONS.find(o => o.value === payoutMethod);
  const dayOptions = bdMonth
    ? Array.from({ length: daysInMonth(bdMonth) }, (_, i) => String(i + 1).padStart(2, "0"))
    : Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0"));

  if (isLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="space-y-8"
      >
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => setLocation("/my-gifts")}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors self-start"
          >
            <ArrowLeft className="w-4 h-4" />
            My Gifts
          </button>
          <h1 className="font-serif text-3xl font-medium mt-2">Account settings</h1>
          <p className="text-muted-foreground text-sm">{user?.email}</p>
        </div>

        <form onSubmit={handleSave} noValidate className="space-y-8">

          {/* Display name */}
          <section className="space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-4 h-4 text-primary" />
              </div>
              <h2 className="text-base font-semibold">Default sender name</h2>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="displayName" className="text-sm text-muted-foreground">
                Pre-fills your name when you create a gift
              </Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="e.g. Alex, Mom, The Joneses"
                className="h-11 rounded-xl"
                maxLength={60}
              />
            </div>
          </section>

          {/* Birthday */}
          <section className="space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Cake className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h2 className="text-base font-semibold">Your birthday</h2>
                <p className="text-xs text-muted-foreground">We'll celebrate you — no birth year needed</p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-1 space-y-1.5">
                <Label className="text-sm text-muted-foreground">Month</Label>
                <select
                  value={bdMonth}
                  onChange={e => { setBdMonth(e.target.value); setBdDay(""); }}
                  className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Month</option>
                  {MONTHS.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
              <div className="w-28 space-y-1.5">
                <Label className="text-sm text-muted-foreground">Day</Label>
                <select
                  value={bdDay}
                  onChange={e => setBdDay(e.target.value)}
                  disabled={!bdMonth}
                  className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-40"
                >
                  <option value="">Day</option>
                  {dayOptions.map(d => (
                    <option key={d} value={d}>{parseInt(d, 10)}</option>
                  ))}
                </select>
              </div>
              {(bdMonth || bdDay) && (
                <div className="flex items-end pb-0.5">
                  <button
                    type="button"
                    onClick={() => { setBdMonth(""); setBdDay(""); }}
                    className="h-11 px-3 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              We'll send you a little something on your birthday — no spam, just a moment from us.
            </p>
          </section>

          {/* Payout preference */}
          <section className="space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Wallet className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h2 className="text-base font-semibold">Payout preference</h2>
                <p className="text-xs text-muted-foreground">How you'd like to receive gift payouts — same day</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {PAYOUT_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setPayoutMethod(opt.value === payoutMethod ? "" : opt.value);
                    if (opt.value !== payoutMethod) setPayoutHandle("");
                  }}
                  className={`h-11 rounded-xl border text-sm font-medium transition-all ${
                    payoutMethod === opt.value
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {payoutMethod && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-1.5"
              >
                <Label htmlFor="payoutHandle" className="text-sm text-muted-foreground">
                  {selectedPayout?.label} handle
                </Label>
                <Input
                  id="payoutHandle"
                  value={payoutHandle}
                  onChange={e => setPayoutHandle(e.target.value)}
                  placeholder={selectedPayout?.placeholder}
                  className="h-11 rounded-xl"
                  maxLength={80}
                />
              </motion.div>
            )}

            <p className="text-xs text-muted-foreground leading-relaxed">
              When a recipient redeems a gift balance you sent, we'll reach out to transfer the funds using the method above. Payouts are processed same day.
            </p>
          </section>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <Button
            type="submit"
            disabled={saving}
            className="w-full h-12 rounded-xl text-sm font-semibold"
          >
            {saving
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</>
              : saved
                ? <><CheckCircle2 className="w-4 h-4 mr-2" /> Saved!</>
                : "Save settings"
            }
          </Button>
        </form>

        <div className="pt-4 border-t border-border">
          <button
            type="button"
            onClick={logout}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </motion.div>
    </div>
  );
}
