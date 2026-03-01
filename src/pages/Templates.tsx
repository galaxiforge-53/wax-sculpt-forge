import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { TEMPLATE_REGISTRY } from "@/config/templates";

export default function Templates() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background px-6 py-16">
      <div className="max-w-4xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-display text-3xl md:text-4xl mb-2">Templates</h1>
          <p className="text-muted-foreground text-sm mb-12">
            Start with a preset and customize from there.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {TEMPLATE_REGISTRY.map((t, i) => (
            <motion.button
              key={t.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              onClick={() => {
                sessionStorage.setItem("applyTemplate", t.id);
                navigate("/builder");
              }}
              className="text-left p-5 rounded-xl border border-border bg-card hover:border-primary/40 transition-all group"
            >
              <span className="text-2xl mb-2 block">{t.icon}</span>
              <h3 className="font-display text-sm mb-1 group-hover:text-primary transition-colors">{t.name}</h3>
              <p className="text-[10px] text-muted-foreground leading-relaxed">{t.description}</p>
              <div className="mt-2 text-[9px] text-muted-foreground/60 uppercase tracking-wider">
                {t.category}
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
