import { motion } from "framer-motion";

const STEPS = [
  { num: "01", title: "Carve the Wax", desc: "Shape your ring using intuitive digital sculpting tools." },
  { num: "02", title: "Preview in Metal", desc: "Toggle between wax and cast views with real metal presets." },
  { num: "03", title: "Choose Your Finish", desc: "Select from polished, brushed, hammered, matte, and more." },
  { num: "04", title: "Send to the Forge", desc: "Submit your design to GalaxiForge for precision casting." },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 px-6 bg-background">
      <div className="max-w-5xl mx-auto">
        <motion.h2
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="font-display text-3xl md:text-4xl text-center mb-16"
        >
          From <span className="text-wax-green">Wax</span> to{" "}
          <span className="text-primary">Forge</span>
        </motion.h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.num}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
              className="relative text-center"
            >
              <div className="text-5xl font-display text-primary/20 mb-3">{step.num}</div>
              <h3 className="font-display text-lg mb-2">{step.title}</h3>
              <p className="text-sm text-muted-foreground font-body">{step.desc}</p>
              {i < STEPS.length - 1 && (
                <div className="hidden md:block absolute top-8 -right-4 w-8 text-border text-2xl">→</div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
