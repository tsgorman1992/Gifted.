import React from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Gift, ExternalLink, CheckCircle2, Clock, Plus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface GiftSummary {
  id: string;
  recipientName: string;
  senderName: string;
  giftTitle: string;
  occasion: string;
  amount: string | null;
  paid: boolean;
  redeemedAt: string | null;
  createdAt: string;
}

const BASE = import.meta.env.BASE_URL.replace(/\/+$/, "");

async function fetchMyGifts(): Promise<GiftSummary[]> {
  const res = await fetch(`${BASE}/api/gifted/my-gifts`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load gifts");
  return res.json();
}

export default function MyGiftsPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  const { data: myGifts, isLoading: giftsLoading } = useQuery({
    queryKey: ["my-gifts"],
    queryFn: fetchMyGifts,
    enabled: isAuthenticated,
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 pb-24 text-center gap-6">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
          <Gift className="w-10 h-10 text-primary" />
        </div>
        <h1 className="font-serif text-4xl font-medium">Your sent gifts</h1>
        <p className="text-muted-foreground max-w-sm">
          Sign in to see all the gifts you've sent and track when they've been opened and redeemed.
        </p>
        <Button size="lg" className="rounded-full px-10 h-13" onClick={() => setLocation("/sign-in")}>
          Sign in to continue
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full pb-24">
      <div className="max-w-3xl mx-auto px-6 pt-16 md:pt-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center justify-between mb-12"
        >
          <div>
            <h1 className="font-serif text-4xl md:text-5xl font-medium mb-2">My Gifts</h1>
            <p className="text-muted-foreground">Gifts you've sent with gifted.</p>
          </div>
          <Link href="/create">
            <Button className="rounded-full px-6 shadow-md gap-2 hidden sm:flex">
              <Plus className="w-4 h-4" />
              New gift
            </Button>
          </Link>
        </motion.div>

        {giftsLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 rounded-3xl bg-muted/40 animate-pulse" />
            ))}
          </div>
        ) : !myGifts || myGifts.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-24 bg-card border border-border rounded-3xl"
          >
            <Gift className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
            <h2 className="font-serif text-2xl font-medium mb-2">No gifts yet</h2>
            <p className="text-muted-foreground mb-8 max-w-xs mx-auto">
              Create your first gift and make someone's day unforgettable.
            </p>
            <Link href="/create">
              <Button className="rounded-full px-8 h-12">Send a gift</Button>
            </Link>
          </motion.div>
        ) : (
          <div className="space-y-4">
            {myGifts.map((gift, i) => {
              const shareUrl  = `${window.location.origin}${BASE}/api/share/${gift.id}`;
              const isRedeemed = !!gift.redeemedAt;
              return (
                <motion.div
                  key={gift.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="bg-card border border-border rounded-3xl p-6 flex items-start justify-between gap-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                      isRedeemed ? "bg-green-100" : "bg-primary/10"
                    }`}>
                      {isRedeemed
                        ? <CheckCircle2 className="w-5 h-5 text-green-600" />
                        : <Clock className="w-5 h-5 text-primary" />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{gift.giftTitle || `Gift for ${gift.recipientName}`}</p>
                      <p className="text-sm text-muted-foreground">
                        To {gift.recipientName} · {gift.occasion}
                        {gift.amount && ` · $${parseFloat(gift.amount).toFixed(2)}`}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {isRedeemed
                          ? `Redeemed ${formatDistanceToNow(new Date(gift.redeemedAt!), { addSuffix: true })}`
                          : `Sent ${formatDistanceToNow(new Date(gift.createdAt), { addSuffix: true })}`}
                      </p>
                    </div>
                  </div>
                  <a href={shareUrl} target="_blank" rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground transition-colors shrink-0 mt-0.5" title="Open gift link">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </motion.div>
              );
            })}
          </div>
        )}

        <div className="mt-10 sm:hidden">
          <Link href="/create">
            <Button className="w-full rounded-full h-13 gap-2">
              <Plus className="w-4 h-4" />
              Send a new gift
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
