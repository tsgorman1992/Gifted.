import React, { useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Mail, SendHorizonal } from "lucide-react";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const subject = encodeURIComponent(`Message from ${name}`);
    const body = encodeURIComponent(`Name: ${name}\nEmail: ${email}\n\n${message}`);
    window.location.href = `mailto:tsgorman1992@gmail.com?subject=${subject}&body=${body}`;
  }

  return (
    <div className="min-h-screen w-full pb-24">
      <div className="max-w-2xl mx-auto px-6 pt-16 md:pt-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Mail className="w-7 h-7 text-primary" />
          </div>
          <h1 className="font-serif text-5xl md:text-6xl font-medium mb-4">Get in touch</h1>
          <p className="text-lg text-muted-foreground max-w-md mx-auto">
            We're here to help. Fill in the form below and we'll get back to you — usually within a few hours.
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            Or email us directly at{" "}
            <a href="mailto:tsgorman1992@gmail.com" className="text-primary hover:underline">
              tsgorman1992@gmail.com
            </a>
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="bg-card border border-border rounded-3xl px-8 py-10 shadow-sm"
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Your name</Label>
              <Input
                id="name"
                placeholder="e.g. Sarah Connor"
                className="h-12 rounded-xl"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Your email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                className="h-12 rounded-xl"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                placeholder="Tell us what's on your mind…"
                className="rounded-xl min-h-[140px] resize-none"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
              />
            </div>

            <Button type="submit" size="lg" className="w-full h-13 rounded-full text-base gap-2">
              <SendHorizonal className="w-4 h-4" />
              Send message
            </Button>
          </form>
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
