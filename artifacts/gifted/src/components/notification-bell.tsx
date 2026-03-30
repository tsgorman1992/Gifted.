import React, { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Bell, Gift, PartyPopper, Smile } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const BASE = import.meta.env.BASE_URL.replace(/\/+$/, "");
const SEEN_KEY = "gifted_notif_seen_at";

type NotifItem = {
  type: "opened" | "redeemed" | "reaction";
  giftId: string;
  recipientName: string;
  giftTitle: string;
  amount: string | null;
  reaction?: string | null;
  at: string;
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function notifText(n: NotifItem): string {
  const first = n.recipientName.split(" ")[0];
  if (n.type === "opened") return `${first} opened your gift`;
  if (n.type === "redeemed") {
    const amt = n.amount ? ` $${n.amount}` : "";
    return `${first} redeemed their${amt} gift`;
  }
  if (n.type === "reaction") {
    return `${first} reacted ${n.reaction ?? "✨"} to your gift`;
  }
  return "";
}

function NotifIcon({ type }: { type: NotifItem["type"] }) {
  if (type === "opened") return <Gift className="w-3.5 h-3.5 text-primary" />;
  if (type === "redeemed") return <PartyPopper className="w-3.5 h-3.5 text-green-600" />;
  return <Smile className="w-3.5 h-3.5 text-amber-500" />;
}

export function NotificationBell() {
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const [seenAt, setSeenAt] = useState<number>(() => {
    const v = localStorage.getItem(SEEN_KEY);
    return v ? parseInt(v, 10) : 0;
  });

  const { data: notifications = [] } = useQuery<NotifItem[]>({
    queryKey: ["notifications"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/gifted/notifications`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 30_000,
    staleTime: 25_000,
  });

  const unreadCount = notifications.filter(
    (n) => new Date(n.at).getTime() > seenAt
  ).length;

  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (next && unreadCount > 0) {
      const now = Date.now();
      localStorage.setItem(SEEN_KEY, String(now));
      setSeenAt(now);
    }
  }, [unreadCount]);

  function handleItemClick(giftId: string) {
    setOpen(false);
    setLocation(`/my-gifts`);
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          aria-label="Notifications"
          className="relative flex items-center justify-center w-8 h-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center leading-none">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-80 p-0 rounded-2xl shadow-xl border border-border overflow-hidden"
      >
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground">Notifications</span>
          {notifications.length > 0 && (
            <span className="text-xs text-muted-foreground">{notifications.length} total</span>
          )}
        </div>

        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 px-4 text-center">
            <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
              <Bell className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">No activity yet</p>
            <p className="text-xs text-muted-foreground/60">You'll see updates here when recipients open or redeem your gifts.</p>
          </div>
        ) : (
          <div className="max-h-[360px] overflow-y-auto divide-y divide-border">
            {notifications.map((n, i) => {
              const isUnread = new Date(n.at).getTime() > seenAt;
              return (
                <button
                  key={`${n.giftId}-${n.type}-${i}`}
                  onClick={() => handleItemClick(n.giftId)}
                  className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-secondary/60 transition-colors"
                >
                  <div className={`mt-0.5 w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                    n.type === "opened" ? "bg-primary/10" :
                    n.type === "redeemed" ? "bg-green-50" : "bg-amber-50"
                  }`}>
                    <NotifIcon type={n.type} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-snug ${isUnread ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                      {notifText(n)}
                    </p>
                    <p className="text-xs text-muted-foreground/60 mt-0.5 truncate">{n.giftTitle}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className="text-[10px] text-muted-foreground/50 whitespace-nowrap">{timeAgo(n.at)}</span>
                    {isUnread && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
