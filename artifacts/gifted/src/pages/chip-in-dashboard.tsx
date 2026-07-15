import { useState, useEffect, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Loader2, Copy, Check, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/+$/, "");

interface Contribution {
  id: string;
  contributorName: string;
  amountCents: number;
  status: string;
  message: string | null;
  paidAt: string | null;
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
    } catch { /* clipboard unavailable — silently ignore */ }
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
          </div>

          {isOpen && (
            <div className="flex items-center gap-2 bg-secondary/50 rounded-xl px-4 py-3">
              <span className="flex-1 text-xs text-muted-foreground truncate">{shareUrl(campaign.shareToken)}</span>
              <Button type="button" size="sm" variant="outline" className="rounded-full shrink-0" onClick={handleCopy}>
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied" : "Copy link"}
              </Button>
            </div>
          )}

          <div className="border-t border-border pt-5">
            <p className="text-xs font-medium text-muted-foreground mb-3">Contributors</p>
            {contributions.filter(c => c.status === "paid").length === 0 ? (
              <p className="text-sm text-muted-foreground">No confirmed contributions yet.</p>
            ) : (
              <div className="space-y-3">
                {contributions.filter(c => c.status === "paid").map(c => (
                  <div key={c.id} className="flex items-start justify-between text-sm">
                    <div>
                      <p className="font-medium">{c.contributorName}</p>
                      {c.message && <p className="text-xs text-muted-foreground mt-0.5">"{c.message}"</p>}
                    </div>
                    <span className="font-medium shrink-0 ml-3">${(c.amountCents / 100).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

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
                      Cancel & refund
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
    </div>
  );
}
