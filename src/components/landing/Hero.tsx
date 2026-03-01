import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

export default function Hero() {
  const navigate = useNavigate();

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-forge-dark via-background to-background" />

      {/* Ember particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(12)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-primary"
            style={{
              left: `${10 + Math.random() * 80}%`,
              bottom: `${Math.random() * 40}%`,
            }}
            animate={{
              y: [0, -200 - Math.random() * 300],
              opacity: [0, 1, 0],
              scale: [0.5, 1, 0.3],
            }}
            transition={{
              duration: 3 + Math.random() * 4,
              repeat: Infinity,
              delay: Math.random() * 5,
              ease: "easeOut",
            }}
          />
        ))}
      </div>

      <div className="relative z-10 text-center px-6 max-w-3xl">
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-xs uppercase tracking-[0.3em] text-primary mb-6 font-body"
        >
          Powered by GalaxiForge Casting
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="font-display text-4xl md:text-6xl lg:text-7xl font-bold leading-tight ember-text"
        >
          Carve Your Wax.
          <br />
          <span className="text-primary">We Forge the Ring.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-6 text-lg text-muted-foreground max-w-xl mx-auto font-body"
        >
          Sculpt a custom ring in digital wax, preview it in metal, and send it straight
          to the forge for precision casting.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-10 flex gap-4 justify-center"
        >
          <Button
            size="lg"
            onClick={() => navigate("/builder")}
            className="bg-primary text-primary-foreground hover:bg-ember-glow px-8 py-6 text-base font-display tracking-wider animate-ember-pulse"
          >
            Start Carving
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })}
            className="border-border text-foreground hover:bg-secondary px-8 py-6 text-base font-body"
          >
            How It Works
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
