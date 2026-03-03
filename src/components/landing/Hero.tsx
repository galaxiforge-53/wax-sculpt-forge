import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

export default function Hero() {
  const navigate = useNavigate();

  return (
    <section className="relative min-h-[85vh] sm:min-h-[90vh] flex items-center justify-center overflow-hidden cosmic-noise starfield">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-forge-dark via-background to-background" />

      {/* Subtle cosmic nebula glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-48 sm:w-96 h-48 sm:h-96 bg-primary/[0.03] rounded-full blur-[80px] sm:blur-[120px]" />
        <div className="absolute bottom-1/3 right-1/4 w-36 sm:w-72 h-36 sm:h-72 bg-accent/[0.02] rounded-full blur-[60px] sm:blur-[100px]" />
      </div>

      {/* Ember particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(8)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-0.5 h-0.5 rounded-full bg-primary/80"
            style={{
              left: `${15 + Math.random() * 70}%`,
              bottom: `${Math.random() * 30}%`,
            }}
            animate={{
              y: [0, -200 - Math.random() * 300],
              opacity: [0, 0.8, 0],
              scale: [0.5, 1, 0.3],
            }}
            transition={{
              duration: 4 + Math.random() * 4,
              repeat: Infinity,
              delay: Math.random() * 5,
              ease: "easeOut",
            }}
          />
        ))}
      </div>

      <div className="relative z-10 text-center px-5 sm:px-6 max-w-3xl">
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-[10px] uppercase tracking-[0.3em] sm:tracking-[0.4em] text-primary/80 mb-6 sm:mb-8 font-body"
        >
          ForgeLab · Powered by GalaxiForge
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="font-display text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-bold leading-[1.1] ember-text"
        >
          Carve Your Wax.
          <br />
          <span className="text-primary">We Forge the Ring.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-6 sm:mt-8 text-sm sm:text-base text-muted-foreground max-w-md mx-auto font-body leading-relaxed"
        >
          Sculpt a custom ring in digital wax, preview it in metal, and send it straight
          to the forge for precision casting.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-8 sm:mt-12 flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center"
        >
          <Button
            size="lg"
            onClick={() => navigate("/builder")}
            className="bg-primary text-primary-foreground hover:bg-ember-glow px-8 sm:px-10 py-5 sm:py-6 text-sm font-display tracking-[0.15em] animate-ember-pulse"
          >
            Start Carving
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() => navigate("/builders")}
            className="border-border text-foreground hover:bg-secondary px-6 sm:px-8 py-5 sm:py-6 text-sm font-body"
          >
            Explore Builders
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
