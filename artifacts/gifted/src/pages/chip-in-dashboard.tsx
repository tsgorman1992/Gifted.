import { useState, useEffect, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Copy, Check, Send, X, UserPlus, ChevronDown, ChevronUp, Trash2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/+$/, "");

interface Contribution {
  id: string;
  contributorName: string;
  contributorEmail: string;
  amountCents: number;
  status: string;
  message: string | null;
  paidAt: string | null;
  invitedAt: string | null;
  createdAt: string;
}

interface Campaign {
  id: string;
  shareToken: string;
  recipientName: string;
  occasion: string;
  status: string;
  fixedAmountCents: number;
  maxContributors: number;
  sentGiftId: string | null;
}

interface DashboardData {
  campaign: Campaign;
  contributions: Contribution[];
  paidCount: number;
  paidTotalCents: number;
}

function formatOccasion(o: string): string {
  return o.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function ChipInDashboardPage() {
  const { id } = useParams<{ id: string }>();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();

  const [status, setStatus] = useState<"loading" | "ready" | "forbidden" | "not-found" | "error">("loading");
  const [data, setData] = useState<DashboardData | null>(null);
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showFailed, setShowFailed] = useState(false);

  const [refundConfirmId, setRefundConfirmId] = useState<string | null>(null);
  const [refundingId, setRefundingId] = useState<string | null>(null);

  const [cancellingInviteId, setCancellingInviteId] = useState<string | null>(null);

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePhone, setInvitePhone] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!id) return;
    fetch(`${BASE}/api/gifted/group-gifts/${id}`, { credentials: "include" })
      .then(async r => {
        if (r.status === 403) { setStatus("forbidden"); return; }
        if (r.status === 404) { setStatus("not-found"); return; }
        if (!r.ok) { setStatus("error"); return; }
        setData(await r.json());
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, [id]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) { setLocation(`/sign-in?returnTo=${encodeURIComponent(window.location.pathname)}`); return; }
    load();
  }, [authLoading, isAuthenticated, load, setLocation]);

  function shareUrl(shareToken: string) {
    return `${window.location.origin}${BASE}/chip-in/${shareToken}`;
  }

  async function handleCopy() {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(shareUrl(data.campaign.shareToken));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch { /* clipboard unavailable */ }
  }

  async function handleSend() {
    if (!id) return;
    setActionError(null);
    setSending(true);
    try {
      const res = await fetch(`${BASE}/api/gifted/group-gifts/${id}/send`, {
        method: "POST",
        credentials: "include",
      });
      const result = await res.json();
      if (!res.ok) { setActionError(result.error || "Failed to send."); return; }
      setLocation(`/open/${result.giftId}?preview=true`);
    } catch {
      setActionError("Unable to connect. Please try again.");
    } finally {
      setSending(false);
    }
  }

  async function handleCancel() {
    if (!id) return;
    setActionError(null);
    setCancelling(true);
    try {
      const res = await fetch(`${BASE}/api/gifted/group-gifts/${id}/cancel`, {
        method: "POST",
        credentials: "include",
      });
      const result = await res.json();
      if (!res.ok) { setActionError(result.error || "Failed to cancel."); return; }
      setShowCancelConfirm(false);
      load();
    } catch {
      setActionError("Unable to connect. Please try again.");
    } finally {
      setCancelling(false);
    }
  }

  async function handleRefund(contributionId: string) {
    if (!id) return;
    setRefundingId(contributionId);
    setActionError(null);
    try {
      const res = await fetch(`${BASE}/api/gifted/group-gifts/${id}/contributors/${contributionId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const result = await res.json();
      if (!res.ok) { setActionError(result.error || "Failed to refund."); return; }
      setRefundConfirmId(null);
      load();
    } catch {
      setActionError("Unable to connect. Please try again.");
    } finally {
      setRefundingId(null);
    }
  }

  async function handleCancelInvite(contributionId: string) {
    if (!id) return;
    setCancellingInviteId(contributionId);
    setActionError(null);
    try {
      const res = await fetch(`${BASE}/api/gifted/group-gifts/${id}/invites/${contributionId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const result = await res.json();
      if (!res.ok) { setActionError(result.error || "Failed to cancel invite."); return; }
      load();
    } catch {
      setActionError("Unable to connect. Please try again.");
    } finally {
      setCancellingInviteId(null);
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    setInviteError(null);
    setInviting(true);
    try {
      const res = await fetch(`${BASE}/api/gifted/group-gifts/${id}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: inviteName.trim(), email: inviteEmail.trim(), phone: invitePhone.trim() || undefined }),
      });
      const result = await res.json();
      if (!res.ok) { setInviteError(result.error || "Failed to send invite."); return; }
      setInviteSuccess(`Invite sent to ${inviteEmail.trim()}.`);
      setInviteName("");
      setInviteEmail("");
      setInvitePhone("");
      load();
      setTimeout(() => {
        setInviteSuccess(null);
        setShowInviteModal(false);
      }, 2500);
    } catch {
      setInviteError("Unable to connect. Please try again.");
    } finally {
      setInviting(false);
    }
  }

  if (authLoading || status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (status === "forbidden") {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 text-center">
        <p className="text-muted-foreground text-sm">Only the organizer can view this dashboard.</p>
      </div>
    );
  }

  if (status === "not-found" || status === "error" || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 text-center">
        <p className="text-muted-foreground text-sm">
          {status === "not-found" ? "This campaign couldn't be found." : "Something went wrong. Please try again."}
        </p>
      </div>
    );
  }

  const { campaign, contributions, paidCount, paidTotalCents } = data;
  const amountStr = `$${(campaign.fixedAmountCents / 100).toFixed(2)}`;
  const raisedStr = `$${(paidTotalCents / 100).toFixed(2)}`;
  const isOpen = campaign.status === "open";
  const isSent = campaign.status === "sent";
  const isCancelled = campaign.status === "canceled" || campaign.status === "refunding" || campaign.status === "refunded";

  const paid       = contributions.filter(c => c.status === "paid");
  const inProgress = contributions.filter(c => c.status === "pending" || c.status === "invited");
  const failed     = contributions.filter(c => c.status === "failed");

  const activeSlots = paid.length + inProgress.length;
  const canInvite = isOpen && activeSlots < campaign.maxContributors;

  return (
    <div className="min-h-screen w-full px-6 py-16">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="w-full max-w-lg mx-auto">
        <div className="mb-8">
          <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-3">Chip In Dashboard</p>
          <h1 className="font-serif text-3xl font-medium mb-2">{campaign.recipientName}'s {formatOccasion(campaign.occasion)}</h1>
          <p className="text-muted-foreground text-sm">
            {isSent ? "Sent" : isCancelled ? "Cancelled" : "Collecting contributions"}
          </p>
        </div>

        <div className="bg-card border border-border rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-semibold">{raisedStr}</p>
              <p className="text-xs text-muted-foreground">{paidCount} of {campaign.maxContributors} chipped in &middot; {amountStr} each</p>
            </div>
            {isOpen && canInvite && (
              <Button type="button" size="sm" variant="outline" className="rounded-full gap-1.5" onClick={() => setShowInviteModal(true)}>
                <UserPlus className="w-3.5 h-3.5" />
                Invite someone
              </Button>
            )}
          </div>

          {isOpen && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 bg-secondary/50 rounded-xl px-4 py-3">
                <span className="flex-1 text-xs text-muted-foreground truncate">{shareUrl(campaign.shareToken)}</span>
                <Button type="button" size="sm" variant="outline" className="rounded-full shrink-0" onClick={handleCopy}>
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "Copied" : "Copy link"}
                </Button>
              </div>
              {activeSlots < campaign.maxContributors && (
                <a
                  href={shareUrl(campaign.shareToken)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full h-9 rounded-xl border border-primary/25 bg-primary/6 text-primary text-sm font-medium hover:bg-primary/12 transition-colors"
                >
                  Chip in yourself
                </a>
              )}
            </div>
          )}

          {/* Chipped In (paid) */}
          <div className="border-t border-border pt-5">
            <p className="text-xs font-medium text-muted-foreground mb-3">Chipped In ({paid.length})</p>
            {paid.length === 0 ? (
              <p className="text-sm text-muted-foreground">No confirmed contributions yet.</p>
            ) : (
              <div className="space-y-3">
                {paid.map(c => (
                  <div key={c.id} className="space-y-1">
                    <div className="flex items-start justify-between text-sm">
                      <div>
                        <p className="font-medium">{c.contributorName}</p>
                        {c.message && <p className="text-xs text-muted-foreground mt-0.5">"{c.message}"</p>}
                      </div>
                      <div className="flex items-center gap-2 ml-3 shrink-0">
                        <span className="font-medium">${(c.amountCents / 100).toFixed(2)}</span>
                        {isOpen && refundConfirmId !== c.id && (
                          <button
                            type="button"
                            onClick={() => setRefundConfirmId(c.id)}
                            className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                            title="Refund this contributor"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    {isOpen && refundConfirmId === c.id && (
                      <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-3 space-y-2 text-xs">
                        <p>Refund {c.contributorName} ({amountStr}) in full? This frees their spot.</p>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => setRefundConfirmId(null)} className="flex-1 py-1.5 rounded-lg border border-border text-center hover:bg-secondary/50 transition-colors">
                            Never mind
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRefund(c.id)}
                            disabled={refundingId === c.id}
                            className="flex-1 py-1.5 rounded-lg bg-destructive text-destructive-foreground text-center hover:bg-destructive/90 transition-colors disabled:opacity-50"
                          >
                            {refundingId === c.id ? <Loader2 className="w-3 h-3 animate-spin inline" /> : "Refund"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* In Progress (pending + invited) */}
          {inProgress.length > 0 && (
            <div className="border-t border-border pt-5">
              <p className="text-xs font-medium text-muted-foreground mb-3">In Progress ({inProgress.length})</p>
              <div className="space-y-2.5">
                {inProgress.map(c => (
                  <div key={c.id} className="flex items-center justify-between text-sm text-muted-foreground">
                    <div>
                      <p className="text-sm font-medium text-foreground/70">{c.contributorName}</p>
                      <p className="text-xs">
                        {c.status === "invited"
                          ? `Invited ${c.invitedAt ? timeAgo(c.invitedAt) : ""} — waiting to chip in`
                          : `Started checkout ${timeAgo(c.createdAt)}`}
                      </p>
                      {c.contributorEmail && (
                        <p className="text-xs text-muted-foreground/70">{c.contributorEmail}</p>
                      )}
                    </div>
                    {c.status === "invited" && isOpen && (
                      <button
                        type="button"
                        onClick={() => handleCancelInvite(c.id)}
                        disabled={cancellingInviteId === c.id}
                        className="text-xs text-muted-foreground hover:text-destructive transition-colors ml-3 shrink-0"
                        title="Cancel this invite"
                      >
                        {cancellingInviteId === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Failed (collapsed by default) */}
          {failed.length > 0 && (
            <div className="border-t border-border pt-5">
              <button
                type="button"
                onClick={() => setShowFailed(v => !v)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {showFailed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                {failed.length} declined / abandoned
              </button>
              {showFailed && (
                <div className="mt-2.5 space-y-1.5">
                  {failed.map(c => (
                    <div key={c.id} className="text-xs text-muted-foreground/60">
                      {c.contributorName} &middot; {timeAgo(c.createdAt)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {actionError && <p className="text-sm text-destructive">{actionError}</p>}

          {isOpen && (
            <div className="border-t border-border pt-5 space-y-3">
              <Button type="button" size="lg" className="w-full rounded-full" onClick={handleSend} disabled={sending || paidCount === 0}>
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Send {raisedStr} to {campaign.recipientName}
              </Button>
              {paidCount === 0 && <p className="text-xs text-center text-muted-foreground">Waiting on at least one confirmed contribution before you can send.</p>}

              {!showCancelConfirm ? (
                <button type="button" onClick={() => setShowCancelConfirm(true)} className="w-full text-center text-xs text-muted-foreground hover:text-destructive transition-colors">
                  Cancel this campaign
                </button>
              ) : (
                <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 space-y-3">
                  <p className="text-xs text-center">
                    This refunds every confirmed contributor in full, including fees. This can't be undone.
                  </p>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" className="flex-1 rounded-full" onClick={() => setShowCancelConfirm(false)}>
                      Never mind
                    </Button>
                    <Button type="button" variant="destructive" size="sm" className="flex-1 rounded-full" onClick={handleCancel} disabled={cancelling}>
                      {cancelling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                      Cancel &amp; refund
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {isSent && campaign.sentGiftId && (
            <div className="border-t border-border pt-5">
              <Button asChild size="lg" className="w-full rounded-full">
                <a href={`${BASE}/open/${campaign.sentGiftId}?preview=true`}>View the sent moment</a>
              </Button>
            </div>
          )}
        </div>
      </motion.div>

      {/* Invite modal */}
      <AnimatePresence>
        {showInviteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={e => { if (e.target === e.currentTarget) setShowInviteModal(false); }}
          >
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              className="w-full max-w-md bg-card border border-border rounded-3xl p-6 shadow-xl"
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-serif text-xl font-medium">Invite someone</h2>
                <button type="button" onClick={() => { setShowInviteModal(false); setInviteError(null); setInviteSuccess(null); }} className="text-muted-foreground hover:text-foreground transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {inviteSuccess ? (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <MailCheck className="w-6 h-6 text-primary" />
                  </div>
                  <p className="text-sm font-medium">{inviteSuccess}</p>
                  <p className="text-xs text-muted-foreground">They'll get an email with their personal chip-in link.</p>
                </div>
              ) : (
                <form onSubmit={handleInvite} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Name</label>
                    <input
                      type="text" value={inviteName} onChange={e => setInviteName(e.target.value)}
                      placeholder="Alex Kim" maxLength={80} required
                      className="w-full h-11 px-4 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Email</label>
                    <input
                      type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                      placeholder="alex@example.com" required
                      className="w-full h-11 px-4 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Phone (optional — for SMS too)</label>
                    <input
                      type="tel" value={invitePhone} onChange={e => setInvitePhone(e.target.value)}
                      placeholder="+1 555 000 0000"
                      className="w-full h-11 px-4 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
                    />
                  </div>
                  {inviteError && <p className="text-sm text-destructive">{inviteError}</p>}
                  <Button type="submit" size="lg" className="w-full rounded-full" disabled={inviting}>
                    {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send invite"}
                  </Button>
                  <p className="text-xs text-center text-muted-foreground">They'll get a personal link only they can use — it reserves their spot.</p>
                </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
