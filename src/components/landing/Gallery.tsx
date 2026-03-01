import { motion } from "framer-motion";

const RINGS = [
  { name: "Classic Dome", metal: "Gold", img: "🥇" },
  { name: "Flat Edge", metal: "Titanium", img: "⬜" },
  { name: "Comfort Grooved", metal: "Silver", img: "💍" },
  { name: "Knife Edge", metal: "Rose Gold", img: "🔶" },
];

export default function Gallery() {
  return (
    <section className="py-24 px-6 bg-forge-dark">
      <div className="max-w-5xl mx-auto">
        <motion.h2
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="font-display text-3xl md:text-4xl text-center mb-4"
        >
          Gallery
        </motion.h2>
        <p className="text-center text-muted-foreground mb-12 font-body">
          Designs forged by our community
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {RINGS.map((ring, i) => (
            <motion.div
              key={ring.name}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="bg-card border border-border rounded-lg p-6 text-center hover:border-primary/40 transition-colors group"
            >
              <div className="text-4xl mb-3 group-hover:animate-float">{ring.img}</div>
              <h4 className="font-display text-sm mb-1">{ring.name}</h4>
              <p className="text-xs text-muted-foreground">{ring.metal}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
