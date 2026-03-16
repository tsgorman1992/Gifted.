import React from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Copy, ArrowRight, Video, Music, Image as ImageIcon, Sparkles } from "lucide-react";
import { mockGiftData } from "@/lib/mock-data";
import { useToast } from "@/hooks/use-toast";

export default function PreviewPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleCopy = () => {
    toast({
      title: "Link copied!",
      description: "You can now share this link with the recipient.",
    });
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-12 flex flex-col md:flex-row gap-12">
      
      {/* Left: The Preview Mockup */}
      <div className="flex-1">
        <div className="sticky top-24">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs">👀</span>
            Recipient Preview
          </h2>
          
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-card rounded-[2rem] border border-border shadow-2xl overflow-hidden relative"
          >
            {/* Mock Phone Chrome */}
            <div className="h-6 w-full bg-secondary/50 border-b border-border flex justify-center items-center">
              <div className="w-16 h-1 rounded-full bg-border" />
            </div>

            <div className="h-[600px] overflow-y-auto overflow-x-hidden bg-background">
              {/* Cover Art */}
              <div className="h-64 relative">
                <img 
                  src={`${import.meta.env.BASE_URL}${mockGiftData.themeImage}`} 
                  alt="Theme" 
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/20" />
                <div className="absolute bottom-6 left-6 right-6 text-white">
                  <p className="text-sm font-medium opacity-80 mb-1">A gift for</p>
                  <h3 className="font-serif text-4xl mb-4">{mockGiftData.recipientName}</h3>
                  <div className="w-full h-px bg-white/20 mb-4" />
                  <p className="text-sm opacity-90">From {mockGiftData.senderName}</p>
                </div>
              </div>

              {/* Content Body */}
              <div className="p-6 space-y-8">
                <div>
                  <h4 className="font-serif text-2xl mb-3">{mockGiftData.title}</h4>
                  <p className="text-muted-foreground leading-relaxed">
                    {mockGiftData.message}
                  </p>
                </div>

                {/* Included Media Badges */}
                <div className="flex flex-wrap gap-2">
                  <div className="px-3 py-1.5 rounded-full bg-secondary text-xs font-medium flex items-center gap-1.5">
                    <Video className="w-3.5 h-3.5 text-primary" /> 1 Video
                  </div>
                  <div className="px-3 py-1.5 rounded-full bg-secondary text-xs font-medium flex items-center gap-1.5">
                    <Music className="w-3.5 h-3.5 text-primary" /> Playlist
                  </div>
                  <div className="px-3 py-1.5 rounded-full bg-secondary text-xs font-medium flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-primary" /> {mockGiftData.photosCount} Photos
                  </div>
                </div>

                {/* Balance Block */}
                <div className="p-5 rounded-2xl bg-primary/5 border border-primary/10 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">{mockGiftData.intent}</p>
                    <p className="text-3xl font-bold font-serif text-primary">${mockGiftData.amount}</p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-primary" />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex-[0.8] flex flex-col justify-center">
        <h1 className="font-serif text-4xl font-medium mb-4">Your gift is ready.</h1>
        <p className="text-lg text-muted-foreground mb-10">
          This is exactly what {mockGiftData.recipientName} will see when they open their link.
        </p>

        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-secondary/50 border border-border">
            <p className="text-sm font-bold mb-3">1. Copy the share link</p>
            <div className="flex gap-2">
              <div className="flex-1 bg-background border border-border rounded-lg px-4 flex items-center text-sm text-muted-foreground truncate">
                gifted.co/open/123abcxyz
              </div>
              <Button onClick={handleCopy} variant="secondary" className="shrink-0 h-12">
                <Copy className="w-4 h-4 mr-2" /> Copy
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Send this link via text, email, or however you normally chat.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-secondary/50 border border-border">
            <p className="text-sm font-bold mb-3">2. Experience it yourself</p>
            <p className="text-sm text-muted-foreground mb-4">
              Want to see the animated reveal exactly how they will experience it?
            </p>
            <Link href="/reveal">
              <Button className="w-full rounded-xl h-12 shadow-md">
                Open recipient reveal <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
          </div>
          
          <div className="pt-4 text-center">
             <Link href="/create" className="text-sm font-medium text-muted-foreground hover:text-foreground underline underline-offset-4">
                Wait, I need to edit something
             </Link>
          </div>
        </div>
      </div>

    </div>
  );
}
