import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useMemo, Suspense } from "react";
import { TEMPLATE_REGISTRY, TEMPLATE_CATEGORIES, TemplateMeta, TemplateCategory } from "@/config/templates";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, ArrowRight, Star, Layers, X, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import { useRef } from "react";

// ── Tiny 3D ring preview for each card ──────────────────────

function MiniRingMesh({ template }: { template: TemplateMeta }) {
  const groupRef = useRef<THREE.Group>(null);

  const geo = useMemo(() => {
    const p = template.params;
    const innerR = p.innerDiameter / 2 / 10;
    const outerR = innerR + p.thickness / 10;
    const width = p.width / 10;
    const steps = 48;
    const points: THREE.Vector2[] = [];

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const y = (t - 0.5) * width;
      let r: number;
      if (p.profile === "dome" || p.profile === "comfort") {
        const angle = t * Math.PI;
        r = innerR + (outerR - innerR) * (0.5 + 0.5 * Math.sin(angle));
      } else if (p.profile === "knife-edge") {
        const angle = t * Math.PI;
        r = innerR + (outerR - innerR) * Math.pow(Math.sin(angle), 0.5);
      } else {
        const edgeDist = Math.min(t, 1 - t);
        const bevelT = Math.min(1, edgeDist / (p.bevelSize / (p.width || 6) + 0.01));
        r = innerR + (outerR - innerR) * Math.min(1, bevelT);
      }
      points.push(new THREE.Vector2(r, y));
    }

    const g = new THREE.LatheGeometry(points, 64);
    g.computeVertexNormals();
    return g;
  }, [template]);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y = clock.getElapsedTime() * 0.3;
    groupRef.current.rotation.x = Math.PI * 0.2;
  });

  const metalColors: Record<string, string> = {
    silver: "#C0C0C0",
    gold: "#C8A83E",
    "rose-gold": "#B76E79",
    titanium: "#8A8D8F",
    tungsten: "#5A5A5A",
  };
  const color = metalColors[template.metalPreset || "silver"] || "#C0C0C0";

  return (
    <group ref={groupRef}>
      <mesh geometry={geo} castShadow>
        <meshPhysicalMaterial
          color={color}
          roughness={0.2}
          metalness={1.0}
          envMapIntensity={2.5}
          clearcoat={0.15}
        />
      </mesh>
    </group>
  );
}

function MiniRingScene({ template }: { template: TemplateMeta }) {
  return (
    <Canvas
      camera={{ position: [0, 0.8, 1.8], fov: 32 }}
      gl={{ antialias: true, alpha: true }}
      dpr={[1, 1.5]}
      className="!absolute inset-0"
    >
      <ambientLight intensity={0.15} />
      <directionalLight position={[3, 4, 3]} intensity={2} color="#fff5e6" />
      <pointLight position={[-2, 1, -2]} intensity={0.5} color="#ffa040" />
      <Suspense fallback={null}>
        <MiniRingMesh template={template} />
        <ContactShadows position={[0, -0.5, 0]} opacity={0.25} scale={3} blur={2} far={3} />
        <Environment preset="city" />
      </Suspense>
    </Canvas>
  );
}

// ── Template Card ────────────────────────────────────────────

function TemplateCard({
  template,
  index,
  onSelect,
}: {
  template: TemplateMeta;
  index: number;
  onSelect: (t: TemplateMeta) => void;
}) {
  const difficultyColors = {
    beginner: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
    intermediate: "text-amber-400 bg-amber-400/10 border-amber-400/20",
    advanced: "text-red-400 bg-red-400/10 border-red-400/20",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      className="group relative rounded-2xl border border-border bg-card overflow-hidden hover:border-primary/40 hover:shadow-[0_0_20px_hsl(var(--primary)/0.1)] transition-all duration-300 cursor-pointer"
      onClick={() => onSelect(template)}
    >
      {/* 3D Preview */}
      <div className="relative h-40 bg-gradient-to-b from-secondary/30 to-card overflow-hidden">
        <MiniRingScene template={template} />
        {/* Popularity badge */}
        {template.popularity && template.popularity >= 85 && (
          <div className="absolute top-2 left-2 flex items-center gap-1 bg-primary/20 backdrop-blur-sm border border-primary/30 rounded-full px-2 py-0.5">
            <Star className="w-2.5 h-2.5 text-primary fill-primary" />
            <span className="text-[9px] text-primary font-medium">Popular</span>
          </div>
        )}
        {/* Category badge */}
        <div className="absolute top-2 right-2">
          <span className="text-[9px] uppercase tracking-wider bg-card/70 backdrop-blur-sm border border-border/50 rounded-full px-2 py-0.5 text-muted-foreground">
            {template.category}
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="p-3.5 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-display text-sm tracking-wide text-foreground group-hover:text-primary transition-colors leading-tight">
              {template.icon} {template.name}
            </h3>
            <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed line-clamp-2">
              {template.description}
            </p>
          </div>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1">
          {(template.tags || []).slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="text-[8px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground/70"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Footer — specs */}
        <div className="flex items-center justify-between pt-1 border-t border-border/30">
          <div className="flex items-center gap-2 text-[9px] text-muted-foreground/60">
            <span>{template.params.width}mm × {template.params.thickness}mm</span>
            <span>·</span>
            <span className="capitalize">{template.params.profile}</span>
          </div>
          {template.difficulty && (
            <span className={cn("text-[8px] px-1.5 py-0.5 rounded-full border", difficultyColors[template.difficulty])}>
              {template.difficulty}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── Detail Modal ──────────────────────────────────────────────

function TemplateDetail({
  template,
  onClose,
  onUse,
}: {
  template: TemplateMeta;
  onClose: () => void;
  onUse: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 30, scale: 0.95 }}
        transition={{ duration: 0.25 }}
        className="relative w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* 3D Preview */}
        <div className="relative h-56 bg-gradient-to-b from-secondary/40 to-card">
          <MiniRingScene template={template} />
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 rounded-full bg-card/80 backdrop-blur-sm border border-border/50 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <div>
            <h2 className="font-display text-lg tracking-wide text-foreground">
              {template.icon} {template.name}
            </h2>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              {template.description}
            </p>
          </div>

          {template.lore && (
            <p className="text-[11px] text-muted-foreground/70 italic leading-relaxed border-l-2 border-primary/20 pl-3">
              "{template.lore}"
            </p>
          )}

          {/* Specs grid */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Profile", value: template.params.profile },
              { label: "Width", value: `${template.params.width}mm` },
              { label: "Thickness", value: `${template.params.thickness}mm` },
              { label: "Grooves", value: String(template.params.grooveCount) },
              ...(template.metalPreset ? [{ label: "Metal", value: template.metalPreset }] : []),
              ...(template.finishPreset ? [{ label: "Finish", value: template.finishPreset }] : []),
              ...(template.lunar?.enabled ? [{ label: "Surface", value: "Lunar texture" }] : []),
              ...(template.difficulty ? [{ label: "Complexity", value: template.difficulty }] : []),
            ].map((spec) => (
              <div key={spec.label} className="bg-secondary/30 rounded-lg px-3 py-2">
                <p className="text-[8px] uppercase tracking-wider text-muted-foreground/50">{spec.label}</p>
                <p className="text-xs text-foreground capitalize mt-0.5">{spec.value}</p>
              </div>
            ))}
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-1">
            {(template.tags || []).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-[9px] px-2 py-0.5">
                {tag}
              </Badge>
            ))}
          </div>

          {/* CTA */}
          <Button size="lg" className="w-full gap-2" onClick={onUse}>
            <Layers className="w-4 h-4" />
            Use This Template
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Main Page ─────────────────────────────────────────────────

export default function Templates() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<TemplateCategory | "all">("all");
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateMeta | null>(null);

  const filtered = useMemo(() => {
    let result = [...TEMPLATE_REGISTRY];

    if (activeCategory !== "all") {
      result = result.filter((t) => t.category === activeCategory);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          (t.tags || []).some((tag) => tag.includes(q)) ||
          t.category.includes(q)
      );
    }

    // Sort by popularity (descending)
    result.sort((a, b) => (b.popularity || 50) - (a.popularity || 50));

    return result;
  }, [activeCategory, search]);

  const useTemplate = (template: TemplateMeta) => {
    sessionStorage.setItem("applyTemplate", template.id);
    navigate("/builder");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero header */}
      <div className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.03] via-transparent to-transparent" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-10 sm:pt-16 pb-6 sm:pb-8 relative">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <p className="text-[10px] uppercase tracking-[0.3em] text-primary/60 mb-3 font-display">
              Template Marketplace
            </p>
            <h1 className="font-display text-2xl sm:text-3xl md:text-4xl text-foreground mb-2">
              Browse Ring Templates
            </h1>
            <p className="text-muted-foreground text-sm max-w-lg leading-relaxed">
              Explore curated ring designs — from lunar crater surfaces to minimal wedding bands. 
              Pick a template and customize it in the builder.
            </p>
          </motion.div>

          {/* Search bar */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mt-5 sm:mt-6 max-w-md"
          >
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search templates... (e.g. lunar, hammered, minimal)"
                className="w-full bg-secondary/50 border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
              />
            </div>
          </motion.div>
        </div>
      </div>

      {/* Category pills */}
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex gap-2 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveCategory("all")}
            className={cn(
              "shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all border",
              activeCategory === "all"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-secondary/50 text-muted-foreground border-border/50 hover:text-foreground hover:border-border"
            )}
          >
            <SlidersHorizontal className="w-3 h-3 inline mr-1 -mt-0.5" />
            All ({TEMPLATE_REGISTRY.length})
          </button>
          {TEMPLATE_CATEGORIES.map((cat) => {
            const count = TEMPLATE_REGISTRY.filter((t) => t.category === cat.id).length;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={cn(
                  "shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all border",
                  activeCategory === cat.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-secondary/50 text-muted-foreground border-border/50 hover:text-foreground hover:border-border"
                )}
              >
                {cat.icon} {cat.label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground text-sm">No templates match your search.</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => {
                setSearch("");
                setActiveCategory("all");
              }}
            >
              Clear filters
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((t, i) => (
              <TemplateCard
                key={t.id}
                template={t}
                index={i}
                onSelect={setSelectedTemplate}
              />
            ))}
          </div>
        )}
      </div>

      {/* Detail modal */}
      <AnimatePresence>
        {selectedTemplate && (
          <TemplateDetail
            template={selectedTemplate}
            onClose={() => setSelectedTemplate(null)}
            onUse={() => useTemplate(selectedTemplate)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
