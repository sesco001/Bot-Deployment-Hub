import { motion } from "framer-motion";

export function LoadingScreen() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background">
      <motion.div
        animate={{ 
          scale: [1, 1.2, 1],
          opacity: [0.5, 1, 0.5],
        }}
        transition={{ 
          duration: 1.5, 
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className="w-16 h-16 rounded-full border-4 border-primary border-t-secondary animate-spin"
      />
      <p className="mt-6 text-muted-foreground font-display font-medium tracking-widest animate-pulse uppercase text-sm">
        Initializing...
      </p>
    </div>
  );
}

export function LoadingSpinner({ className }: { className?: string }) {
  return (
    <div className={`w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin ${className}`} />
  );
}
