import { ShieldCheck, MessageSquare, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function SmsConsentPage() {
  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-2xl mx-auto space-y-10">

        {/* Header */}
        <div className="text-center space-y-3">
          <Link href="/" className="text-2xl font-serif font-medium tracking-tight">gifted<span className="text-primary">.</span></Link>
          <h1 className="text-3xl font-serif font-medium mt-4">SMS Messaging Policy</h1>
          <p className="text-muted-foreground">
            gifted. (gifted.page) sends two types of SMS messages — one to gift senders so they can share their
            gift link, and one to recipients for identity verification when claiming a cash balance.
            No marketing. No subscriptions. No recurring messages.
          </p>
        </div>

        {/* Use Case 1 — Sender */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Send className="w-5 h-5 text-primary" />
            <h2 className="text-base font-semibold">Use Case 1 — Gift Link to Sender</h2>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            After a sender creates a gift on desktop, they can optionally request a text with their own gift link so
            they can forward it to the recipient from their personal number. This is always a self-send — the SMS
            goes to the sender's own phone. The sender enters their number and taps <strong>"Send to me"</strong>,
            reading the full consent notice before submission.
          </p>
          <div className="bg-muted/50 rounded-2xl p-4 space-y-1">
            <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Sample message</p>
            <p className="text-sm text-muted-foreground font-mono">
              gifted.: Your gift link for Alex is ready.{"\n\n"}Copy this link and paste it into iMessage or WhatsApp — when it comes from your number, they'll open it:{"\n"}https://gifted.page/open/abc123{"\n\n"}Reply STOP to unsubscribe, HELP for help. Msg&data rates may apply.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-muted/40 px-4 py-3">
            <p className="text-sm text-foreground leading-relaxed">
              <strong>Consent language shown before send:</strong> "By tapping 'Send to me' I agree to receive a one-time text at this number from gifted. Reply STOP to unsubscribe, HELP for help. Msg&data rates may apply."
            </p>
          </div>
        </section>

        {/* Use Case 2 — Recipient Verification */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <h2 className="text-base font-semibold">Use Case 2 — Recipient Identity Verification (2FA)</h2>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            When a recipient opens a gift with a cash balance, they must verify their identity before claiming.
            They tap <strong>"Send verification code"</strong> — reading the full consent notice first.
            The code is delivered via Twilio Verify. The SMS is <em>never</em> sent automatically or proactively;
            it only fires on the recipient's explicit tap.
          </p>

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

          <div className="bg-muted/50 rounded-2xl p-4 space-y-1">
            <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Sample verification message</p>
            <p className="text-sm text-muted-foreground font-mono">
              Your gifted. verification code is 847291. This code expires in 10 minutes. Do not share it with anyone.
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
