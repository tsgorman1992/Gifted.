import React from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { ChevronDown, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

const FAQS = [
  {
    question: "How does the cash balance work?",
    answer:
      "When you send a gift, you choose an amount and pay for it securely via card (powered by Stripe). gifted. holds those funds on your behalf. When your recipient opens their gift and clicks \"Redeem\", they provide their payout details and our team sends the balance directly to them within 24 hours — guaranteed. No gift cards, no restrictions — just real money, their way.",
  },
  {
    question: "Do I need to include a cash balance?",
    answer:
      "Not at all. The balance is completely optional. gifted. is built around the personal moment — the video, photos, note, and a link to something meaningful. You can send a purely emotional gift with no money attached, and it'll be just as meaningful.",
  },
  {
    question: "How long does the payout take?",
    answer:
      "Within 24 hours of the recipient submitting their details — guaranteed. In practice it's usually much faster. We send the balance directly to the Venmo, Cash App, PayPal, or Zelle account they provide.",
  },
  {
    question: "Is my payment information secure?",
    answer:
      "Yes. All payments are processed by Stripe, one of the most trusted payment platforms in the world. gifted. never sees or stores your full card number — all sensitive payment data is handled directly by Stripe's PCI-compliant infrastructure.",
  },
  {
    question: "Is there a fee?",
    answer:
      "gifted. charges a 5% platform fee on top of the gift amount, shown as a separate line item at checkout. This covers card processing, SMS delivery, and platform operations. There are no monthly fees, subscriptions, or hidden charges.",
  },
  {
    question: "Do gifts expire?",
    answer:
      "Gift balances do not expire. Your recipient can redeem whenever they're ready — there's no rush and no deadline. The gift link itself remains active indefinitely.",
  },
  {
    question: "What happens if my recipient can't access the link?",
    answer:
      "If your recipient has trouble opening the link, the easiest fix is to re-send it to them directly. If the problem persists, email us at help@gifted.page and we'll make sure they can access their gift.",
  },
  {
    question: "Can I send a gift without creating an account?",
    answer:
      "You can build and preview a gift without signing in. You'll need to sign in to save and share your gift — this links the gift to your account so you can track its status and manage your sent gifts.",
  },
  {
    question: "Can I see whether my recipient opened the gift?",
    answer:
      "Yes. From your \"My Gifts\" dashboard (after signing in), you can see all the gifts you've sent and whether each one has been opened and redeemed.",
  },
  {
    question: "What media formats are supported?",
    answer:
      "For video: MP4, MOV, and WebM files up to 200MB. For photos: JPG, PNG, HEIC, and WebP, up to 20MB each. You can add up to 6 photos per gift. You can also add any link — a Spotify playlist, Apple Music mix, concert tickets, restaurant reservation, Airbnb stay, and more.",
  },
  {
    question: "Can I cancel or refund a gift?",
    answer:
      "If the gift hasn't been redeemed yet, contact us at help@gifted.page and we'll process a refund. Once a balance has been redeemed by the recipient, it cannot be reversed.",
  },
  {
    question: "What is a spending intention?",
    answer:
      "A spending intention is an optional label you can add to the gift balance — like \"Coffee on me\", \"Date night\", or \"Treat yourself\". It makes the gift feel more thoughtful and personal, giving the recipient a sense of how you'd love them to spend it, without actually restricting what they do with the money.",
  },
  {
    question: "What is physical gift tracking, and when does it arrive?",
    answer:
      "If the sender included a link to a physical item (like a product, delivery, or experience), you can tap that link inside the gift to track or view it. Delivery timing depends entirely on wherever the sender linked to — gifted. doesn't ship physical items itself.",
  },
  {
    question: "Something went wrong — how do I get help?",
    answer:
      "We're sorry to hear that! Head to our Contact page and send us a message, or email us directly at help@gifted.page. We respond within 24 hours and will do everything we can to make it right.",
  },
];

function AccordionItem({
  question,
  answer,
  index,
}: {
  question: string;
  answer: string;
  index: number;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.04, duration: 0.5, ease: "easeOut" }}
      className="border-b border-border last:border-0"
    >
      <button
        className="w-full py-6 flex items-center justify-between text-left gap-4 hover:text-primary transition-colors"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="text-base md:text-lg font-semibold">{question}</span>
        <ChevronDown
          className={`w-5 h-5 shrink-0 text-muted-foreground transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ${open ? "max-h-96 pb-6" : "max-h-0"}`}
      >
        <p className="text-muted-foreground leading-relaxed">{answer}</p>
      </div>
    </motion.div>
  );
}

export default function FaqPage() {
  return (
    <div className="min-h-screen w-full pb-24">
      <div className="max-w-3xl mx-auto px-6 pt-16 md:pt-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h1 className="font-serif text-5xl md:text-6xl font-medium mb-4">
            Help & FAQ
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Everything you need to know about gifted. If you don't find your answer here, we're happy to help directly.
          </p>
        </motion.div>

        <div className="bg-card border border-border rounded-3xl px-6 md:px-10 mb-16">
          {FAQS.map((faq, i) => (
            <AccordionItem key={i} {...faq} index={i} />
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center bg-secondary/50 rounded-3xl p-10 border border-border"
        >
          <Mail className="w-10 h-10 text-primary mx-auto mb-4" />
          <h2 className="font-serif text-2xl font-medium mb-2">Still have questions?</h2>
          <p className="text-muted-foreground mb-6">
            Our team is here to help. We respond within 24 hours.
          </p>
          <Link href="/contact">
            <Button className="rounded-full px-8 h-12">
              Get in touch
            </Button>
          </Link>
        </motion.div>

        <div className="mt-10 text-center">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
