import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Flame, Lock } from "lucide-react";

const BUILDERS = [
  {
    id: "wax-ring",
    name: "Wax Ring Builder",
    description: "Sculpt a custom ring in digital wax, preview in metal, send to the forge.",
    icon: "💍",
    available: true,
    path: "/builder",
  },
  {
    id: "pendant",
    name: "Pendant Builder",
    description: "Design custom pendants with intricate detail work.",
    icon: "📿",
    available: false,
  },
  {
    id: "signet",
    name: "Signet Builder",
    description: "Create personalized signet rings with engraved faces.",
    icon: "🛡️",
    available: false,
  },
  {
    id: "coin",
    name: "Coin Builder",
    description: "Design commemorative coins and medallions.",
    icon: "🪙",
    available: false,
  },
];

export default function Builders() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background px-4 sm:px-6 py-10 sm:py-16">
      <div className="max-w-4xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-display text-2xl sm:text-3xl md:text-4xl mb-2">Builders</h1>
          <p className="text-muted-foreground text-sm mb-8 sm:mb-12">
            Choose a builder to start creating. More coming soon.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {BUILDERS.map((b, i) => (
            <motion.button
              key={b.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              disabled={!b.available}
              onClick={() => b.path && navigate(b.path)}
              className={`text-left p-5 sm:p-6 rounded-xl border transition-all group ${
                b.available
                  ? "border-border bg-card hover:border-primary/40 hover:bg-card/80 cursor-pointer"
                  : "border-border/50 bg-card/30 opacity-50 cursor-not-allowed"
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <span className="text-2xl sm:text-3xl">{b.icon}</span>
                {!b.available && <Lock className="w-4 h-4 text-muted-foreground" />}
                {b.available && (
                  <Flame className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </div>
              <h3 className="font-display text-base sm:text-lg mb-1">{b.name}</h3>
              <p className="text-xs text-muted-foreground">{b.description}</p>
              {!b.available && (
                <span className="inline-block mt-3 text-[10px] uppercase tracking-wider text-muted-foreground/60">
                  Coming Soon
                </span>
              )}
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
