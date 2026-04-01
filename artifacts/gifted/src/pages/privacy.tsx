import React from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="font-serif text-2xl font-medium mb-4 text-foreground">{title}</h2>
      <div className="text-muted-foreground leading-relaxed space-y-3">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen w-full pb-24">
      <div className="max-w-3xl mx-auto px-6 pt-16 md:pt-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <p className="text-sm text-muted-foreground mb-3">Last updated: April 2026</p>
          <h1 className="font-serif text-5xl md:text-6xl font-medium mb-4">Privacy Policy</h1>
          <p className="text-lg text-muted-foreground">
            Your privacy matters to us. This policy explains what data we collect, how we use it, and your rights around it.
          </p>
        </motion.div>

        <Section title="Information We Collect">
          <p>When you use gifted., we collect:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong className="text-foreground">Account information</strong> — Your name, email address, and profile picture when you sign in (provided via your identity provider).
            </li>
            <li>
              <strong className="text-foreground">Gift content</strong> — Videos, photos, personal notes, playlist URLs, and gift details you provide when creating a gift. This content is stored securely and only accessible to you and your recipient via their unique gift link.
            </li>
            <li>
              <strong className="text-foreground">Payment information</strong> — We do not store your raw card details. Payment is processed by Stripe, Inc., which collects and securely stores payment information under their own privacy policy. We receive and store a transaction reference and payment status from Stripe.
            </li>
            <li>
              <strong className="text-foreground">Usage data</strong> — Basic information about how you use the platform (e.g., pages visited, actions taken) to improve our service.
            </li>
            <li>
              <strong className="text-foreground">Technical data</strong> — IP address, browser type, and device information collected automatically when you visit gifted.
            </li>
          </ul>
        </Section>

        <Section title="How We Use Your Information">
          <p>We use the information we collect to:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Deliver gifts to recipients via unique shareable links</li>
            <li>Process payments and initiate payouts to recipients</li>
            <li>Show you a history of gifts you've sent via your dashboard</li>
            <li>Provide customer support when you contact us</li>
            <li>Improve gifted.'s features and user experience</li>
            <li>Detect and prevent fraud and abuse</li>
          </ul>
          <p>We do not sell your personal data to third parties. We do not use your content for advertising or train AI models on your personal uploads.</p>
        </Section>

        <Section title="Third-Party Services">
          <p>We work with the following trusted third parties:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong className="text-foreground">Stripe</strong> — Payment processing and payout delivery. Stripe's privacy policy applies to all payment data they process.{" "}
              <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">stripe.com/privacy</a>
            </li>
            <li>
              <strong className="text-foreground">Google Cloud Storage</strong> — Secure storage for uploaded videos and photos. Files are stored encrypted at rest.
            </li>
            <li>
              <strong className="text-foreground">Replit</strong> — Cloud infrastructure for hosting the gifted. platform.
            </li>
            <li>
              <strong className="text-foreground">OpenAI</strong> — Used to power the AI-assisted gift note writing feature. Your note context (recipient name, occasion, and any existing note) may be sent to OpenAI to generate suggestions. We do not send personal payment data or uploaded media to OpenAI.
            </li>
          </ul>
        </Section>

        <Section title="Data Retention">
          <p>
            <strong className="text-foreground">Uploaded media (videos and photos)</strong> — Videos and photos you upload are automatically deleted from our servers 90 days after the gift is redeemed. For paid gifts that are never redeemed, media is deleted 1 year after the gift was created. Personal notes and gift details are retained as part of your gift history.
          </p>
          <p>
            <strong className="text-foreground">Gift links</strong> — Gift links remain accessible indefinitely unless you request removal, even after media has been purged. The gift record (recipient name, occasion, amount) is retained for your records.
          </p>
          <p>
            <strong className="text-foreground">Account data</strong> — Retained until you delete your account. You can request account deletion by emailing{" "}
            <a href="mailto:privacy@gifted.page" className="text-primary hover:underline">privacy@gifted.page</a>.
          </p>
        </Section>

        <Section title="Your Rights">
          <p>Depending on your location, you may have the right to:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Access the personal data we hold about you</li>
            <li>Request correction of inaccurate data</li>
            <li>Request deletion of your data</li>
            <li>Object to or restrict certain processing</li>
            <li>Data portability (receive a copy of your data in a machine-readable format)</li>
          </ul>
          <p>
            To exercise any of these rights, email{" "}
            <a href="mailto:privacy@gifted.page" className="text-primary hover:underline">
              privacy@gifted.page
            </a>
            . We'll respond within 30 days.
          </p>
        </Section>

        <Section title="Cookies">
          <p>
            gifted. uses a session cookie (<code className="bg-muted px-1.5 py-0.5 rounded text-sm text-foreground">sid</code>) to keep you signed in. This cookie is <em>httpOnly</em> and <em>secure</em> — it cannot be accessed by JavaScript and is only sent over HTTPS. We do not use tracking cookies or third-party advertising cookies.
          </p>
        </Section>

        <Section title="Security">
          <p>
            We take data security seriously. All data is transmitted over HTTPS. Uploaded files are stored encrypted at rest in Google Cloud Storage. Session tokens are stored securely in our database and invalidated on logout. Payment data is handled exclusively by Stripe's PCI-compliant infrastructure.
          </p>
        </Section>

        <Section title="Children's Privacy">
          <p>
            gifted. is not intended for children under 13. We do not knowingly collect personal data from children. If you believe a child has provided us with personal data, contact us at privacy@gifted.page.
          </p>
        </Section>

        <Section title="Changes to This Policy">
          <p>
            We may update this privacy policy from time to time. We'll notify you of material changes via email or a notice on the platform. The "Last updated" date at the top reflects the most recent revision.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions about your privacy?{" "}
            <a href="mailto:privacy@gifted.page" className="text-primary hover:underline">
              privacy@gifted.page
            </a>
          </p>
        </Section>

        <div className="mt-12 pt-8 border-t border-border flex gap-6 text-sm text-muted-foreground">
          <Link href="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
          <Link href="/faq" className="hover:text-foreground transition-colors">Help & FAQ</Link>
          <Link href="/" className="hover:text-foreground transition-colors">← Home</Link>
        </div>
      </div>
    </div>
  );
}
