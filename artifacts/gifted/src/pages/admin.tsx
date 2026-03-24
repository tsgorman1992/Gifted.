import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Gift, DollarSign, Clock, CheckCircle2, RefreshCw, LogOut, ExternalLink, Copy, Check } from "lucide-react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
const API  = `${window.location.origin}${BASE}`;

interface Stats {
  total: number;
  paid: number;
  redeemed: number;
  pending: number;
  volume: number;
  pendingVolume: number;
}

interface Cashout {
  id: string;
  recipientName: string;
  senderName: string;
  amount: string | null;
  payoutMethod: string | null;
  payoutHandle: string | null;
  payoutName: string | null;
  redeemedAt: string | null;
  createdAt: string;
}

interface GiftRow {
  id: string;
  recipientName: string;
  senderName: string;
  amount: string | null;
  paid: boolean;
  experience: string;
  occasion: string;
  openedAt: string | null;
  redeemedAt: string | null;
  createdAt: string;
  senderEmail: string | null;
  payoutMethod: string | null;
  payoutHandle: string | null;
  reaction: string | null;
}

const METHOD_LABELS: Record<string, string> = {
  venmo:   "Venmo",
  cashapp: "Cash App",
  paypal:  "PayPal",
  zelle:   "Zelle",
};

const METHOD_COLORS: Record<string, string> = {
  venmo:   "#008CFF",
  cashapp: "#00D632",
  paypal:  "#003087",
  zelle:   "#6D1ED4",
};

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function fmtAmt(a: string | null) {
  if (!a) return "—";
  return `$${parseFloat(a).toFixed(2)}`;
}

function StatusBadge({ gift }: { gift: GiftRow }) {
  if (gift.redeemedAt)    return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">Redeemed</span>;
  if (gift.openedAt)      return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">Opened</span>;
  if (gift.paid)          return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">Paid · Unsent</span>;
  return                         <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground">Draft</span>;
}

export default function AdminPage() {
  const [key, setKey]           = useState(() => sessionStorage.getItem("admin_key") ?? "");
  const [authed, setAuthed]     = useState(false);
  const [checking, setChecking] = useState(false);
  const [authErr, setAuthErr]   = useState("");

  const [stats, setStats]       = useState<Stats | null>(null);
  const [cashouts, setCashouts] = useState<Cashout[]>([]);
  const [giftRows, setGiftRows] = useState<GiftRow[]>([]);
  const [loading, setLoading]   = useState(false);
  const [tab, setTab]           = useState<"cashouts" | "all">("cashouts");
  const [copied, setCopied]     = useState<string | null>(null);

  const headers = { "x-admin-key": key };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, c, g] = await Promise.all([
        fetch(`${API}/api/admin/stats`, { headers }).then(r => r.json()),
        fetch(`${API}/api/admin/cashouts`, { headers }).then(r => r.json()),
        fetch(`${API}/api/admin/gifts`, { headers }).then(r => r.json()),
      ]);
      setStats(s);
      setCashouts(Array.isArray(c) ? c : []);
      setGiftRows(Array.isArray(g) ? g : []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [key]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setChecking(true);
    setAuthErr("");
    try {
      const r = await fetch(`${API}/api/admin/stats`, { headers: { "x-admin-key": key } });
      if (r.status === 401 || r.status === 503) {
        setAuthErr("Incorrect password.");
        setChecking(false);
        return;
      }
      sessionStorage.setItem("admin_key", key);
      setAuthed(true);
    } catch {
      setAuthErr("Could not connect.");
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    if (authed) load();
  }, [authed, load]);

  function copyHandle(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(text);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm">
          <h1 className="font-serif text-3xl font-medium text-center mb-2">gifted.</h1>
          <p className="text-center text-muted-foreground text-sm mb-8">Operator dashboard</p>
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="password"
              placeholder="Admin password"
              value={key}
              onChange={e => setKey(e.target.value)}
              className="w-full border border-border rounded-xl px-4 py-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              autoFocus
            />
            {authErr && <p className="text-sm text-destructive">{authErr}</p>}
            <Button type="submit" className="w-full h-11 rounded-xl" disabled={checking || !key}>
              {checking ? "Checking…" : "Sign in"}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-xl font-medium">gifted. <span className="text-muted-foreground font-sans font-normal text-sm">/ operator</span></h1>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-1.5 h-8">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button variant="ghost" size="sm" onClick={() => { sessionStorage.removeItem("admin_key"); setAuthed(false); }} className="gap-1.5 h-8 text-muted-foreground">
            <LogOut className="w-3.5 h-3.5" />
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total gifts",      value: stats.total,                       icon: Gift,         color: "text-foreground" },
              { label: "Paid gifts",       value: stats.paid,                        icon: CheckCircle2, color: "text-green-600" },
              { label: "Pending cashouts", value: stats.pending,                     icon: Clock,        color: "text-amber-600" },
              { label: "Total volume",     value: `$${stats.volume.toFixed(2)}`,     icon: DollarSign,   color: "text-primary" },
            ].map(s => (
              <div key={s.label} className="bg-card border border-border rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{s.label}</p>
                  <s.icon className={`w-4 h-4 ${s.color}`} />
                </div>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 border-b border-border">
          {([["cashouts", "Pending Cashouts"], ["all", "All Gifts"]] as const).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
                tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
              {t === "cashouts" && cashouts.length > 0 && (
                <span className="ml-2 px-1.5 py-0.5 text-xs bg-amber-100 text-amber-800 rounded-full font-bold">{cashouts.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* Pending Cashouts */}
        {tab === "cashouts" && (
          <div className="space-y-3">
            {cashouts.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No pending cashouts</p>
              </div>
            ) : cashouts.map(c => (
              <div key={c.id} className="bg-card border border-border rounded-2xl p-5">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-base">{c.recipientName}</span>
                      <span className="text-muted-foreground text-sm">from {c.senderName}</span>
                      <span className="font-bold text-primary text-base">{fmtAmt(c.amount)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Requested {fmt(c.redeemedAt)}</p>
                  </div>

                  {c.payoutMethod && (
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground mb-0.5">Send to</p>
                        <div className="flex items-center gap-2">
                          <span
                            className="px-2.5 py-1 rounded-full text-xs font-bold text-white"
                            style={{ background: METHOD_COLORS[c.payoutMethod] ?? "#888" }}
                          >
                            {METHOD_LABELS[c.payoutMethod] ?? c.payoutMethod}
                          </span>
                          <button
                            onClick={() => copyHandle(c.payoutHandle ?? "")}
                            className="flex items-center gap-1 text-sm font-mono text-foreground hover:text-primary transition-colors"
                          >
                            {c.payoutHandle}
                            {copied === c.payoutHandle
                              ? <Check className="w-3.5 h-3.5 text-green-600" />
                              : <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                            }
                          </button>
                        </div>
                        {c.payoutName && <p className="text-xs text-muted-foreground mt-0.5">{c.payoutName}</p>}
                      </div>
                      <a
                        href={`/open/${c.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 rounded-lg border border-border hover:bg-muted transition-colors"
                        title="View gift"
                      >
                        <ExternalLink className="w-4 h-4 text-muted-foreground" />
                      </a>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* All Gifts */}
        {tab === "all" && (
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  {["Recipient", "Sender", "Amount", "Status", "Experience", "Created", ""].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {giftRows.map((g, i) => (
                  <tr key={g.id} className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
                    <td className="px-4 py-3 font-medium whitespace-nowrap">{g.recipientName}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{g.senderName}</td>
                    <td className="px-4 py-3 font-semibold text-primary whitespace-nowrap">{fmtAmt(g.amount)}</td>
                    <td className="px-4 py-3"><StatusBadge gift={g} /></td>
                    <td className="px-4 py-3 text-muted-foreground capitalize text-xs whitespace-nowrap">{g.experience.replace(/-/g, " ")}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{fmt(g.createdAt)}</td>
                    <td className="px-4 py-3">
                      <a href={`/open/${g.id}`} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </td>
                  </tr>
                ))}
                {giftRows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground text-sm">No gifts yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
