import { motion } from "framer-motion";

export default function MyDesigns() {
  return (
    <div className="min-h-screen bg-background px-6 py-16">
      <div className="max-w-4xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-display text-3xl md:text-4xl mb-2">My Designs</h1>
          <p className="text-muted-foreground text-sm mb-12">
            Your saved designs will appear here.
          </p>
        </motion.div>

        <div className="flex flex-col items-center justify-center py-24 text-center">
          <span className="text-4xl mb-4 opacity-30">📂</span>
          <p className="text-sm text-muted-foreground">No saved designs yet.</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Start building and save your work to see it here.
          </p>
        </div>
      </div>
    </div>
  );
}
