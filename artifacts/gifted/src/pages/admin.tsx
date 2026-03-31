import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Gift, DollarSign, Clock, CheckCircle2, RefreshCw, LogOut,
  ExternalLink, Copy, Check, Users, BadgeCheck, X,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
const API  = `${window.location.origin}${BASE}`;

interface Stats {
  total: number;
  paid: number;
  redeemed: number;
  pending: number;
  volume: number;
  pendingVolume: number;
  totalUsers: number;
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
  cashoutPaidAt: string | null;
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
  cashoutPaidAt: string | null;
  createdAt: string;
  senderEmail: string | null;
  payoutMethod: string | null;
  payoutHandle: string | null;
  reaction: string | null;
}

interface UserRow {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  payoutMethod: string | null;
  payoutHandle: string | null;
  createdAt: string;
  giftsSent: number;
  giftsReceived: number;
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

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtAmt(a: string | null) {
  if (!a) return "—";
  return `$${parseFloat(a).toFixed(2)}`;
}

function StatusBadge({ gift }: { gift: GiftRow }) {
  if (gift.redeemedAt && gift.cashoutPaidAt) return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">Paid out</span>;
  if (gift.redeemedAt)    return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">Awaiting payout</span>;
  if (gift.openedAt)      return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">Opened</span>;
  if (gift.paid)          return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">Paid · Unsent</span>;
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
  const [userRows, setUserRows] = useState<UserRow[]>([]);
  const [loading, setLoading]   = useState(false);
  const [tab, setTab]           = useState<"cashouts" | "all" | "users">("cashouts");
  const [copied, setCopied]     = useState<string | null>(null);
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);
  const [showPaidCashouts, setShowPaidCashouts] = useState(false);

  const headers = { "x-admin-key": key };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, c, g, u] = await Promise.all([
        fetch(`${API}/api/admin/stats`,   { headers }).then(r => r.json()),
        fetch(`${API}/api/admin/cashouts`,{ headers }).then(r => r.json()),
        fetch(`${API}/api/admin/gifts`,   { headers }).then(r => r.json()),
        fetch(`${API}/api/admin/users`,   { headers }).then(r => r.json()),
      ]);
      setStats(s);
      setCashouts(Array.isArray(c) ? c : []);
      setGiftRows(Array.isArray(g) ? g : []);
      setUserRows(Array.isArray(u) ? u : []);
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

  async function markCashoutPaid(id: string) {
    setMarkingPaid(id);
    try {
      const r = await fetch(`${API}/api/admin/gifts/${id}/mark-cashout-paid`, {
        method: "PATCH",
        headers,
      });
      if (r.ok) {
        setCashouts(prev => prev.map(c => c.id === id ? { ...c, cashoutPaidAt: new Date().toISOString() } : c));
        setGiftRows(prev => prev.map(g => g.id === id ? { ...g, cashoutPaidAt: new Date().toISOString() } : g));
        if (stats) setStats({ ...stats, pending: Math.max(0, stats.pending - 1) });
      }
    } finally {
      setMarkingPaid(null);
    }
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

  const pendingCashouts = cashouts.filter(c => !c.cashoutPaidAt);
  const paidCashouts    = cashouts.filter(c => !!c.cashoutPaidAt);

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
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: "Accounts",         value: stats.totalUsers,                      icon: Users,        color: "text-violet-600" },
              { label: "Total gifts",      value: stats.total,                           icon: Gift,         color: "text-foreground" },
              { label: "Paid gifts",       value: stats.paid,                            icon: CheckCircle2, color: "text-green-600"  },
              { label: "Awaiting payout",  value: stats.pending,                         icon: Clock,        color: "text-amber-600"  },
              { label: "Total volume",     value: `$${stats.volume.toFixed(2)}`,         icon: DollarSign,   color: "text-primary"    },
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

        {/* Pending payout volume callout */}
        {stats && stats.pendingVolume > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3.5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <Clock className="w-4 h-4 text-amber-600 shrink-0" />
              <p className="text-sm font-medium text-amber-900">
                <span className="font-bold">${stats.pendingVolume.toFixed(2)}</span> in payouts waiting to be sent
              </p>
            </div>
            <button onClick={() => setTab("cashouts")} className="text-xs font-semibold text-amber-700 hover:text-amber-900 whitespace-nowrap">
              View →
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 border-b border-border">
          {([
            ["cashouts", "Cashouts"],
            ["all",      "All Gifts"],
            ["users",    "Accounts"],
          ] as const).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
                tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
              {t === "cashouts" && pendingCashouts.length > 0 && (
                <span className="ml-2 px-1.5 py-0.5 text-xs bg-amber-100 text-amber-800 rounded-full font-bold">{pendingCashouts.length}</span>
              )}
              {t === "users" && (
                <span className="ml-2 px-1.5 py-0.5 text-xs bg-violet-100 text-violet-700 rounded-full font-bold">{userRows.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* ── Cashouts tab ── */}
        {tab === "cashouts" && (
          <div className="space-y-6">
            {/* Pending */}
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Pending — needs payout</h2>
              {pendingCashouts.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No pending cashouts</p>
                </div>
              ) : pendingCashouts.map(c => (
                <div key={c.id} className="bg-card border border-amber-200 rounded-2xl p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-base">{c.recipientName}</span>
                        <span className="text-muted-foreground text-sm">from {c.senderName}</span>
                        <span className="font-bold text-primary text-base">{fmtAmt(c.amount)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Redeemed {fmt(c.redeemedAt)}</p>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                      {c.payoutMethod && (
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
                          {c.payoutName && <span className="text-xs text-muted-foreground">({c.payoutName})</span>}
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <a
                          href={`/open/${c.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 rounded-lg border border-border hover:bg-muted transition-colors"
                          title="View gift"
                        >
                          <ExternalLink className="w-4 h-4 text-muted-foreground" />
                        </a>
                        <Button
                          size="sm"
                          onClick={() => markCashoutPaid(c.id)}
                          disabled={markingPaid === c.id}
                          className="gap-1.5 h-8 rounded-lg bg-green-600 hover:bg-green-700 text-white"
                        >
                          {markingPaid === c.id
                            ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            : <BadgeCheck className="w-3.5 h-3.5" />
                          }
                          Mark paid
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Paid history toggle */}
            {paidCashouts.length > 0 && (
              <div className="space-y-3">
                <button
                  onClick={() => setShowPaidCashouts(v => !v)}
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
                >
                  {showPaidCashouts ? <X className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  {showPaidCashouts ? "Hide" : "Show"} {paidCashouts.length} paid cashout{paidCashouts.length !== 1 ? "s" : ""}
                </button>
                {showPaidCashouts && paidCashouts.map(c => (
                  <div key={c.id} className="bg-card border border-border rounded-2xl p-5 opacity-60">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                          <span className="font-semibold text-base">{c.recipientName}</span>
                          <span className="text-muted-foreground text-sm">from {c.senderName}</span>
                          <span className="font-bold text-primary text-base">{fmtAmt(c.amount)}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">Paid out {fmt(c.cashoutPaidAt)}</p>
                      </div>
                      {c.payoutMethod && (
                        <div className="flex items-center gap-2">
                          <span
                            className="px-2.5 py-1 rounded-full text-xs font-bold text-white"
                            style={{ background: METHOD_COLORS[c.payoutMethod] ?? "#888" }}
                          >
                            {METHOD_LABELS[c.payoutMethod] ?? c.payoutMethod}
                          </span>
                          <span className="text-sm font-mono text-foreground">{c.payoutHandle}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── All Gifts tab ── */}
        {tab === "all" && (
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  {["Recipient", "Sender", "Amount", "Status", "Reaction", "Experience", "Created", ""].map(h => (
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
                    <td className="px-4 py-3 text-lg">{g.reaction ?? ""}</td>
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
                    <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground text-sm">No gifts yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Accounts tab ── */}
        {tab === "users" && (
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  {["Name", "Email", "Payout", "Joined", "Sent", "Received"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {userRows.map((u, i) => {
                  const name = [u.firstName, u.lastName].filter(Boolean).join(" ") || u.displayName || "—";
                  return (
                    <tr key={u.id} className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
                      <td className="px-4 py-3 font-medium whitespace-nowrap">{name}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{u.email ?? "—"}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {u.payoutMethod ? (
                          <div className="flex items-center gap-1.5">
                            <span
                              className="px-1.5 py-0.5 rounded-full text-[10px] font-bold text-white"
                              style={{ background: METHOD_COLORS[u.payoutMethod] ?? "#888" }}
                            >
                              {METHOD_LABELS[u.payoutMethod] ?? u.payoutMethod}
                            </span>
                            <span className="text-xs font-mono text-muted-foreground">{u.payoutHandle}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{fmtDate(u.createdAt)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${u.giftsSent > 0 ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}>
                          {u.giftsSent}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${u.giftsReceived > 0 ? "bg-green-100 text-green-700" : "text-muted-foreground"}`}>
                          {u.giftsReceived}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {userRows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground text-sm">No accounts yet</td>
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
