import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, Video, Music, Image as ImageIcon, DollarSign } from "lucide-react";

const THEMES = [
  { id: "warm", name: "Warm Glow", img: "theme-warm-glow.png" },
  { id: "midnight", name: "Midnight", img: "theme-midnight.png" },
  { id: "garden", name: "Garden", img: "theme-garden.png" }
];

const INTENTS = ["Coffee on me", "Treat yourself", "Date night", "Birthday money", "Baby fund", "Take a break"];
const AMOUNTS = ["25", "50", "100", "250"];

export default function CreatePage() {
  const [, setLocation] = useLocation();
  const [selectedTheme, setSelectedTheme] = useState("warm");
  const [amount, setAmount] = useState("");
  const [intent, setIntent] = useState("");

  const handlePreview = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real app, save to state/DB here
    setLocation("/preview");
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <div className="mb-10">
        <h1 className="font-serif text-4xl font-medium mb-3">Create a gift</h1>
        <p className="text-muted-foreground text-lg">Build a moment they won't forget.</p>
      </div>

      <form onSubmit={handlePreview} className="space-y-12">
        {/* Section 1: The Basics */}
        <section className="bg-card p-8 rounded-3xl shadow-sm border border-border space-y-6">
          <h2 className="text-xl font-bold border-b border-border pb-4">The Basics</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="recipient">Who is this for?</Label>
              <Input id="recipient" placeholder="e.g. Sarah" defaultValue="Sarah" className="h-12 rounded-xl text-base" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sender">Who is it from?</Label>
              <Input id="sender" placeholder="e.g. Jamie" defaultValue="Jamie" className="h-12 rounded-xl text-base" required />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="occasion">Occasion</Label>
            <Select defaultValue="birthday">
              <SelectTrigger className="h-12 rounded-xl text-base">
                <SelectValue placeholder="Select occasion" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="birthday">Birthday</SelectItem>
                <SelectItem value="anniversary">Anniversary</SelectItem>
                <SelectItem value="graduation">Graduation</SelectItem>
                <SelectItem value="baby">New Baby</SelectItem>
                <SelectItem value="just-because">Just Because</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Gift Headline</Label>
            <Input id="title" placeholder="e.g. Happy Birthday to my favorite person!" defaultValue="Happy Birthday, Sarah! 🎂" className="h-12 rounded-xl text-base font-medium" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Personal Note</Label>
            <Textarea 
              id="message" 
              placeholder="Write something meaningful..." 
              className="min-h-[120px] rounded-xl text-base resize-none"
              defaultValue="I couldn't be there in person, but I wanted to make sure you felt celebrated today. Use this to treat yourself to something nice. Miss you!"
              required
            />
          </div>
        </section>

        {/* Section 2: Add Meaning */}
        <section className="bg-card p-8 rounded-3xl shadow-sm border border-border space-y-6">
          <div className="border-b border-border pb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold">Add Meaning</h2>
            <span className="text-sm text-muted-foreground">Optional</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <button type="button" className="flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 transition-all group">
              <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
                <Video className="w-5 h-5 text-muted-foreground group-hover:text-primary" />
              </div>
              <span className="font-medium">Add a Video</span>
              <span className="text-xs text-muted-foreground mt-1">Record or upload</span>
            </button>
            
            <button type="button" className="flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 transition-all group">
              <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
                <ImageIcon className="w-5 h-5 text-muted-foreground group-hover:text-primary" />
              </div>
              <span className="font-medium">Add Photos</span>
              <span className="text-xs text-muted-foreground mt-1">Up to 6 images</span>
            </button>
          </div>

          <div className="space-y-2 mt-4">
            <Label>Spotify or Apple Music Playlist</Label>
            <div className="relative">
              <Music className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input 
                placeholder="Paste playlist URL here..." 
                className="h-12 rounded-xl text-base pl-12"
                defaultValue="https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M"
              />
            </div>
          </div>
        </section>

        {/* Section 3: Add a Balance */}
        <section className="bg-card p-8 rounded-3xl shadow-sm border border-border space-y-6">
          <div className="border-b border-border pb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold">Add a Balance</h2>
            <span className="text-sm text-muted-foreground">Optional</span>
          </div>

          <div className="space-y-4">
            <Label>Gift Amount</Label>
            <div className="flex flex-wrap gap-3">
              {AMOUNTS.map(amt => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setAmount(amt)}
                  className={`px-6 h-12 rounded-full font-bold text-lg border transition-all ${
                    amount === amt 
                      ? "bg-primary text-primary-foreground border-primary" 
                      : "bg-secondary text-secondary-foreground border-transparent hover:border-border"
                  }`}
                >
                  ${amt}
                </button>
              ))}
              <div className="relative flex-1 min-w-[120px]">
                <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input 
                  type="number" 
                  placeholder="Custom" 
                  className="h-12 rounded-full text-lg font-bold pl-10"
                  value={!AMOUNTS.includes(amount) && amount ? amount : ""}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-4">
            <Label>What is the intention behind this balance?</Label>
            <div className="flex flex-wrap gap-2">
              {INTENTS.map(lbl => (
                <button
                  key={lbl}
                  type="button"
                  onClick={() => setIntent(lbl)}
                  className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${
                    intent === lbl
                      ? "bg-foreground text-background border-foreground"
                      : "bg-background text-foreground border-border hover:border-foreground/30"
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Section 4: Visual Theme */}
        <section className="space-y-6">
          <h2 className="text-xl font-bold px-2">Choose a Visual Theme</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {THEMES.map(theme => (
              <button
                key={theme.id}
                type="button"
                onClick={() => setSelectedTheme(theme.id)}
                className={`relative rounded-2xl overflow-hidden text-left transition-all ${
                  selectedTheme === theme.id ? "ring-4 ring-primary ring-offset-4 ring-offset-background" : "hover:opacity-80"
                }`}
              >
                <div className="aspect-[4/3] bg-muted w-full relative">
                  <img 
                    src={`${import.meta.env.BASE_URL}images/${theme.img}`} 
                    alt={theme.name} 
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4">
                    <span className="text-white font-medium">{theme.name}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Submit */}
        <div className="sticky bottom-6 z-20 flex justify-end">
          <Button type="submit" size="lg" className="rounded-full h-14 px-8 text-lg shadow-xl shadow-primary/25 hover:-translate-y-1 transition-all">
            Preview your gift <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </div>
      </form>
    </div>
  );
}
