import { motion } from "framer-motion";
import SEOHead from "@/components/SEOHead";

const FAQ = [
  { q: "How do I start a new ring?", a: "Go to Builders → Wax Ring Builder and use the tools on the left to sculpt." },
  { q: "Can I preview my ring in metal?", a: "Yes — toggle between Wax and Cast views in the top bar." },
  { q: "How do I export my design?", a: "Click 'Send to GalaxiForge' in the top bar to generate a design package." },
  { q: "Are more builders coming?", a: "Yes — pendant, signet, and coin builders are planned for future updates." },
];

export default function Help() {
  return (
    <div className="min-h-screen bg-background px-4 sm:px-6 py-10 sm:py-16">
      <SEOHead title="Help & FAQ" description="Learn how to use ForgeLab — design rings, preview metals, export for casting, and more." />
      <div className="max-w-2xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-display text-2xl sm:text-3xl md:text-4xl mb-2">Help</h1>
          <p className="text-muted-foreground text-sm mb-8 sm:mb-12">
            Frequently asked questions and guides.
          </p>
        </motion.div>

        <div className="space-y-3 sm:space-y-4">
          {FAQ.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="p-4 rounded-lg border border-border bg-card"
            >
              <h3 className="font-display text-sm mb-1">{item.q}</h3>
              <p className="text-xs text-muted-foreground">{item.a}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
