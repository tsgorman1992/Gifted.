import { Link } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background px-6 text-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center gap-6 max-w-sm"
      >
        <a href="/" className="font-serif text-3xl font-bold text-foreground tracking-tight hover:opacity-70 transition-opacity">
          gifted.
        </a>

        <div className="space-y-3">
          <h1 className="font-serif text-4xl font-medium">This moment doesn't exist.</h1>
          <p className="text-muted-foreground text-base leading-relaxed">
            The link may be broken, or this page has moved. Head home and pick up where you left off.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full">
          <Link href="/" className="flex-1">
            <Button variant="outline" className="rounded-full w-full h-11">
              Go home
            </Button>
          </Link>
          <Link href="/create" className="flex-1">
            <Button className="rounded-full w-full h-11">
              Build a moment
            </Button>
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
