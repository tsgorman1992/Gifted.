import React, { useState, useEffect } from "react";
import { useParams } from "wouter";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle } from "lucide-react";

const RevealPage = React.lazy(() => import("@/pages/reveal"));

export default function OpenPage() {
  const { id } = useParams<{ id: string }>();
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!id) {
      setStatus("error");
      setErrorMsg("No gift ID provided");
      return;
    }

    const base = import.meta.env.BASE_URL.replace(/\/$/, "");

    fetch(`${base}/api/gifted/gifts/${id}`)
      .then(async (res) => {
        if (!res.ok) {
          setStatus("error");
          setErrorMsg(res.status === 404 ? "This gift could not be found" : "Something went wrong loading this gift");
          return;
        }
        const gift = await res.json();

        if (gift.videoPath) localStorage.setItem("gifted_video_path", gift.videoPath);
        else localStorage.removeItem("gifted_video_path");

        if (gift.photoPaths && gift.photoPaths.length > 0) localStorage.setItem("gifted_photo_paths", JSON.stringify(gift.photoPaths));
        else localStorage.removeItem("gifted_photo_paths");

        if (gift.personalNote) localStorage.setItem("gifted_personal_note", gift.personalNote);
        else localStorage.removeItem("gifted_personal_note");

        if (gift.playlistUrl) localStorage.setItem("gifted_playlist_url", gift.playlistUrl);
        else localStorage.removeItem("gifted_playlist_url");

        if (gift.giftTitle) localStorage.setItem("gifted_gift_title", gift.giftTitle);
        else localStorage.removeItem("gifted_gift_title");

        localStorage.setItem("gifted_experience", gift.experience);
        localStorage.setItem("gifted_occasion", gift.occasion);
        localStorage.setItem("gifted_recipient_name", gift.recipientName);
        localStorage.setItem("gifted_sender_name", gift.senderName);

        if (gift.amount) localStorage.setItem("gifted_amount", gift.amount);
        else localStorage.removeItem("gifted_amount");

        if (gift.intent) localStorage.setItem("gifted_intent", gift.intent);
        else localStorage.removeItem("gifted_intent");

        localStorage.setItem("gifted_gift_id", gift.id);
        localStorage.setItem("gifted_gift_paid", gift.paid ? "true" : "false");

        setStatus("ready");
      })
      .catch(() => {
        setStatus("error");
        setErrorMsg("Something went wrong loading this gift");
      });
  }, [id]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground text-sm">Loading your gift...</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-6">
          <AlertCircle className="w-8 h-8 text-destructive" />
        </div>
        <h1 className="font-serif text-3xl mb-3">Gift not found</h1>
        <p className="text-muted-foreground mb-8 max-w-sm">
          {errorMsg}. The link may have expired or been entered incorrectly.
        </p>
        <Link href="/">
          <Button variant="outline" className="rounded-xl">
            Go to gifted.
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      }
    >
      <RevealPage />
    </React.Suspense>
  );
}
