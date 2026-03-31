import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Gift, DollarSign, Clock, CheckCircle2, RefreshCw, LogOut,
  ExternalLink, Copy, Check, Users, BadgeCheck, X,
  TrendingUp, Percent, Repeat2, Sparkles, Search, Trash2,
  AlertTriangle, ChevronDown, ChevronUp,
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
  feeRevenue: number;
  avgAmount: number;
  totalUsers: number;
  newUsersWeek: number;
  openRate: number;
  redeemRate: number;
  repeatSenders: number;
  topExperience: string | null;
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
  venmo: "Venmo", cashapp: "Cash App", paypal: "PayPal", zelle: "Zelle",
};
const METHOD_COLORS: Record<string, string> = {
  venmo: "#008CFF", cashapp: "#00D632", paypal: "#003087", zelle: "#6D1ED4",
};
const EXP_LABELS: Record<string, string> = {
  "confetti-burst": "Confetti Burst",
  "midnight-stars": "Midnight Stars",
  "golden-hour":    "Golden Hour",
  "ocean-breeze":   "Ocean Breeze",
  "rose-garden":    "Rose Garden",
  "aurora-dreams":  "Aurora Dreams",
};

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}
function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}
function fmtAmt(a: string | null) {
  if (!a) return "—";
  return `$${parseFloat(a).toFixed(2)}`;
}

function MethodBadge({ method, handle }: { method: string; handle: string | null }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="px-2 py-0.5 rounded-full text-xs font-bold text-white"
        style={{ background: METHOD_COLORS[method] ?? "#888" }}>
        {METHOD_LABELS[method] ?? method}
      </span>
      {handle && <span className="text-sm font-mono">{handle}</span>}
    </div>
  );
}

function StatusBadge({ gift }: { gift: GiftRow }) {
  if (gift.redeemedAt && gift.cashoutPaidAt)
    return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 whitespace-nowrap">Paid out</span>;
  if (gift.redeemedAt)
    return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 whitespace-nowrap">Needs payout</span>;
  if (gift.openedAt)
    return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 whitespace-nowrap">Opened</span>;
  if (gift.paid)
    return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 whitespace-nowrap">Paid · Unsent</span>;
  return   <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground whitespace-nowrap">Draft</span>;
}

function StatCard({
  label, value, sub, icon: Icon, color,
}: { label: string; value: string; sub: string; icon: React.ElementType; color: string }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4 sm:p-5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide leading-tight">{label}</p>
        <Icon className={`w-4 h-4 shrink-0 ${color}`} />
      </div>
      <p className={`text-xl sm:text-2xl font-bold ${color} leading-none`}>{value}</p>
      <p className="text-[11px] text-muted-foreground mt-1.5 leading-tight">{sub}</p>
    </div>
  );
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
  const [showPaidHistory, setShowPaidHistory] = useState(false);

  const [giftSearch, setGiftSearch] = useState("");

  const [showWipe, setShowWipe]   = useState(false);
  const [wipeInput, setWipeInput] = useState("");
  const [wiping, setWiping]       = useState(false);
  const [wipeMsg, setWipeMsg]     = useState<string | null>(null);

  const headers = { "x-admin-key": key };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, c, g, u] = await Promise.all([
        fetch(`${API}/api/admin/stats`,    { headers }).then(r => r.json()),
        fetch(`${API}/api/admin/cashouts`, { headers }).then(r => r.json()),
        fetch(`${API}/api/admin/gifts`,    { headers }).then(r => r.json()),
        fetch(`${API}/api/admin/users`,    { headers }).then(r => r.json()),
      ]);
      setStats(s);
      setCashouts(Array.isArray(c) ? c : []);
      setGiftRows(Array.isArray(g) ? g : []);
      setUserRows(Array.isArray(u) ? u : []);
    } finally {
      setLoading(false);
    }
  }, [key]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setChecking(true); setAuthErr("");
    try {
      const r = await fetch(`${API}/api/admin/stats`, { headers: { "x-admin-key": key } });
      if (r.status === 401 || r.status === 503) {
        setAuthErr("Incorrect password."); setChecking(false); return;
      }
      sessionStorage.setItem("admin_key", key);
      setAuthed(true);
    } catch { setAuthErr("Could not connect."); }
    finally { setChecking(false); }
  }

  useEffect(() => { if (authed) load(); }, [authed, load]);

  function copyHandle(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(text); setTimeout(() => setCopied(null), 2000);
    });
  }

  async function markCashoutPaid(id: string) {
    setMarkingPaid(id);
    try {
      const r = await fetch(`${API}/api/admin/gifts/${id}/mark-cashout-paid`, { method: "PATCH", headers });
      if (r.ok) {
        const now = new Date().toISOString();
        setCashouts(prev => prev.map(c => c.id === id ? { ...c, cashoutPaidAt: now } : c));
        setGiftRows(prev => prev.map(g => g.id === id ? { ...g, cashoutPaidAt: now } : g));
        if (stats) setStats({ ...stats, pending: Math.max(0, stats.pending - 1), pendingVolume: 0 });
      }
    } finally { setMarkingPaid(null); }
  }

  async function handleWipe() {
    if (wipeInput !== "WIPE") return;
    setWiping(true); setWipeMsg(null);
    try {
      const r = await fetch(`${API}/api/admin/wipe`, {
        method: "DELETE",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "WIPE" }),
      });
      if (r.ok) {
        setWipeMsg("All gift data wiped successfully.");
        setCashouts([]); setGiftRows([]);
        if (stats) setStats({
          ...stats, total: 0, paid: 0, redeemed: 0, pending: 0,
          volume: 0, pendingVolume: 0, feeRevenue: 0, avgAmount: 0,
          openRate: 0, redeemRate: 0, repeatSenders: 0, topExperience: null,
        });
        setWipeInput("");
        setTimeout(() => { setShowWipe(false); setWipeMsg(null); }, 3000);
      } else {
        setWipeMsg("Wipe failed. Try again.");
      }
    } finally { setWiping(false); }
  }

  // ── Login screen ──────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm">
          <h1 className="font-serif text-3xl font-medium text-center mb-1">gifted.</h1>
          <p className="text-center text-muted-foreground text-sm mb-8">Operator dashboard</p>
          <form onSubmit={handleLogin} className="space-y-3">
            <input
              type="password"
              placeholder="Admin password"
              value={key}
              onChange={e => setKey(e.target.value)}
              className="w-full border border-border rounded-xl px-4 py-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              autoFocus
              autoComplete="new-password"
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

  const filteredGifts = giftSearch.trim()
    ? giftRows.filter(g =>
        g.recipientName.toLowerCase().includes(giftSearch.toLowerCase()) ||
        g.senderName.toLowerCase().includes(giftSearch.toLowerCase()) ||
        (g.senderEmail ?? "").toLowerCase().includes(giftSearch.toLowerCase())
      )
    : giftRows;

  return (
    <div className="min-h-screen bg-background">

      {/* ── Admin header ───────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border px-4 sm:px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="font-serif text-lg font-medium whitespace-nowrap">gifted.</h1>
            <span className="text-muted-foreground text-xs font-medium px-2 py-0.5 bg-muted rounded-full whitespace-nowrap">operator</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={load}
              disabled={loading}
              title="Refresh"
              className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground disabled:opacity-40"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={() => setShowWipe(true)}
              title="Wipe gift data"
              className="p-2 rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => { sessionStorage.removeItem("admin_key"); setAuthed(false); }}
              title="Sign out"
              className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">

        {/* ── Stats ──────────────────────────────────────────────────────── */}
        {stats && (
          <div className="space-y-3">
            {/* Primary row — 4 cards, clean 2×2 on mobile */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Accounts"     value={`${stats.totalUsers}`}             sub={`+${stats.newUsersWeek} this week`}        icon={Users}       color="text-violet-600" />
              <StatCard label="Total gifts"  value={`${stats.total}`}                  sub={`${stats.paid} paid`}                       icon={Gift}        color="text-foreground" />
              <StatCard label="Gross volume" value={`$${stats.volume.toFixed(2)}`}      sub={`avg $${stats.avgAmount.toFixed(0)} / gift`} icon={DollarSign}  color="text-primary"    />
              <StatCard label="Fee revenue"  value={`$${stats.feeRevenue.toFixed(2)}`}  sub="5% of gross"                                icon={TrendingUp}  color="text-green-600"  />
            </div>
            {/* Insights row — 4 cards, same grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Open rate"      value={`${stats.openRate}%`}    sub="of paid gifts opened"       icon={Percent}  color="text-blue-600"   />
              <StatCard label="Redeem rate"    value={`${stats.redeemRate}%`}  sub="of opened gifts redeemed"   icon={Percent}  color="text-green-600"  />
              <StatCard label="Repeat senders" value={`${stats.repeatSenders}`} sub="sent more than once"       icon={Repeat2}  color="text-primary"    />
              <StatCard
                label="Top theme"
                value={stats.topExperience ? (EXP_LABELS[stats.topExperience] ?? stats.topExperience) : "—"}
                sub="most chosen experience"
                icon={Sparkles}
                color="text-violet-600"
              />
            </div>
          </div>
        )}

        {/* ── Pending payout alert ─────────────────────────────────────── */}
        {stats && stats.pendingVolume > 0 && (
          <button
            onClick={() => setTab("cashouts")}
            className="w-full flex items-center justify-between gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 sm:px-5 py-4 text-left hover:bg-amber-100 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-amber-900">
                  {pendingCashouts.length} payout{pendingCashouts.length !== 1 ? "s" : ""} waiting
                </p>
                <p className="text-xs text-amber-700">${stats.pendingVolume.toFixed(2)} to send</p>
              </div>
            </div>
            <span className="text-xs font-semibold text-amber-700 group-hover:text-amber-900 whitespace-nowrap">
              View cashouts →
            </span>
          </button>
        )}

        {/* ── Tab bar ─────────────────────────────────────────────────── */}
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <div className="flex gap-0 border-b border-border min-w-max px-4 sm:px-0 sm:min-w-0">
            {([
              ["cashouts", "Cashouts",  pendingCashouts.length > 0 ? String(pendingCashouts.length) : null, "amber"],
              ["all",      "All Gifts", String(giftRows.length), "muted"],
              ["users",    "Accounts",  String(userRows.length), "violet"],
            ] as const).map(([t, label, badge, badgeColor]) => (
              <button
                key={t}
                onClick={() => setTab(t as typeof tab)}
                className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors whitespace-nowrap flex items-center gap-2 ${
                  tab === t
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
                {badge && (
                  <span className={`px-1.5 py-0.5 text-xs rounded-full font-bold ${
                    badgeColor === "amber"  ? "bg-amber-100 text-amber-800" :
                    badgeColor === "violet" ? "bg-violet-100 text-violet-700" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    {badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── Cashouts tab ─────────────────────────────────────────────── */}
        {tab === "cashouts" && (
          <div className="space-y-4">

            {/* Pending */}
            {pendingCashouts.length === 0 ? (
              <div className="text-center py-16">
                <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-green-400" />
                <p className="text-sm text-muted-foreground font-medium">All caught up — no pending payouts</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingCashouts.map(c => (
                  <div key={c.id} className="bg-card border border-amber-200 rounded-2xl p-4 sm:p-5">
                    {/* Top row: names + amount */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <p className="font-semibold text-base leading-tight">{c.recipientName}</p>
                        <p className="text-muted-foreground text-sm">from {c.senderName}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Redeemed {fmt(c.redeemedAt)}</p>
                      </div>
                      <span className="font-bold text-primary text-xl shrink-0">{fmtAmt(c.amount)}</span>
                    </div>

                    {/* Bottom row: payout info + actions */}
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        {c.payoutMethod ? (
                          <button
                            onClick={() => copyHandle(c.payoutHandle ?? "")}
                            className="flex items-center gap-2 hover:opacity-70 transition-opacity"
                            title="Copy handle"
                          >
                            <MethodBadge method={c.payoutMethod} handle={c.payoutHandle} />
                            {copied === c.payoutHandle
                              ? <Check className="w-3.5 h-3.5 text-green-600" />
                              : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
                          </button>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">No payout method set</span>
                        )}
                        {c.payoutName && <p className="text-xs text-muted-foreground mt-0.5">{c.payoutName}</p>}
                      </div>
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
                          className="gap-1.5 h-9 px-4 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold"
                        >
                          {markingPaid === c.id
                            ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            : <BadgeCheck className="w-3.5 h-3.5" />}
                          Mark paid
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Paid history (collapsible) */}
            {paidCashouts.length > 0 && (
              <div className="space-y-2">
                <button
                  onClick={() => setShowPaidHistory(v => !v)}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors font-medium py-1"
                >
                  {showPaidHistory
                    ? <ChevronUp className="w-4 h-4" />
                    : <ChevronDown className="w-4 h-4" />}
                  {showPaidHistory ? "Hide" : "Show"} {paidCashouts.length} paid cashout{paidCashouts.length !== 1 ? "s" : ""}
                </button>
                {showPaidHistory && (
                  <div className="space-y-2">
                    {paidCashouts.map(c => (
                      <div key={c.id} className="bg-card border border-border rounded-2xl p-4 opacity-60">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div className="flex items-center gap-2 min-w-0">
                            <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                            <div className="min-w-0">
                              <span className="font-medium text-sm">{c.recipientName}</span>
                              <span className="text-muted-foreground text-sm"> · {fmtAmt(c.amount)}</span>
                              <p className="text-xs text-muted-foreground">Paid {fmt(c.cashoutPaidAt)}</p>
                            </div>
                          </div>
                          {c.payoutMethod && (
                            <MethodBadge method={c.payoutMethod} handle={c.payoutHandle} />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── All Gifts tab ─────────────────────────────────────────────── */}
        {tab === "all" && (
          <div className="space-y-4">
            {/* Search */}
            <div className="relative max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                placeholder="Search name or email…"
                value={giftSearch}
                onChange={e => setGiftSearch(e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              {giftSearch && (
                <button
                  onClick={() => setGiftSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {giftSearch && (
              <p className="text-xs text-muted-foreground">
                {filteredGifts.length} of {giftRows.length} gifts
              </p>
            )}

            {/* Table */}
            <div className="overflow-x-auto rounded-2xl border border-border -mx-4 sm:mx-0">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    {["Recipient", "Sender", "Amount", "Status", "React", "Theme", "Date", ""].map(h => (
                      <th key={h} className="px-3 sm:px-4 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap first:pl-4 sm:first:pl-4">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredGifts.map((g, i) => (
                    <tr key={g.id}
                      className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${i % 2 !== 0 ? "bg-muted/10" : ""}`}>
                      <td className="px-3 sm:px-4 py-3 font-medium whitespace-nowrap">{g.recipientName}</td>
                      <td className="px-3 sm:px-4 py-3 text-muted-foreground whitespace-nowrap">{g.senderName}</td>
                      <td className="px-3 sm:px-4 py-3 font-semibold text-primary whitespace-nowrap">{fmtAmt(g.amount)}</td>
                      <td className="px-3 sm:px-4 py-3"><StatusBadge gift={g} /></td>
                      <td className="px-3 sm:px-4 py-3 text-base">{g.reaction ?? ""}</td>
                      <td className="px-3 sm:px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{EXP_LABELS[g.experience] ?? g.experience}</td>
                      <td className="px-3 sm:px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{fmtDate(g.createdAt)}</td>
                      <td className="px-3 sm:px-4 py-3">
                        <a href={`/open/${g.id}`} target="_blank" rel="noreferrer"
                          className="text-muted-foreground hover:text-primary transition-colors p-1 block">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </td>
                    </tr>
                  ))}
                  {filteredGifts.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground text-sm">
                        {giftSearch ? "No gifts match that search" : "No gifts yet"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Accounts tab ──────────────────────────────────────────────── */}
        {tab === "users" && (
          <div className="overflow-x-auto rounded-2xl border border-border -mx-4 sm:mx-0">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  {["Name", "Email", "Payout", "Joined", "Sent", "Rcvd"].map(h => (
                    <th key={h} className="px-3 sm:px-4 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {userRows.map((u, i) => {
                  const name = [u.firstName, u.lastName].filter(Boolean).join(" ") || u.displayName || "—";
                  return (
                    <tr key={u.id}
                      className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${i % 2 !== 0 ? "bg-muted/10" : ""}`}>
                      <td className="px-3 sm:px-4 py-3 font-medium whitespace-nowrap">{name}</td>
                      <td className="px-3 sm:px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{u.email ?? "—"}</td>
                      <td className="px-3 sm:px-4 py-3 whitespace-nowrap">
                        {u.payoutMethod
                          ? <MethodBadge method={u.payoutMethod} handle={u.payoutHandle} />
                          : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                      <td className="px-3 sm:px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{fmtDate(u.createdAt)}</td>
                      <td className="px-3 sm:px-4 py-3 text-center">
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                          u.giftsSent > 0 ? "bg-primary/10 text-primary" : "text-muted-foreground"
                        }`}>{u.giftsSent}</span>
                      </td>
                      <td className="px-3 sm:px-4 py-3 text-center">
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                          u.giftsReceived > 0 ? "bg-green-100 text-green-700" : "text-muted-foreground"
                        }`}>{u.giftsReceived}</span>
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

      {/* ── Wipe modal ───────────────────────────────────────────────────── */}
      {showWipe && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-0 sm:px-4">
          <div className="bg-card border border-border rounded-t-3xl sm:rounded-2xl p-6 w-full sm:max-w-md shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <h2 className="font-semibold text-base">Wipe all gift data</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Permanently deletes all gifts, cashouts, and messages.{" "}
                  <span className="font-medium text-foreground">User accounts are kept.</span>
                </p>
              </div>
            </div>

            <div className="bg-destructive/5 border border-destructive/20 rounded-xl px-4 py-3">
              <p className="text-xs text-destructive font-medium">
                This cannot be undone. Type <span className="font-mono font-bold tracking-wider">WIPE</span> to confirm.
              </p>
            </div>

            <input
              type="text"
              placeholder="Type WIPE to confirm"
              value={wipeInput}
              onChange={e => setWipeInput(e.target.value)}
              className="w-full border border-border rounded-xl px-4 py-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-destructive/30 font-mono tracking-wider"
              autoFocus
            />

            {wipeMsg && (
              <p className={`text-sm font-medium ${wipeMsg.includes("success") ? "text-green-600" : "text-destructive"}`}>
                {wipeMsg}
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <Button
                variant="outline"
                className="flex-1 h-11 rounded-xl"
                onClick={() => { setShowWipe(false); setWipeInput(""); setWipeMsg(null); }}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 h-11 rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold"
                disabled={wipeInput !== "WIPE" || wiping}
                onClick={handleWipe}
              >
                {wiping ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Wipe all gifts"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
