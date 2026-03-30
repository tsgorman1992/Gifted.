import { ShieldCheck, MessageSquare, Bell, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function SmsConsentPage() {
  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-2xl mx-auto space-y-10">

        {/* Header */}
        <div className="text-center space-y-3">
          <Link href="/" className="text-2xl font-serif font-medium tracking-tight">gifted.</Link>
          <h1 className="text-3xl font-serif font-medium mt-4">SMS Messaging &amp; Consent</h1>
          <p className="text-muted-foreground">
            gifted. (gifted.page) sends transactional SMS only — no marketing, no lists, no recurring campaigns.
          </p>
        </div>

        {/* Message type 1 — OTP to recipient */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Identity Verification (OTP) — sent to recipients</h2>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            When a gift includes a redeemable cash balance, the recipient must verify their identity before claiming it.
            A 6-digit one-time code is sent to their phone <strong>only after they read the consent notice and tap the button below</strong>.
            No SMS is sent without this explicit action. Frequency: 1 message per redemption.
          </p>

          {/* Live mockup of the exact OTP gate UI */}
          <div className="bg-card border border-border rounded-[2rem] p-8 space-y-6 shadow-sm">
            <div className="text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <ShieldCheck className="w-7 h-7 text-primary" />
              </div>
              <h3 className="font-serif text-3xl font-medium">Verify to Claim</h3>
              <p className="text-muted-foreground text-sm max-w-xs mx-auto">
                To protect the balance, we need to confirm you're the intended recipient.
              </p>
            </div>

            <div className="space-y-1.5">
              <p className="text-sm font-medium text-foreground">
                We'll send a one-time code to the phone number on file.
              </p>
              <p className="text-xs text-muted-foreground">
                This is the number the sender entered when creating your gift. The code expires in 10 minutes.
              </p>
            </div>

            <Button className="w-full h-12 rounded-full text-base pointer-events-none opacity-90">
              Send verification code
            </Button>

            {/* ← THIS IS THE CONSENT LANGUAGE shown to recipients before any SMS is sent */}
            <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-center">
              <p className="text-sm text-foreground leading-relaxed">
                By tapping this button, I agree to receive a text message from <strong>gifted.</strong> (gifted.page) for identity verification. Msg &amp; data rates may apply. Reply <strong>STOP</strong> to opt out, <strong>HELP</strong> for info. 1 message per redemption.
              </p>
            </div>
          </div>

          <div className="bg-muted/50 rounded-2xl p-4 space-y-1">
            <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Sample message sent</p>
            <p className="text-sm text-muted-foreground font-mono">
              Your gifted. verification code is 847291. Expires in 10 min. Do not share it with anyone. Reply STOP to opt out, HELP for help. Msg &amp; data rates may apply.
            </p>
          </div>
        </section>

        <hr className="border-border" />

        {/* Message type 2 — Notifications to senders */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Gift Activity Alerts — sent to senders</h2>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Senders who voluntarily provide their own phone number during gift creation receive transactional
            notifications about the gift they built — when it goes live, when the recipient opens it, when
            it is redeemed, or when a physical package is delivered. These go to the <strong>sender's own number</strong>,
            not the recipient's. Every message includes opt-out instructions.
          </p>
          <div className="grid gap-3">
            {[
              { label: "Scheduled gift ready", msg: "gifted. 🎁 Your gift for [Name] is live! Copy this link and send it to them — when it comes from you, it lands differently: gifted.page/open/… Reply STOP to opt out." },
              { label: "Gift opened", msg: "gifted. 🎁 [Name] just opened your gift! Head to your dashboard to see their reaction. Reply STOP to opt out." },
              { label: "Gift redeemed", msg: "gifted. 🎉 [Name] redeemed their $50.00 gift. Your generosity made their day! Reply STOP to opt out." },
              { label: "Package delivered", msg: "gifted. 🎁 Your gift to [Name] just arrived! Reply STOP to opt out." },
            ].map(({ label, msg }) => (
              <div key={label} className="bg-muted/50 rounded-2xl p-4 space-y-1">
                <p className="text-xs font-semibold text-foreground uppercase tracking-wide">{label}</p>
                <p className="text-sm text-muted-foreground">{msg}</p>
              </div>
            ))}
          </div>
        </section>

        <hr className="border-border" />

        {/* Opt-out */}
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Opt-Out</h2>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Reply <strong>STOP</strong> to any message to opt out immediately. Reply <strong>HELP</strong> for assistance.
            Msg &amp; data rates may apply. For questions, email{" "}
            <a href="mailto:help@gifted.page" className="underline underline-offset-2">help@gifted.page</a>.
          </p>
        </section>

        <p className="text-center text-xs text-muted-foreground pb-8">
          <Link href="/privacy" className="underline underline-offset-2">Privacy Policy</Link>
          {" · "}
          <Link href="/terms" className="underline underline-offset-2">Terms of Service</Link>
        </p>

      </div>
    </div>
  );
}
