import { ShieldCheck, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function SmsConsentPage() {
  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-2xl mx-auto space-y-10">

        {/* Header */}
        <div className="text-center space-y-3">
          <Link href="/" className="text-2xl font-serif font-medium tracking-tight">gifted.</Link>
          <h1 className="text-3xl font-serif font-medium mt-4">SMS Opt-In Consent</h1>
          <p className="text-muted-foreground">
            gifted. (gifted.page) sends one type of SMS: a one-time identity verification code
            that recipients explicitly request when claiming a gift balance. No marketing. No recurring messages.
          </p>
        </div>

        {/* How it works */}
        <section className="space-y-3">
          <h2 className="text-base font-semibold">How opt-in works</h2>
          <ol className="space-y-3 text-sm text-muted-foreground">
            <li className="flex gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">1</span>
              <p>A sender creates a gift and enters the recipient's phone number. No SMS is sent at this step.</p>
            </li>
            <li className="flex gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">2</span>
              <p>The sender shares a private gift link with the recipient.</p>
            </li>
            <li className="flex gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">3</span>
              <p>The recipient opens the link. If a cash balance is attached, they see the screen below. They must <strong>actively tap "Send verification code"</strong> — reading the full consent notice first. The SMS is never sent automatically or proactively.</p>
            </li>
            <li className="flex gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">4</span>
              <p>After entering the correct 6-digit code, the recipient claims the balance.</p>
            </li>
          </ol>
        </section>

        {/* Exact opt-in UI */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <h2 className="text-base font-semibold">The exact opt-in screen recipients see</h2>
          </div>

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

            {/* Consent notice — identical to production */}
            <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-center">
              <p className="text-sm text-foreground leading-relaxed">
                By tapping this button, I agree to receive a text message from <strong>gifted.</strong> (gifted.page) for identity verification. Msg &amp; data rates may apply. Reply <strong>STOP</strong> to opt out, <strong>HELP</strong> for info. 1 message per redemption.
              </p>
            </div>
          </div>

          {/* Sample message */}
          <div className="bg-muted/50 rounded-2xl p-4 space-y-1">
            <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Sample message sent after tap</p>
            <p className="text-sm text-muted-foreground font-mono">
              Your gifted. verification code is 847291. Expires in 10 min. Do not share it with anyone. Reply STOP to opt out, HELP for help. Msg &amp; data rates may apply.
            </p>
          </div>
        </section>

        {/* Opt-out */}
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            <h2 className="text-base font-semibold">Opt-Out &amp; Support</h2>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Reply <strong>STOP</strong> to opt out immediately. Reply <strong>HELP</strong> for assistance.
            Msg &amp; data rates may apply. Questions: <a href="mailto:help@gifted.page" className="underline underline-offset-2">help@gifted.page</a>.
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
