import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import { motion } from "framer-motion";
import { Copy, Check, Share2, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/+$/, "");
const SHARE_ORIGIN = "https://gifted.page";

function fade(delay = 0) {
  return {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1], delay },
  };
}

interface GiftSummary {
  id: string;
  recipientName: string;
  senderName: string;
  occasion: string | null;
  amount: string | null;
  paid: boolean;
  scheduleDelivered: boolean;
}

export default function SendPage() {
  const { id } = useParams<{ id: string }>();
  const [gift, setGift] = useState<GiftSummary | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);

  const shareUrl = `${SHARE_ORIGIN}/open/${id}`;

  useEffect(() => {
    setCanShare(
      typeof navigator !== "undefined" &&
        !!navigator.share &&
        /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    );
  }, []);

  useEffect(() => {
    if (!id) return;
    fetch(`${BASE}/api/gifted/gifts/${id}`, { credentials: "include" })
      .then(r => r.json())
      .then(data => {
        if (data?.id) {
          setGift({
            id: data.id,
            recipientName: data.recipientName ?? "your recipient",
            senderName: data.senderName ?? "",
            occasion: data.occasion ?? null,
            amount: data.amount ?? null,
            paid: data.paid ?? false,
            scheduleDelivered: data.scheduleDelivered ?? false,
          });
          setStatus("ready");
        } else {
          setStatus("error");
        }
      })
      .catch(() => setStatus("error"));
  }, [id]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 3500);
    } catch {
      const el = document.createElement("textarea");
      el.value = shareUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 3500);
    }
  }

  async function handleShare() {
    try {
      await navigator.share({
        title: `A gift for ${gift?.recipientName}`,
        url: shareUrl,
      });
    } catch {
      handleCopy();
    }
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (status === "error" || !gift) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-6 text-center">
        <AlertCircle className="w-8 h-8 text-muted-foreground" />
        <p className="text-muted-foreground text-sm">We couldn't find this gift.</p>
        <Link href="/my-gifts" className="text-sm text-primary underline underline-offset-2">
          Go to my gifts →
        </Link>
      </div>
    );
  }

  const recipientName = gift.recipientName;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-5 py-16">
      <div className="w-full max-w-sm space-y-7">

        {/* Header */}
        <motion.div {...fade(0)} className="text-center space-y-2">
          <p className="text-3xl">🎁</p>
          <h1 className="font-serif text-3xl font-medium text-foreground leading-tight">
            {gift.scheduleDelivered
              ? <>The day is here.</>
              : <>Your gift is ready.</>}
          </h1>
          <p className="text-muted-foreground text-base leading-snug">
            {gift.scheduleDelivered
              ? <>Copy the link below and text it to {recipientName} — straight from you.</>
              : <>Send {recipientName} the link below and they'll see a beautiful animated reveal.</>}
          </p>
        </motion.div>

        {/* Main action */}
        <motion.div {...fade(0.1)} className="space-y-3">
          {canShare ? (
            <Button
              onClick={handleShare}
              className="w-full h-14 rounded-2xl text-base font-semibold shadow-lg shadow-primary/20"
            >
              <Share2 className="w-5 h-5 mr-2" />
              Send to {recipientName}
            </Button>
          ) : null}

          <Button
            onClick={handleCopy}
            variant={canShare ? "outline" : "default"}
            className={`w-full rounded-2xl text-base font-semibold ${
              canShare ? "h-12" : "h-14 shadow-lg shadow-primary/20"
            } transition-all`}
          >
            {copied
              ? <><Check className="w-5 h-5 mr-2" /> Copied!</>
              : <><Copy className="w-5 h-5 mr-2" /> Copy link</>}
          </Button>

          {/* Post-copy nudge */}
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={copied ? { opacity: 1, height: "auto" } : { opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <p className="text-center text-sm text-primary font-medium pt-1">
              Now text it to {recipientName} — it lands better from you directly. 💛
            </p>
          </motion.div>
        </motion.div>

        {/* URL preview */}
        <motion.div {...fade(0.18)}>
          <div className="rounded-xl bg-secondary/60 border border-border px-3.5 py-2.5 flex items-center gap-2 min-w-0">
            <span className="text-xs text-muted-foreground truncate flex-1 font-mono select-all">
              {shareUrl}
            </span>
          </div>
        </motion.div>

        {/* Reminder */}
        <motion.div {...fade(0.24)}>
          <div className="rounded-2xl bg-amber-50 border border-amber-200/70 px-4 py-3 space-y-0.5">
            <p className="text-xs text-amber-800 font-semibold">Send this link, not this page</p>
            <p className="text-xs text-amber-700/80 leading-snug">
              Don't forward the notification — {recipientName} needs the gift link above, not your sender view.
            </p>
          </div>
        </motion.div>

        {/* Escape hatch */}
        <motion.div {...fade(0.3)} className="text-center">
          <Link
            href={`/preview?gift_id=${id}`}
            className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
          >
            Make a last-minute edit →
          </Link>
        </motion.div>

      </div>
    </div>
  );
}
