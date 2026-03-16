import React, { useState, useEffect } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { Button } from "@/components/ui/button";
import { Play, Heart, Sparkles } from "lucide-react";
import { mockGiftData } from "@/lib/mock-data";

export default function RevealPage() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Disable scrolling when closed to focus on the envelope
    document.body.style.overflow = isOpen ? "auto" : "hidden";
    return () => { document.body.style.overflow = "auto"; };
  }, [isOpen]);

  const handleOpen = () => {
    setIsOpen(true);
    // Fire rich confetti
    const duration = 3000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 5,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#d49a89', '#f3e5e1', '#b56a56']
      });
      confetti({
        particleCount: 5,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#d49a89', '#f3e5e1', '#b56a56']
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();
  };

  return (
    <div className="w-full min-h-screen bg-background relative">
      
      {/* The Envelope / Pre-reveal state */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div 
            exit={{ opacity: 0, y: -50, scale: 0.95 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center p-6"
          >
            <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-40">
               <img src={`${import.meta.env.BASE_URL}${mockGiftData.themeImage}`} alt="" className="w-full h-full object-cover blur-2xl" />
            </div>
            
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.8 }}
              className="relative z-10 flex flex-col items-center text-center"
            >
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-8">
                <Heart className="w-8 h-8 text-primary animate-pulse" />
              </div>
              <p className="text-lg font-medium text-muted-foreground mb-2">A gift for</p>
              <h1 className="font-serif text-5xl md:text-7xl mb-12">{mockGiftData.recipientName}</h1>
              
              <Button 
                onClick={handleOpen} 
                size="lg" 
                className="rounded-full h-16 px-10 text-xl shadow-2xl shadow-primary/30 hover:scale-105 transition-all duration-300"
              >
                Tap to open
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* The Revealed Gift Content */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="w-full pb-32"
          >
            {/* Hero Cover */}
            <div className="w-full h-[60vh] md:h-[70vh] relative flex items-end">
              <div className="absolute inset-0">
                <img 
                  src={`${import.meta.env.BASE_URL}${mockGiftData.themeImage}`} 
                  alt="Theme" 
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
              </div>
              
              <div className="relative z-10 w-full max-w-4xl mx-auto px-6 pb-12">
                <motion.div
                  initial={{ y: 30, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.5, duration: 0.8 }}
                >
                  <h1 className="font-serif text-5xl md:text-7xl font-medium text-foreground mb-4">
                    {mockGiftData.title}
                  </h1>
                  <p className="text-xl text-muted-foreground">Sent with love by {mockGiftData.senderName}</p>
                </motion.div>
              </div>
            </div>

            <div className="max-w-4xl mx-auto px-6 space-y-16 -mt-8 relative z-20">
              
              {/* Note */}
              <motion.div 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="bg-card/80 backdrop-blur-xl rounded-[2rem] p-8 md:p-12 border border-white/20 shadow-xl"
              >
                <p className="font-serif text-2xl md:text-3xl leading-relaxed text-foreground text-center">
                  "{mockGiftData.message}"
                </p>
              </motion.div>

              {/* Video Mockup */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.9 }}
                className="w-full aspect-video rounded-[2rem] bg-secondary border border-border relative overflow-hidden group cursor-pointer"
              >
                {/* Fallback image for video placeholder */}
                <img 
                  src="https://images.unsplash.com/photo-1516627145497-ae6968895b74?w=1200&h=800&fit=crop" 
                  alt="Video thumbnail" 
                  className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                  <div className="w-20 h-20 rounded-full bg-white/30 backdrop-blur-md flex items-center justify-center text-white border border-white/40 group-hover:bg-primary group-hover:border-primary transition-all duration-300 shadow-xl">
                    <Play className="w-8 h-8 ml-1" fill="currentColor" />
                  </div>
                </div>
              </motion.div>

              {/* Photos Mockup Grid */}
              <motion.div
                 initial={{ y: 20, opacity: 0 }}
                 animate={{ y: 0, opacity: 1 }}
                 transition={{ delay: 1.1 }}
                 className="grid grid-cols-2 md:grid-cols-3 gap-4"
              >
                {[
                  "photo-1522869635100-9f4c5e86aa37",
                  "photo-1511895426328-dc8714191300",
                  "photo-1492691527719-9d1e07e534b4"
                ].map((id, i) => (
                  <div key={i} className={`rounded-3xl overflow-hidden bg-secondary aspect-square ${i === 0 ? "md:col-span-2 md:aspect-[2/1]" : ""}`}>
                     {/* landing page lifestyle photography */}
                     <img 
                      src={`https://images.unsplash.com/${id}?w=800&fit=crop`} 
                      alt="Memory" 
                      className="w-full h-full object-cover" 
                    />
                  </div>
                ))}
              </motion.div>

              {/* Balance Reveal */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 1.3 }}
                className="w-full bg-primary text-primary-foreground rounded-[2.5rem] p-10 md:p-16 text-center relative overflow-hidden shadow-2xl shadow-primary/20"
              >
                {/* Decorative background circle */}
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
                
                <div className="relative z-10 flex flex-col items-center">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 backdrop-blur-sm mb-6 text-sm font-medium">
                    <Sparkles className="w-4 h-4" />
                    <span>{mockGiftData.intent}</span>
                  </div>
                  
                  <h3 className="text-xl md:text-2xl font-medium opacity-90 mb-2">You received</h3>
                  <div className="font-serif text-7xl md:text-9xl mb-8 tracking-tighter">
                    ${mockGiftData.amount}
                  </div>
                  
                  <p className="text-lg opacity-80 mb-10 max-w-md mx-auto">
                    Sent with intention. Yours to use however you need.
                  </p>
                  
                  <Link href="/redeem">
                    <Button size="lg" className="rounded-full h-16 px-10 text-xl bg-white text-primary hover:bg-white/90 shadow-xl hover:-translate-y-1 transition-all w-full sm:w-auto">
                      Redeem your balance
                    </Button>
                  </Link>
                </div>
              </motion.div>
              
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
