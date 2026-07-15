import React, { useState, useEffect } from "react";
import { useParams } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Check, Users, Video, Image as ImageIcon, FileText, Music } from "lucide-react";
import { Button } from "@/components/ui/button";

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/+$/, "");

interface CampaignPublicData {
  recipientName: string;
  occasion: string;
  giftTitle: string;
  experience: string;
  organizerName: string;
  pitchMessage: string;
  contentManifest: {
    hasVideo: boolean;
    photoCount: number;
    hasNote: boolean;
    hasPlaylist: boolean;
    extraLinkCount: number;
  };
  fixedAmountCents: number;
  maxContributors: number;
  paidCount: number;
  paidTotalCents: number;
  status: string;
  full: boolean;
}

function formatOccasion(o: string): string {
  return o.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

export default function ChipInPage() {
  const { shareToken } = useParams<{ shareToken: string }>();

  const [status, setStatus] = useState<"loading" | "ready" | "not-found" | "error">("loading");
  const [campaign, setCampaign] = useState<CampaignPublicData | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [notifyOnOpen, setNotifyOnOpen] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Post-payment confirmation state — set when we land back here from Stripe
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [statusUrl, setStatusUrl] = useState<string | null>(null);

  function fetchCampaign() {
    fetch(`${BASE}/api/gifted/group-gifts/public/${shareToken}`)
      .then(async r => {
        if (r.status === 404) { setStatus("not-found"); return; }
        if (!r.ok) { setStatus("error"); return; }
        const data = await r.json();
        setCampaign(data);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }

  useEffect(() => {
    if (!shareToken) return;
    fetchCampaign();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareToken]);

  // Handle the redirect back from Stripe Checkout.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paid = params.get("paid");
    const contributionId = params.get("contribution_id");
    const sessionId = params.get("session_id");
    if (paid !== "true" || !contributionId || !sessionId) return;

    setConfirming(true);
    fetch(`${BASE}/api/gifted/group-gifts/contributions/${contributionId}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ sessionId }),
    })
      .then(async r => {
        if (!r.ok) throw new Error("confirm failed");
        // The status token was stashed in localStorage right before we
        // redirected to Stripe — retrieve it so we can link to the
        // no-account status page.
        const token = localStorage.getItem(`gifted_chipin_status_${contributionId}`);
        if (token) setStatusUrl(`${BASE}/chip-in/status/${token}`);
        setConfirmed(true);
        fetchCampaign();
      })
      .catch(() => setFormError("We couldn't confirm your payment — if you were charged, contact help@gifted.page and we'll sort it out."))
      .finally(() => setConfirming(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) { setFormError("Your name is required."); return; }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setFormError("A valid email is required.");
      return;
    }

    setSubmitting(true);
    try {
      const returnUrl = window.location.origin + window.location.pathname;
      const res = await fetch(`${BASE}/api/gifted/group-gifts/public/${shareToken}/contribute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          contributorName: name.trim(),
          contributorEmail: email.trim(),
          message: message.trim() || undefined,
          notifyOnOpen,
          returnUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "Something went wrong. Please try again.");
        setSubmitting(false);
        return;
      }
      // Stash the status token before leaving for Stripe so we can show it
      // again once the user is redirected back here.
      localStorage.setItem(`gifted_chipin_status_${data.contributionId}`, data.statusToken);
      window.location.href = data.url;
    } catch {
      setFormError("Unable to connect. Please check your connection and try again.");
      setSubmitting(false);
    }
  }

  if (status === "loading" || confirming) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (status === "not-found") {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 text-center">
        <div>
          <h1 className="font-serif text-2xl font-medium mb-2">We couldn't find this campaign</h1>
          <p className="text-muted-foreground text-sm">The link may be incomplete, or the campaign may have been removed.</p>
        </div>
      </div>
    );
  }

  if (status === "error" || !campaign) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 text-center">
        <p className="text-muted-foreground text-sm">Something went wrong loading this campaign. Please try again.</p>
      </div>
    );
  }

  if (confirmed) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center px-6 pb-24">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md text-center">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-5">
            <Check className="w-7 h-7 text-primary" />
          </div>
          <h1 className="font-serif text-3xl font-medium mb-3">You're in!</h1>
          <p className="text-muted-foreground text-base leading-relaxed mb-8">
            Your contribution toward {campaign.recipientName}'s moment is confirmed. The organizer will send it once everyone's chipped in.
          </p>
          {statusUrl && (
            <Button asChild size="lg" className="rounded-full">
              <a href={statusUrl}>Check the campaign status</a>
            </Button>
          )}
        </motion.div>
      </div>
    );
  }

  const amountStr = `$${(campaign.fixedAmountCents / 100).toFixed(2)}`;
  const raisedStr = `$${(campaign.paidTotalCents / 100).toFixed(2)}`;
  const canContribute = campaign.status === "open" && !campaign.full;

  return (
    <div className="min-h-screen w-full flex items-center justify-center px-6 py-16">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="w-full max-w-md">
        <div className="text-center mb-8">
          <p className="text-xs font-semibold tracking-widest uppercase text-primary mb-3">Chip In</p>
          <h1 className="font-serif text-3xl md:text-4xl font-medium mb-3 leading-tight">
            A moment for {campaign.recipientName}
          </h1>
          <p className="text-muted-foreground text-sm">
            Organized by {campaign.organizerName} &middot; {formatOccasion(campaign.occasion)}
          </p>
        </div>

        <div className="bg-card border border-border rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
          {/* Organizer's pitch — never the recipient's private note */}
          <div className="bg-secondary/50 rounded-2xl p-5">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{campaign.pitchMessage}</p>
          </div>

          {/* Content manifest — what's inside, not the content itself */}
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            {campaign.contentManifest.hasVideo && (
              <span className="inline-flex items-center gap-1.5"><Video className="w-3.5 h-3.5" /> Video message</span>
            )}
            {campaign.contentManifest.photoCount > 0 && (
              <span className="inline-flex items-center gap-1.5"><ImageIcon className="w-3.5 h-3.5" /> {campaign.contentManifest.photoCount} photo{campaign.contentManifest.photoCount !== 1 ? "s" : ""}</span>
            )}
            {campaign.contentManifest.hasNote && (
              <span className="inline-flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> Personal note</span>
            )}
            {campaign.contentManifest.hasPlaylist && (
              <span className="inline-flex items-center gap-1.5"><Music className="w-3.5 h-3.5" /> Song</span>
            )}
          </div>

          {/* Progress */}
          <div className="flex items-center justify-between text-sm border-t border-border pt-5">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Users className="w-4 h-4" />
              <span>{campaign.paidCount} of {campaign.maxContributors} chipped in</span>
            </div>
            <span className="font-semibold">{raisedStr} raised</span>
          </div>

          {!canContribute && (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground">
                {campaign.status === "sent"
                  ? "This moment has already been sent."
                  : campaign.full
                  ? "This moment is fully funded — thank you!"
                  : "This campaign is no longer accepting contributions."}
              </p>
            </div>
          )}

          {canContribute && (
            <form onSubmit={handleSubmit} className="space-y-4 border-t border-border pt-5">
              <div className="flex items-center justify-between bg-secondary/40 rounded-xl px-4 py-3">
                <span className="text-sm text-muted-foreground">Your contribution</span>
                <span className="text-lg font-semibold">{amountStr}</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Your name</label>
                <input
                  type="text" value={name} onChange={e => setName(e.target.value)}
                  placeholder="Jordan Lee" maxLength={80}
                  className="w-full h-11 px-4 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
                />
                <p className="text-xs text-muted-foreground mt-1">So {campaign.recipientName} knows exactly who this is from.</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Your email</label>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full h-11 px-4 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
                />
                <p className="text-xs text-muted-foreground mt-1">For your receipt and a link to check status — no account needed.</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Message (optional)</label>
                <textarea
                  value={message} onChange={e => setMessage(e.target.value)}
                  placeholder="Add a note for the recipient..." maxLength={500} rows={2}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition resize-none"
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                <input type="checkbox" checked={notifyOnOpen} onChange={e => setNotifyOnOpen(e.target.checked)} className="rounded border-border" />
                Notify me when {campaign.recipientName} opens it
              </label>

              <AnimatePresence>
                {formError && (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-sm text-destructive">
                    {formError}
                  </motion.p>
                )}
              </AnimatePresence>

              <Button type="submit" size="lg" className="w-full rounded-full" disabled={submitting}>
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : `Chip in ${amountStr}`}
              </Button>
              <p className="text-xs text-center text-muted-foreground">Plus an 8% platform fee and card processing, shown at checkout — same as every gifted. moment.</p>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}
