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

export default function TermsPage() {
  return (
    <div className="min-h-screen w-full pb-24">
      <div className="max-w-3xl mx-auto px-6 pt-16 md:pt-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <p className="text-sm text-muted-foreground mb-3">Last updated: March 2026</p>
          <h1 className="font-serif text-5xl md:text-6xl font-medium mb-4">Terms of Service</h1>
          <p className="text-lg text-muted-foreground">
            Please read these terms carefully before using gifted. By using our service, you agree to be bound by them.
          </p>
        </motion.div>

        <div className="prose-like">
          <Section title="1. What gifted. is">
            <p>
              gifted. is a digital gifting platform that lets people send personalized gift experiences — including video messages, photos, playlists, personal notes, and optional cash balances — to friends, family, and colleagues.
            </p>
            <p>
              gifted. is operated as an independent platform. Payment processing is provided by Stripe, Inc. gifted. is not a bank, financial institution, or money transmitter.
            </p>
          </Section>

          <Section title="2. Eligibility">
            <p>
              You must be at least 18 years old and a legal resident of a country where our service is available to use gifted. By creating an account, you confirm that you meet these requirements.
            </p>
            <p>
              Gift recipients do not need an account to open a gift, but they must provide valid payout information to redeem a cash balance.
            </p>
          </Section>

          <Section title="3. Accounts">
            <p>
              You are responsible for keeping your account credentials secure. You are responsible for all activity that occurs under your account. Notify us immediately at help@gifted.page if you believe your account has been compromised.
            </p>
            <p>
              We reserve the right to suspend or terminate accounts that violate these terms, engage in fraudulent activity, or misuse the platform.
            </p>
          </Section>

          <Section title="4. Payments and Balances">
            <p>
              When you add a cash balance to a gift, you authorize gifted. to charge your payment method for the stated gift amount plus an 8% platform service fee and a card processing fee passed through at cost. Both fees are shown as separate line items before checkout. The minimum gift balance is $10. Payment is collected at the time of sending. The platform and processing fees are non-refundable and cover premium delivery, experience design, and secure payout processing.
            </p>
            <p>
              gifted. holds gift balances on behalf of senders until recipients redeem them. Once a recipient submits valid payout information, the gifted. team processes the transfer same day.
            </p>
            <p>
              Gift balances do not expire during the 90-day redemption window. If a gift balance has not been redeemed within 90 days of sending, gifted. will automatically refund the gift balance (excluding the platform service fee and card processing fee) to the original payment method. We will make reasonable efforts to notify you before processing the refund.
            </p>
            <p>
              We do not guarantee the availability of any specific payout method. The maximum gift balance is $500 per gift.
            </p>
          </Section>

          <Section title="5. Refunds">
            <p>
              If a gift balance has not been redeemed, you may request a refund within 90 days of sending by emailing help@gifted.page. Refunds are processed to the original payment method within 5–10 business days. The platform service fee and card processing fee are not refundable.
            </p>
            <p>
              Unredeemed gift balances are automatically refunded after 90 days. Once a recipient has redeemed a gift balance, the transaction is final and cannot be reversed.
            </p>
          </Section>

          <Section title="6. Acceptable Use">
            <p>You agree not to use gifted. to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Send unlawful, harassing, abusive, or fraudulent gifts</li>
              <li>Impersonate another person or entity</li>
              <li>Upload content that infringes on intellectual property rights</li>
              <li>Attempt to reverse-engineer, hack, or disrupt the platform</li>
              <li>Use the platform for any commercial solicitation without our consent</li>
            </ul>
          </Section>

          <Section title="7. Content You Upload">
            <p>
              By uploading video, photos, or other content to gifted., you grant gifted. a limited, non-exclusive license to store and display that content solely for the purpose of delivering your gift. We do not claim ownership of your content.
            </p>
            <p>
              You are responsible for ensuring you have the right to share any content you upload. Do not upload content that is illegal, harmful, or violates others' rights.
            </p>
          </Section>

          <Section title="8. Limitation of Liability">
            <p>
              gifted. is provided "as is" without warranties of any kind. To the maximum extent permitted by law, gifted. is not liable for any indirect, incidental, or consequential damages arising from your use of the platform.
            </p>
            <p>
              Our total liability to you for any claim arising from use of gifted. shall not exceed the amount you paid to gifted. in the 12 months preceding the claim.
            </p>
          </Section>

          <Section title="9. SMS Messaging">
            <p>
              gifted. sends two types of transactional SMS messages. We do not send marketing or promotional SMS messages.
            </p>
            <p>
              <strong>Gift link delivery (senders):</strong> After creating a gift on desktop, a sender may enter their own mobile number to receive a one-time text containing their gift link so they can forward it to the recipient. By entering your number and tapping "Send to me," you consent to receive this single SMS. Your consent is not a condition of purchase.
            </p>
            <p>
              <strong>Identity verification (recipients):</strong> When a recipient opens a gift with a cash balance, they may tap "Send verification code" to receive a one-time 6-digit code for identity verification. This message is sent only on the recipient's explicit request and is powered by Twilio Verify. By tapping the button, the recipient consents to receive this single verification SMS.
            </p>
            <p>
              <strong>Message frequency:</strong> 1 message per use case, per gift. <strong>Msg&amp;data rates may apply.</strong>
            </p>
            <p>
              To opt out, reply <strong>STOP</strong> to any message from gifted. For help, reply <strong>HELP</strong> or contact{" "}
              <a href="mailto:help@gifted.page" className="text-primary hover:underline">help@gifted.page</a>.
            </p>
            <p>
              gifted. does not sell or share your phone number with third parties for marketing purposes. See our{" "}
              <a href="/privacy" className="text-primary hover:underline">Privacy Policy</a>{" "}
              and our{" "}
              <a href="/sms-consent" className="text-primary hover:underline">SMS Messaging Policy</a> for full details.
            </p>
          </Section>

          <Section title="10. Changes to These Terms">
            <p>
              We may update these terms from time to time. When we make material changes, we'll notify you by email or by posting a notice on the platform. Continued use of gifted. after changes take effect constitutes acceptance of the updated terms.
            </p>
          </Section>

          <Section title="11. Contact">
            <p>
              Questions about these terms? Email us at{" "}
              <a href="mailto:legal@gifted.page" className="text-primary hover:underline">
                legal@gifted.page
              </a>
              .
            </p>
          </Section>
        </div>

        <div className="mt-12 pt-8 border-t border-border flex gap-6 text-sm text-muted-foreground">
          <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
          <Link href="/faq" className="hover:text-foreground transition-colors">Help & FAQ</Link>
          <Link href="/" className="hover:text-foreground transition-colors">← Home</Link>
        </div>
      </div>
    </div>
  );
}
