import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-context";
import { Loader2, CheckCircle2, User, Wallet, ArrowLeft } from "lucide-react";

type PayoutMethod = "venmo" | "cashapp" | "zelle" | "";

interface Profile {
  displayName: string | null;
  payoutMethod: string | null;
  payoutHandle: string | null;
}

const PAYOUT_OPTIONS: { value: PayoutMethod; label: string; placeholder: string }[] = [
  { value: "venmo",   label: "Venmo",    placeholder: "@your-venmo-handle"  },
  { value: "cashapp", label: "Cash App", placeholder: "$your-cashtag"       },
  { value: "zelle",   label: "Zelle",    placeholder: "Phone or email"      },
];

const base = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function AccountPage() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading, user } = useAuth();

  const [profile, setProfile] = useState<Profile>({ displayName: null, payoutMethod: null, payoutHandle: null });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [payoutMethod, setPayoutMethod] = useState<PayoutMethod>("");
  const [payoutHandle, setPayoutHandle] = useState("");

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
        setProfile(data);
        setDisplayName(data.displayName || "");
        setPayoutMethod((data.payoutMethod as PayoutMethod) || "");
        setPayoutHandle(data.payoutHandle || "");
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [isAuthenticated]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`${base}/api/gifted/profile`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: displayName.trim() || null,
          payoutMethod: payoutMethod || null,
          payoutHandle: payoutHandle.trim() || null,
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
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setLocation("/my-gifts")}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-serif text-3xl font-medium">Account settings</h1>
            <p className="text-muted-foreground text-sm mt-0.5">{user?.email}</p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-8">

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
      </motion.div>
    </div>
  );
}
