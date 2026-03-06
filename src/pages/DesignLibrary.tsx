import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { OrbitControls, Environment, ContactShadows } from "@react-three/drei";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import * as THREE from "three";
import { useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Flame, ChevronRight, Download, Sparkles, Eye, ArrowRight } from "lucide-react";

// ── STL Design Definitions ───────────────────────────────────────

export interface STLDesign {
  id: string;
  name: string;
  tagline: string;
  lore: string;
  stlFile: string;
  category: "band" | "statement" | "wedding" | "signet" | "avant-garde";
  width: string;
  defaultMetal: string;
  features: string[];
  engraving?: string;
  rotation?: [number, number, number]; // initial rotation offset
  scale?: number;
}

export const STL_DESIGNS: STLDesign[] = [
  {
    id: "obsidian-oath",
    name: "Obsidian Oath",
    tagline: "Forged in Volcanic Fire",
    lore: "A broad 10mm band carved from digital obsidian — the surface carries the memory of tectonic pressure, volcanic heat, and the slow passage of geological time. This is not jewelry. This is earth, frozen in metal.",
    stlFile: "/models/Ring_10_mm.stl",
    category: "statement",
    width: "10mm",
    defaultMetal: "Tungsten",
    features: ["Extra-wide 10mm band", "Investment cast ready", "Comfort fit interior", "Lifetime structural integrity"],
    engraving: "OBSIDIAN · OATH",
    scale: 1.0,
  },
  {
    id: "fenrir-band",
    name: "Fenrir Band",
    tagline: "The Wolf Unchained",
    lore: "Named for the great wolf of Norse legend, this 8mm band channels primal energy through precision-machined geometry. Every edge is intentional — a controlled wildness that speaks to those who refuse to be tamed.",
    stlFile: "/models/Ring_8_mm-2.stl",
    category: "band",
    width: "8mm",
    defaultMetal: "Gold",
    features: ["8mm comfort width", "Organic surface texture", "Precision-cast geometry", "Wax-print optimised"],
    engraving: "FENRIR · UNBOUND",
  },
  {
    id: "eclipse-signet",
    name: "Eclipse Signet",
    tagline: "When Light Meets Shadow",
    lore: "The third evolution of our 8mm platform — refined, darkened, mysterious. Like a solar eclipse, this band commands attention through contrast. The polished interior catches light that the textured exterior absorbs.",
    stlFile: "/models/Ring_8_mm-3.stl",
    category: "signet",
    width: "8mm",
    defaultMetal: "Titanium",
    features: ["Matte-polish contrast", "Architectural profile", "Precision bore", "Exhibition-grade finish"],
    engraving: "ECLIPSE · MMXXVI",
  },
  {
    id: "nebula-core",
    name: "Nebula Core",
    tagline: "Collapsed Star, Infinite Density",
    lore: "Built on the original 8mm architecture, reinterpreted as a neutron star — impossibly dense, radiating energy from within. Rose gold amplifies the warm stellar glow that seems to pulse from the metal itself.",
    stlFile: "/models/Ring_8_mm.stl",
    category: "wedding",
    width: "8mm",
    defaultMetal: "Rose Gold",
    features: ["Classic 8mm foundation", "Stellar-grade polish", "Romantic profile", "Ceremony ready"],
    engraving: "FOREVER · YOURS",
  },
  {
    id: "titan-monolith",
    name: "Titan Monolith",
    tagline: "Architecture for the Hand",
    lore: "The 10mm statement piece reimagined as brutalist architecture — think concrete towers, monolithic sculptures, the weight of permanence. Tungsten's natural darkness completes the vision. This ring doesn't whisper. It announces.",
    stlFile: "/models/Ring_10_mm.stl",
    category: "avant-garde",
    width: "10mm",
    defaultMetal: "Tungsten",
    features: ["Brutalist aesthetic", "Maximum visual impact", "10mm presence", "Gallery-worthy design"],
    engraving: "MONOLITH",
    scale: 1.0,
  },
  {
    id: "valkyrie-slim",
    name: "Valkyrie Slim",
    tagline: "Grace Under Pressure",
    lore: "An 8mm band with the soul of a warrior and the elegance of silver moonlight. Named for the choosers of the slain, this design walks the line between delicate and deadly — a ring for those who carry quiet strength.",
    stlFile: "/models/Ring_8_mm-3.stl",
    category: "band",
    width: "8mm",
    defaultMetal: "Silver",
    features: ["Refined 8mm profile", "Mirror-finish capable", "Everyday wearability", "Unisex design"],
    engraving: "VALKYRIE",
  },
  {
    id: "ember-eternal",
    name: "Ember Eternal",
    tagline: "The Last Fire Still Burns",
    lore: "Our original 8mm design, perfected. Like the final ember in a dying fire — small, intense, impossibly hot. Gold captures the warmth that lives at the heart of every forge. This is where ForgeLab began.",
    stlFile: "/models/Ring_8_mm-2.stl",
    category: "wedding",
    width: "8mm",
    defaultMetal: "Gold",
    features: ["Signature ForgeLab design", "Wedding-grade finish", "Timeless proportions", "Legacy piece"],
    engraving: "GALAXIFORGE · EHAND3D",
  },
  {
    id: "void-channel",
    name: "Void Channel",
    tagline: "Between Dimensions",
    lore: "The 10mm platform pushed to its conceptual limit — a ring that feels like it contains a black hole. The titanium finish absorbs light while the interior mirror-polish reflects infinity. Wear the void.",
    stlFile: "/models/Ring_10_mm.stl",
    category: "avant-garde",
    width: "10mm",
    defaultMetal: "Titanium",
    features: ["Light-absorbing exterior", "Mirror interior contrast", "Dimensional presence", "Conversation piece"],
    engraving: "V · O · I · D",
    scale: 1.0,
  },
  {
    id: "crown-heritage",
    name: "Crown Heritage",
    tagline: "Born to Rule",
    lore: "A regal interpretation of the 8mm architecture — this isn't a ring, it's a coronation. Rose gold whispers of royal lineage while the precision geometry speaks to modern mastery. For those who inherit their own legacy.",
    stlFile: "/models/Ring_8_mm.stl",
    category: "signet",
    width: "8mm",
    defaultMetal: "Rose Gold",
    features: ["Royal proportions", "Heirloom quality", "Engraved heritage mark", "Dynasty-worthy"],
    engraving: "CROWN · HERITAGE",
  },
  {
    id: "arctic-zero",
    name: "Arctic Zero",
    tagline: "Absolute Stillness",
    lore: "Silver at absolute zero — frozen, crystalline, perfect. This 8mm band captures the moment before motion, the silence before sound. Inspired by polar ice shelves and the terrifying beauty of total stillness.",
    stlFile: "/models/Ring_8_mm-3.stl",
    category: "band",
    width: "8mm",
    defaultMetal: "Silver",
    features: ["Cryo-polish finish", "Zero-defect casting", "Minimalist perfection", "Ice-cold elegance"],
    engraving: "ZERO · KELVIN",
  },
];

// ── Metal presets ────────────────────────────────────────────────

interface MetalPreset {
  id: string;
  label: string;
  color: string;
  roughness: number;
  metalness: number;
  envIntensity: number;
}

const METALS: MetalPreset[] = [
  { id: "Gold", label: "Gold", color: "#D4A520", roughness: 0.08, metalness: 1.0, envIntensity: 3.5 },
  { id: "Silver", label: "Silver", color: "#C8C8C8", roughness: 0.1, metalness: 1.0, envIntensity: 3.0 },
  { id: "Rose Gold", label: "Rose Gold", color: "#C6897B", roughness: 0.1, metalness: 1.0, envIntensity: 2.8 },
  { id: "Titanium", label: "Titanium", color: "#8A8A85", roughness: 0.22, metalness: 0.92, envIntensity: 2.2 },
  { id: "Tungsten", label: "Tungsten", color: "#4A4A4A", roughness: 0.06, metalness: 1.0, envIntensity: 2.4 },
];

// ── STL Ring Mesh ────────────────────────────────────────────────

function LibraryRingMesh({ stlFile, metal, designScale }: { stlFile: string; metal: MetalPreset; designScale?: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const geometry = useLoader(STLLoader, stlFile);

  const processedGeo = useMemo(() => {
    const geo = geometry.clone();
    geo.computeVertexNormals();
    geo.computeBoundingBox();
    const box = geo.boundingBox!;
    const center = new THREE.Vector3();
    box.getCenter(center);
    geo.translate(-center.x, -center.y, -center.z);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = (designScale ?? 2.0) / maxDim;
    geo.scale(scale, scale, scale);
    return geo;
  }, [geometry, designScale]);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.getElapsedTime();
    groupRef.current.rotation.y = t * 0.25;
    groupRef.current.rotation.x = Math.sin(t * 0.15) * 0.08;
  });

  return (
    <group ref={groupRef}>
      <mesh geometry={processedGeo} castShadow receiveShadow>
        <meshPhysicalMaterial
          color={metal.color}
          roughness={metal.roughness}
          metalness={metal.metalness}
          envMapIntensity={metal.envIntensity}
          clearcoat={0.35}
          clearcoatRoughness={0.1}
          reflectivity={1.0}
          ior={2.5}
          sheen={0.06}
          sheenColor={metal.color}
        />
      </mesh>
    </group>
  );
}

function LibraryScene({ stlFile, metal, designScale }: { stlFile: string; metal: MetalPreset; designScale?: number }) {
  return (
    <>
      <ambientLight intensity={0.1} />
      <directionalLight position={[5, 8, 5]} intensity={2.5} color="#fff5e6" castShadow />
      <directionalLight position={[-4, 3, -3]} intensity={0.5} color="#c8d8f0" />
      <spotLight position={[0, 0, 5]} intensity={1.2} angle={0.5} penumbra={0.8} />
      <pointLight position={[-3, -1, -3]} intensity={0.5} color="#ffa040" />
      <pointLight position={[0, 4, 0]} intensity={0.6} color="#ffecd2" />
      <LibraryRingMesh stlFile={stlFile} metal={metal} designScale={designScale} />
      <ContactShadows position={[0, -1.1, 0]} opacity={0.4} scale={5} blur={2.5} far={4} />
      <Environment preset="city" />
      <OrbitControls enablePan={false} enableZoom={true} autoRotate autoRotateSpeed={0.6} minDistance={1.8} maxDistance={6} />
    </>
  );
}

// ── Category badge colors ────────────────────────────────────────

const CATEGORY_STYLES: Record<string, string> = {
  band: "bg-primary/10 text-primary border-primary/20",
  statement: "bg-accent/10 text-accent border-accent/20",
  wedding: "bg-pink-500/10 text-pink-400 border-pink-500/20",
  signet: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  "avant-garde": "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
};

// ── Design Card ──────────────────────────────────────────────────

function DesignCard({ design, index, onSelect }: { design: STLDesign; index: number; onSelect: (d: STLDesign) => void }) {
  const metal = METALS.find((m) => m.id === design.defaultMetal) ?? METALS[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.05 }}
      className="group relative rounded-2xl border border-border bg-card overflow-hidden hover:border-primary/40 transition-all cursor-pointer"
      onClick={() => onSelect(design)}
    >
      {/* 3D Preview */}
      <div className="aspect-square relative bg-gradient-to-br from-forge-dark to-card">
        <Canvas
          camera={{ position: [0, 1.2, 3.0], fov: 34 }}
          gl={{ antialias: true, alpha: true }}
          dpr={[1, 1.5]}
        >
          <LibraryScene stlFile={design.stlFile} metal={metal} designScale={design.scale} />
        </Canvas>

        {/* Category badge */}
        <div className="absolute top-3 left-3">
          <Badge variant="outline" className={`text-[9px] ${CATEGORY_STYLES[design.category] ?? ""}`}>
            {design.category}
          </Badge>
        </div>

        {/* Width badge */}
        <div className="absolute top-3 right-3">
          <Badge variant="outline" className="text-[9px] bg-card/60 backdrop-blur-sm border-border/50 text-muted-foreground">
            {design.width}
          </Badge>
        </div>

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-4">
          <span className="text-[10px] text-primary flex items-center gap-1">
            <Eye className="w-3 h-3" /> View Details
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="p-4 space-y-1.5">
        <h3 className="font-display text-sm text-foreground group-hover:text-primary transition-colors">{design.name}</h3>
        <p className="text-[10px] text-primary/70 tracking-wide">{design.tagline}</p>
        <p className="text-[10px] text-muted-foreground line-clamp-2 leading-relaxed">{design.lore.slice(0, 100)}...</p>
        <div className="flex items-center gap-2 pt-1">
          <div className="w-3 h-3 rounded-full border border-border/50" style={{ backgroundColor: metal.color }} />
          <span className="text-[9px] text-muted-foreground">{metal.label}</span>
        </div>
      </div>
    </motion.div>
  );
}

// ── Design Detail Modal ──────────────────────────────────────────

function DesignDetail({ design, onClose }: { design: STLDesign; onClose: () => void }) {
  const navigate = useNavigate();
  const [metalIdx, setMetalIdx] = useState(METALS.findIndex((m) => m.id === design.defaultMetal));
  const metal = METALS[metalIdx >= 0 ? metalIdx : 0];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-background/90 backdrop-blur-md flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-card border border-border rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2">
          {/* 3D Viewport */}
          <div className="aspect-square relative bg-gradient-to-br from-forge-dark to-card rounded-t-2xl lg:rounded-l-2xl lg:rounded-tr-none overflow-hidden">
            <Canvas
              camera={{ position: [0, 1.0, 3.2], fov: 32 }}
              gl={{ antialias: true, alpha: true }}
              dpr={[1, 2]}
            >
              <LibraryScene stlFile={design.stlFile} metal={metal} designScale={design.scale} />
            </Canvas>

            {/* Metal cycle */}
            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
              <div className="flex gap-1.5">
                {METALS.map((m, i) => (
                  <button
                    key={m.id}
                    onClick={() => setMetalIdx(i)}
                    className={`w-6 h-6 rounded-full border-2 transition-all hover:scale-110 ${
                      metalIdx === i ? "border-primary shadow-[0_0_8px_hsl(25_95%_53%/0.4)] scale-110" : "border-border/50"
                    }`}
                    style={{ backgroundColor: m.color }}
                    title={m.label}
                  />
                ))}
              </div>
              <span className="text-[10px] text-muted-foreground bg-card/60 backdrop-blur-sm px-2 py-1 rounded-md">
                {metal.label}
              </span>
            </div>
          </div>

          {/* Details */}
          <div className="p-6 sm:p-8 flex flex-col gap-5">
            <div>
              <Badge variant="outline" className={`text-[9px] mb-3 ${CATEGORY_STYLES[design.category] ?? ""}`}>
                {design.category}
              </Badge>
              <h2 className="font-display text-2xl sm:text-3xl text-foreground">{design.name}</h2>
              <p className="text-xs text-primary/80 mt-1 tracking-wide">{design.tagline}</p>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed font-body">{design.lore}</p>

            {/* Features */}
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/70">Features</p>
              <ul className="space-y-1.5">
                {design.features.map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs text-foreground">
                    <Sparkles className="w-3 h-3 text-primary flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            {/* Specs */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Width", value: design.width },
                { label: "Metal", value: metal.label },
                { label: "Castable", value: "✓ Yes" },
              ].map((s) => (
                <div key={s.label} className="p-2.5 rounded-lg bg-secondary/50 border border-border/50">
                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground/70 mb-0.5">{s.label}</p>
                  <p className="text-xs font-medium text-foreground">{s.value}</p>
                </div>
              ))}
            </div>

            {/* Engraving */}
            {design.engraving && (
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/70">✒️ Default Engraving</p>
                <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-[11px] font-mono tracking-wider border border-primary/20 bg-primary/5 text-primary/90">
                  {design.engraving}
                </span>
              </div>
            )}

            {/* CTAs */}
            <div className="flex gap-3 pt-2 mt-auto">
              <Button
                onClick={() => navigate("/builder")}
                className="bg-primary text-primary-foreground hover:bg-ember-glow flex-1 font-display tracking-wider text-xs gap-2"
              >
                <Flame className="w-3.5 h-3.5" /> Customize This Ring
              </Button>
              <Button
                variant="outline"
                onClick={onClose}
                className="border-border text-muted-foreground text-xs"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Main Library Page ────────────────────────────────────────────

export default function DesignLibrary() {
  const navigate = useNavigate();
  const [selectedDesign, setSelectedDesign] = useState<STLDesign | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("all");

  const categories = ["all", "band", "statement", "wedding", "signet", "avant-garde"];
  const filtered = filterCategory === "all" ? STL_DESIGNS : STL_DESIGNS.filter((d) => d.category === filterCategory);

  return (
    <div className="min-h-screen bg-background pt-20 pb-16">
      {/* Hero header */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 mb-10 sm:mb-14">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <p className="text-[10px] uppercase tracking-[0.3em] text-primary/70 mb-3 font-body">
            ForgeLab · STL Collection
          </p>
          <h1 className="font-display text-3xl sm:text-4xl md:text-5xl mb-4">
            The <span className="text-primary">Forge</span> Library
          </h1>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto font-body leading-relaxed">
            Hand-crafted ring designs ready for customisation. Every model is investment-cast ready,
            precision-engineered, and waiting for your personal touch.
          </p>
        </motion.div>

        {/* Category filters */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex flex-wrap justify-center gap-2 mt-8"
        >
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-4 py-2 rounded-lg text-xs font-medium border transition-all capitalize ${
                filterCategory === cat
                  ? "bg-primary/10 border-primary/40 text-primary"
                  : "bg-card border-border text-muted-foreground hover:border-border hover:text-foreground"
              }`}
            >
              {cat === "all" ? `All (${STL_DESIGNS.length})` : cat}
            </button>
          ))}
        </motion.div>
      </div>

      {/* Design grid */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
          {filtered.map((design, i) => (
            <DesignCard key={design.id} design={design} index={i} onSelect={setSelectedDesign} />
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16">
            <p className="text-muted-foreground text-sm">No designs in this category yet</p>
          </div>
        )}
      </div>

      {/* Bottom CTA */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-14">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center p-8 rounded-2xl border border-border bg-card/50"
        >
          <h3 className="font-display text-lg sm:text-xl mb-2 text-foreground">
            Can't find what you're looking for?
          </h3>
          <p className="text-sm text-muted-foreground mb-5">
            Build your own from scratch in the ForgeLab builder — full creative control.
          </p>
          <Button
            onClick={() => navigate("/builder")}
            className="bg-primary text-primary-foreground hover:bg-ember-glow font-display tracking-wider text-xs gap-2"
          >
            <Flame className="w-3.5 h-3.5" /> Start From Scratch <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </motion.div>
      </div>

      {/* Detail modal */}
      <AnimatePresence>
        {selectedDesign && (
          <DesignDetail design={selectedDesign} onClose={() => setSelectedDesign(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
