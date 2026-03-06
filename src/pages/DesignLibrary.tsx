import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { OrbitControls, Environment, ContactShadows } from "@react-three/drei";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import * as THREE from "three";
import { useMemo, useRef, useState, useCallback, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Flame, Sparkles, Eye, ArrowRight, Upload, Search, X } from "lucide-react";

// ── Design type — supports both STL and procedural ───────────────

type DesignSource = { type: "stl"; stlFile: string; scale?: number } | { type: "procedural"; profile: ProceduralProfile };

type ProceduralProfile = {
  outerR: number;
  innerR: number;
  widthMm: number;
  shape: "dome" | "flat" | "knife" | "comfort" | "stepped" | "channel" | "faceted" | "twisted" | "organic" | "concave" | "ridged" | "barrel";
  grooveCount?: number;
  grooveDepth?: number;
  bevelSize?: number;
  twistDeg?: number;
  facets?: number;
  ridgeCount?: number;
};

export type DesignCategory = "band" | "statement" | "wedding" | "signet" | "avant-garde" | "minimalist" | "textured" | "geometric" | "custom";

export interface LibraryDesign {
  id: string;
  name: string;
  tagline: string;
  lore: string;
  source: DesignSource;
  category: DesignCategory;
  width: string;
  defaultMetal: string;
  features: string[];
  engraving?: string;
  isCustomUpload?: boolean;
}

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
  { id: "Platinum", label: "Platinum", color: "#E5E4E2", roughness: 0.08, metalness: 1.0, envIntensity: 3.2 },
  { id: "Black Rhodium", label: "Black Rhodium", color: "#2A2A2A", roughness: 0.04, metalness: 1.0, envIntensity: 2.8 },
];

// ── Design Registry ──────────────────────────────────────────────

const LIBRARY_DESIGNS: LibraryDesign[] = [
  // ─── STL-based designs (your uploaded models) ───
  {
    id: "obsidian-oath",
    name: "Obsidian Oath",
    tagline: "Forged in Volcanic Fire",
    lore: "A broad 10mm band carved from digital obsidian — the surface carries the memory of tectonic pressure, volcanic heat, and the slow passage of geological time.",
    source: { type: "stl", stlFile: "/models/Ring_10_mm.stl", scale: 1.0 },
    category: "statement",
    width: "10mm",
    defaultMetal: "Tungsten",
    features: ["Extra-wide 10mm band", "Investment cast ready", "Comfort fit interior", "Lifetime structural integrity"],
    engraving: "OBSIDIAN · OATH",
  },
  {
    id: "fenrir-band",
    name: "Fenrir Band",
    tagline: "The Wolf Unchained",
    lore: "Named for the great wolf of Norse legend, this 8mm band channels primal energy through precision-machined geometry.",
    source: { type: "stl", stlFile: "/models/Ring_8_mm-2.stl" },
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
    lore: "Refined, darkened, mysterious. Like a solar eclipse, this band commands attention through contrast.",
    source: { type: "stl", stlFile: "/models/Ring_8_mm-3.stl" },
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
    lore: "Built on the original 8mm architecture. Rose gold amplifies the warm stellar glow that seems to pulse from the metal itself.",
    source: { type: "stl", stlFile: "/models/Ring_8_mm.stl" },
    category: "wedding",
    width: "8mm",
    defaultMetal: "Rose Gold",
    features: ["Classic 8mm foundation", "Stellar-grade polish", "Romantic profile", "Ceremony ready"],
    engraving: "FOREVER · YOURS",
  },

  // ─── Procedural designs ───
  {
    id: "aurora-dome",
    name: "Aurora Dome",
    tagline: "Curvature of Light",
    lore: "A perfectly rounded 6mm dome profile — the most timeless ring shape in existence. Light flows across the surface in continuous arcs, creating an ever-shifting aurora of reflections.",
    source: { type: "procedural", profile: { outerR: 10.5, innerR: 9.05, widthMm: 6, shape: "dome" } },
    category: "minimalist",
    width: "6mm",
    defaultMetal: "Gold",
    features: ["Perfect dome curvature", "6mm classic width", "Mirror-polished capable", "Universal sizing"],
    engraving: "AURORA",
  },
  {
    id: "razor-edge",
    name: "Razor Edge",
    tagline: "Precision at Its Finest",
    lore: "A knife-edge profile that tapers to a precise ridge — architectural, aggressive, unforgettable. This ring catches light like a blade catches sunlight.",
    source: { type: "procedural", profile: { outerR: 10.8, innerR: 9.05, widthMm: 5, shape: "knife", bevelSize: 0.1 } },
    category: "geometric",
    width: "5mm",
    defaultMetal: "Platinum",
    features: ["Knife-edge apex", "Architectural precision", "5mm minimal width", "Light-catching ridge"],
    engraving: "RAZOR · PRECISION",
  },
  {
    id: "triple-channel",
    name: "Triple Channel",
    tagline: "Three Rivers, One Flow",
    lore: "Three precision-cut channels run parallel around the circumference, creating a mesmerising play of shadow and depth. Each channel is a river of negative space, flowing endlessly.",
    source: { type: "procedural", profile: { outerR: 10.5, innerR: 9.05, widthMm: 8, shape: "flat", grooveCount: 3, grooveDepth: 0.4 } },
    category: "geometric",
    width: "8mm",
    defaultMetal: "Silver",
    features: ["Triple groove channels", "Flat profile base", "8mm width", "Shadow play engineering"],
    engraving: "THREE · RIVERS",
  },
  {
    id: "helix-twist",
    name: "Helix Twist",
    tagline: "DNA of Metal",
    lore: "A gentle 15° twist transforms a simple band into a living helix — inspired by the double-helix of DNA, this ring embodies the fundamental structure of life rendered in precious metal.",
    source: { type: "procedural", profile: { outerR: 10.3, innerR: 9.05, widthMm: 5, shape: "twisted", twistDeg: 15 } },
    category: "avant-garde",
    width: "5mm",
    defaultMetal: "Rose Gold",
    features: ["15° helical twist", "Organic DNA-inspired form", "Unique wrist perspective", "Conversation starter"],
    engraving: "HELIX",
  },
  {
    id: "faceted-prism",
    name: "Faceted Prism",
    tagline: "Geometry Meets Light",
    lore: "12 precisely-cut facets transform a ring into a prism — each flat surface catches light at a different angle, creating a crystalline dance of reflections that shifts with every movement.",
    source: { type: "procedural", profile: { outerR: 10.6, innerR: 9.05, widthMm: 6, shape: "faceted", facets: 12 } },
    category: "geometric",
    width: "6mm",
    defaultMetal: "Platinum",
    features: ["12 precision facets", "Crystalline light play", "Angular modern aesthetic", "Hand-cut precision"],
    engraving: "PRISM · XII",
  },
  {
    id: "cathedral-step",
    name: "Cathedral Step",
    tagline: "Ascending Architecture",
    lore: "Inspired by the stepped profiles of Gothic cathedral arches — each tier rises toward a central plateau. This ring carries the weight of architectural history on your finger.",
    source: { type: "procedural", profile: { outerR: 11.0, innerR: 9.05, widthMm: 10, shape: "stepped" } },
    category: "statement",
    width: "10mm",
    defaultMetal: "Gold",
    features: ["Stepped tier profile", "10mm statement width", "Gothic-inspired architecture", "Bold visual presence"],
    engraving: "CATHEDRAL",
  },
  {
    id: "concave-shadow",
    name: "Concave Shadow",
    tagline: "The Negative Space",
    lore: "A concave profile that curves inward, creating a valley of shadow along the ring's centre. Light pools at the edges while darkness lives at the heart. This is a ring of contrast.",
    source: { type: "procedural", profile: { outerR: 10.3, innerR: 9.05, widthMm: 7, shape: "concave" } },
    category: "minimalist",
    width: "7mm",
    defaultMetal: "Black Rhodium",
    features: ["Concave inward curve", "Shadow-pooling centre", "7mm medium width", "Contrast design philosophy"],
    engraving: "SHADOW",
  },
  {
    id: "ridge-runner",
    name: "Ridge Runner",
    tagline: "Mountain Range in Miniature",
    lore: "Five parallel ridges run the circumference like a mountain range viewed from above. Each ridge catches light independently, creating a topographic map of illumination.",
    source: { type: "procedural", profile: { outerR: 10.5, innerR: 9.05, widthMm: 8, shape: "ridged", ridgeCount: 5 } },
    category: "textured",
    width: "8mm",
    defaultMetal: "Tungsten",
    features: ["5 parallel ridges", "Topographic texture", "8mm textured width", "Mountain-range silhouette"],
    engraving: "RIDGE · RUNNER",
  },
  {
    id: "barrel-whiskey",
    name: "Barrel Band",
    tagline: "Aged to Perfection",
    lore: "A barrel profile — wider at center, tapering toward the edges — like a whiskey cask viewed in cross-section. This ring celebrates the patience of craft, the beauty of waiting.",
    source: { type: "procedural", profile: { outerR: 10.8, innerR: 9.05, widthMm: 8, shape: "barrel" } },
    category: "band",
    width: "8mm",
    defaultMetal: "Gold",
    features: ["Barrel-curved profile", "Tapered edges", "Comfort ergonomics", "Artisan craft aesthetic"],
    engraving: "BARREL · AGED",
  },
  {
    id: "organic-wave",
    name: "Organic Wave",
    tagline: "Nature's Algorithm",
    lore: "An organic, flowing edge profile where the ring's outer surface undulates like a wave frozen in metal. No two viewing angles are the same — nature's mathematical beauty, cast in precious metal.",
    source: { type: "procedural", profile: { outerR: 10.4, innerR: 9.05, widthMm: 6, shape: "organic" } },
    category: "avant-garde",
    width: "6mm",
    defaultMetal: "Rose Gold",
    features: ["Organic flowing edges", "Wave-form silhouette", "Nature-inspired geometry", "Unique from every angle"],
    engraving: "WAVE · FORM",
  },
  {
    id: "wide-flat-statement",
    name: "Monolith Slab",
    tagline: "Brutalist Purity",
    lore: "A 12mm flat band with razor-sharp edges and zero ornamentation. This is brutalism for the hand — an architectural statement that refuses to apologise for its presence.",
    source: { type: "procedural", profile: { outerR: 10.5, innerR: 9.05, widthMm: 12, shape: "flat", bevelSize: 0.05 } },
    category: "statement",
    width: "12mm",
    defaultMetal: "Tungsten",
    features: ["12mm extreme width", "Flat brutalist profile", "Minimal bevel edges", "Maximum visual impact"],
    engraving: "MONOLITH",
  },
  {
    id: "slim-comfort",
    name: "Whisper Band",
    tagline: "Almost Invisible",
    lore: "A 3mm comfort-fit band so slim it almost disappears — for those who want to carry meaning without weight. The thinnest band in the collection, yet structurally perfect.",
    source: { type: "procedural", profile: { outerR: 9.8, innerR: 9.05, widthMm: 3, shape: "comfort" } },
    category: "minimalist",
    width: "3mm",
    defaultMetal: "Platinum",
    features: ["Ultra-slim 3mm width", "Comfort fit interior", "Barely-there aesthetic", "Daily wear perfection"],
    engraving: "WHISPER",
  },
  {
    id: "hex-facet",
    name: "Hex Core",
    tagline: "Honeycomb Geometry",
    lore: "Six facets create a hexagonal cross-section — the strongest shape in nature. This ring is an homage to the hexagon: honeycombs, basalt columns, snowflakes, molecular bonds.",
    source: { type: "procedural", profile: { outerR: 10.5, innerR: 9.05, widthMm: 6, shape: "faceted", facets: 6 } },
    category: "geometric",
    width: "6mm",
    defaultMetal: "Titanium",
    features: ["Hexagonal cross-section", "6 precision facets", "Nature's strongest geometry", "Industrial aesthetic"],
    engraving: "HEX · CORE",
  },
  {
    id: "double-groove",
    name: "Parallel Lines",
    tagline: "Two Paths, One Ring",
    lore: "Two deep channels bisect a comfort profile — symbolising two lives running in parallel, together. A wedding band that tells a story of partnership through pure geometry.",
    source: { type: "procedural", profile: { outerR: 10.3, innerR: 9.05, widthMm: 6, shape: "comfort", grooveCount: 2, grooveDepth: 0.5 } },
    category: "wedding",
    width: "6mm",
    defaultMetal: "Rose Gold",
    features: ["Dual parallel channels", "Partnership symbolism", "Comfort fit base", "Wedding-grade finish"],
    engraving: "TOGETHER · ALWAYS",
  },
  // More STL variations
  {
    id: "titan-monolith",
    name: "Titan Monolith",
    tagline: "Architecture for the Hand",
    lore: "The 10mm statement piece reimagined as brutalist architecture — concrete towers, monolithic sculptures, the weight of permanence.",
    source: { type: "stl", stlFile: "/models/Ring_10_mm.stl", scale: 1.0 },
    category: "avant-garde",
    width: "10mm",
    defaultMetal: "Tungsten",
    features: ["Brutalist aesthetic", "Maximum visual impact", "10mm presence", "Gallery-worthy design"],
    engraving: "MONOLITH",
  },
  {
    id: "ember-eternal",
    name: "Ember Eternal",
    tagline: "The Last Fire Still Burns",
    lore: "Our original 8mm design, perfected. Like the final ember in a dying fire — small, intense, impossibly hot.",
    source: { type: "stl", stlFile: "/models/Ring_8_mm-2.stl" },
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
    lore: "The 10mm platform pushed to its conceptual limit — a ring that feels like it contains a black hole.",
    source: { type: "stl", stlFile: "/models/Ring_10_mm.stl", scale: 1.0 },
    category: "avant-garde",
    width: "10mm",
    defaultMetal: "Black Rhodium",
    features: ["Light-absorbing exterior", "Mirror interior contrast", "Dimensional presence", "Conversation piece"],
    engraving: "V · O · I · D",
  },
  {
    id: "crown-heritage",
    name: "Crown Heritage",
    tagline: "Born to Rule",
    lore: "A regal interpretation — this isn't a ring, it's a coronation. Rose gold whispers of royal lineage while precision geometry speaks to modern mastery.",
    source: { type: "stl", stlFile: "/models/Ring_8_mm.stl" },
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
    lore: "Silver at absolute zero — frozen, crystalline, perfect. Inspired by polar ice shelves and the terrifying beauty of total stillness.",
    source: { type: "stl", stlFile: "/models/Ring_8_mm-3.stl" },
    category: "band",
    width: "8mm",
    defaultMetal: "Silver",
    features: ["Cryo-polish finish", "Zero-defect casting", "Minimalist perfection", "Ice-cold elegance"],
    engraving: "ZERO · KELVIN",
  },
  {
    id: "valkyrie-slim",
    name: "Valkyrie Slim",
    tagline: "Grace Under Pressure",
    lore: "An 8mm band with the soul of a warrior and the elegance of silver moonlight. For those who carry quiet strength.",
    source: { type: "stl", stlFile: "/models/Ring_8_mm-3.stl" },
    category: "band",
    width: "8mm",
    defaultMetal: "Silver",
    features: ["Refined 8mm profile", "Mirror-finish capable", "Everyday wearability", "Unisex design"],
    engraving: "VALKYRIE",
  },
];

// ── Procedural geometry builder ──────────────────────────────────

function buildProceduralGeometry(p: ProceduralProfile): THREE.BufferGeometry {
  const segments = 128;
  const halfW = (p.widthMm / 2) * 0.1; // scale to scene units
  const outerR = p.outerR * 0.1;
  const innerR = p.innerR * 0.1;
  const midR = (outerR + innerR) / 2;
  const thickness = (outerR - innerR);

  // Build cross-section points based on shape
  const points: THREE.Vector2[] = [];
  const steps = 64;

  const bevel = (p.bevelSize ?? 0.15) * thickness;

  switch (p.shape) {
    case "dome": {
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const y = -halfW + t * halfW * 2;
        const edgeDist = 1 - Math.abs(t - 0.5) * 2;
        const r = innerR + thickness * (0.5 + 0.5 * Math.sin(edgeDist * Math.PI * 0.5));
        points.push(new THREE.Vector2(r, y));
      }
      break;
    }
    case "flat": {
      points.push(new THREE.Vector2(innerR, -halfW));
      points.push(new THREE.Vector2(outerR - bevel, -halfW));
      points.push(new THREE.Vector2(outerR, -halfW + bevel));
      points.push(new THREE.Vector2(outerR, halfW - bevel));
      points.push(new THREE.Vector2(outerR - bevel, halfW));
      points.push(new THREE.Vector2(innerR, halfW));
      break;
    }
    case "knife": {
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const y = -halfW + t * halfW * 2;
        const edgeDist = 1 - Math.abs(t - 0.5) * 2;
        const r = innerR + thickness * Math.pow(edgeDist, 1.5);
        points.push(new THREE.Vector2(r, y));
      }
      break;
    }
    case "comfort": {
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const y = -halfW + t * halfW * 2;
        const edgeDist = 1 - Math.abs(t - 0.5) * 2;
        const r = innerR + thickness * (0.6 + 0.4 * edgeDist);
        points.push(new THREE.Vector2(r, y));
      }
      break;
    }
    case "stepped": {
      const stepCount = 3;
      const stepH = halfW * 2 / stepCount;
      const stepR = thickness / stepCount;
      for (let s = 0; s < stepCount; s++) {
        const baseR = innerR + stepR * s;
        const topR = innerR + stepR * (s + 1);
        const y0 = -halfW + s * stepH;
        const y1 = y0 + stepH;
        points.push(new THREE.Vector2(baseR, y0));
        points.push(new THREE.Vector2(topR, y0 + stepH * 0.1));
        points.push(new THREE.Vector2(topR, y1 - stepH * 0.1));
      }
      // Mirror
      for (let s = stepCount - 1; s >= 0; s--) {
        const topR = innerR + thickness - (thickness / stepCount) * s;
        points.push(new THREE.Vector2(topR, halfW));
      }
      break;
    }
    case "channel": {
      const channelDepth = thickness * 0.35;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const y = -halfW + t * halfW * 2;
        const edgeDist = 1 - Math.abs(t - 0.5) * 2;
        const channel = edgeDist > 0.3 && edgeDist < 0.7 ? -channelDepth * Math.sin((edgeDist - 0.3) / 0.4 * Math.PI) : 0;
        const r = innerR + thickness * (0.6 + 0.4 * edgeDist) + channel;
        points.push(new THREE.Vector2(r, y));
      }
      break;
    }
    case "concave": {
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const y = -halfW + t * halfW * 2;
        const edgeDist = 1 - Math.abs(t - 0.5) * 2;
        const concave = Math.cos(edgeDist * Math.PI) * thickness * 0.2;
        const r = innerR + thickness * 0.8 + concave;
        points.push(new THREE.Vector2(r, y));
      }
      break;
    }
    case "ridged": {
      const ridges = p.ridgeCount ?? 5;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const y = -halfW + t * halfW * 2;
        const edgeDist = 1 - Math.abs(t - 0.5) * 2;
        const ridge = Math.sin(t * Math.PI * ridges) * thickness * 0.12;
        const r = innerR + thickness * (0.5 + 0.5 * edgeDist) + ridge * edgeDist;
        points.push(new THREE.Vector2(r, y));
      }
      break;
    }
    case "barrel": {
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const y = -halfW + t * halfW * 2;
        const edgeDist = 1 - Math.abs(t - 0.5) * 2;
        const barrelCurve = Math.sin(edgeDist * Math.PI * 0.5);
        const r = innerR + thickness * (0.4 + 0.6 * barrelCurve);
        points.push(new THREE.Vector2(r, y));
      }
      break;
    }
    case "faceted": {
      const n = p.facets ?? 8;
      // Build a profile that when lathed with n segments creates facets
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const y = -halfW + t * halfW * 2;
        const edgeDist = 1 - Math.abs(t - 0.5) * 2;
        const r = innerR + thickness * (0.5 + 0.5 * edgeDist);
        points.push(new THREE.Vector2(r, y));
      }
      // Return with fewer radial segments for faceted look
      const geo = new THREE.LatheGeometry(points, n);
      geo.computeVertexNormals();
      // Flat shading by splitting normals — recalculate from faces
      geo.deleteAttribute("normal");
      geo.computeVertexNormals();
      return geo;
    }
    case "twisted": {
      // Standard comfort profile, twist applied via vertex manipulation
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const y = -halfW + t * halfW * 2;
        const edgeDist = 1 - Math.abs(t - 0.5) * 2;
        const r = innerR + thickness * (0.6 + 0.4 * edgeDist);
        points.push(new THREE.Vector2(r, y));
      }
      const geo = new THREE.LatheGeometry(points, segments);
      // Apply twist
      const twistRad = ((p.twistDeg ?? 15) * Math.PI) / 180;
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);
        const angle = twistRad * (y / (halfW * 2));
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        pos.setXYZ(i, x * cos - z * sin, y, x * sin + z * cos);
      }
      geo.computeVertexNormals();
      return geo;
    }
    case "organic": {
      // Wavy edges
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const y = -halfW + t * halfW * 2;
        const edgeDist = 1 - Math.abs(t - 0.5) * 2;
        const wave = Math.sin(t * Math.PI * 3) * thickness * 0.08;
        const r = innerR + thickness * (0.5 + 0.5 * Math.sin(edgeDist * Math.PI * 0.5)) + wave;
        points.push(new THREE.Vector2(r, y));
      }
      break;
    }
    default: {
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const y = -halfW + t * halfW * 2;
        const r = outerR;
        points.push(new THREE.Vector2(r, y));
      }
    }
  }

  // Add grooves if specified
  if (p.grooveCount && p.grooveCount > 0) {
    const groovePts: THREE.Vector2[] = [];
    const gDepth = (p.grooveDepth ?? 0.3) * thickness;
    for (let i = 0; i < points.length; i++) {
      const pt = points[i].clone();
      const t = (pt.y + halfW) / (halfW * 2);
      for (let g = 0; g < p.grooveCount; g++) {
        const gc = (g + 1) / (p.grooveCount + 1);
        const dist = Math.abs(t - gc);
        if (dist < 0.03) {
          pt.x -= gDepth * (1 - dist / 0.03);
        }
      }
      groovePts.push(pt);
    }
    const geo = new THREE.LatheGeometry(groovePts, segments);
    geo.computeVertexNormals();
    return geo;
  }

  const geo = new THREE.LatheGeometry(points, segments);
  geo.computeVertexNormals();
  return geo;
}

// ── Procedural Ring Mesh ─────────────────────────────────────────

function ProceduralRingMesh({ profile, metal }: { profile: ProceduralProfile; metal: MetalPreset }) {
  const groupRef = useRef<THREE.Group>(null);
  const geometry = useMemo(() => buildProceduralGeometry(profile), [profile]);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.getElapsedTime();
    groupRef.current.rotation.y = t * 0.25;
    groupRef.current.rotation.x = Math.sin(t * 0.15) * 0.08;
  });

  return (
    <group ref={groupRef} rotation={[Math.PI / 2, 0, 0]}>
      <mesh geometry={geometry} castShadow receiveShadow>
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

// ── STL Ring Mesh ────────────────────────────────────────────────

function STLRingMesh({ stlFile, metal, designScale }: { stlFile: string; metal: MetalPreset; designScale?: number }) {
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

// ── Universal Ring renderer ──────────────────────────────────────

function RingRenderer({ design, metal }: { design: LibraryDesign; metal: MetalPreset }) {
  if (design.source.type === "stl") {
    return <STLRingMesh stlFile={design.source.stlFile} metal={metal} designScale={design.source.scale} />;
  }
  return <ProceduralRingMesh profile={design.source.profile} metal={metal} />;
}

function LibraryScene({ design, metal }: { design: LibraryDesign; metal: MetalPreset }) {
  return (
    <>
      <ambientLight intensity={0.1} />
      <directionalLight position={[5, 8, 5]} intensity={2.5} color="#fff5e6" castShadow />
      <directionalLight position={[-4, 3, -3]} intensity={0.5} color="#c8d8f0" />
      <spotLight position={[0, 0, 5]} intensity={1.2} angle={0.5} penumbra={0.8} />
      <pointLight position={[-3, -1, -3]} intensity={0.5} color="#ffa040" />
      <pointLight position={[0, 4, 0]} intensity={0.6} color="#ffecd2" />
      <Suspense fallback={null}>
        <RingRenderer design={design} metal={metal} />
      </Suspense>
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
  minimalist: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  textured: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  geometric: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  custom: "bg-rose-500/10 text-rose-400 border-rose-500/20",
};

// ── Design Card ──────────────────────────────────────────────────

function DesignCard({ design, index, onSelect }: { design: LibraryDesign; index: number; onSelect: (d: LibraryDesign) => void }) {
  const metal = METALS.find((m) => m.id === design.defaultMetal) ?? METALS[0];
  const isProc = design.source.type === "procedural";

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.04 }}
      className="group relative rounded-2xl border border-border bg-card overflow-hidden hover:border-primary/40 transition-all cursor-pointer"
      onClick={() => onSelect(design)}
    >
      <div className="aspect-square relative bg-gradient-to-br from-forge-dark to-card">
        <Canvas camera={{ position: [0, 1.2, 3.0], fov: 34 }} gl={{ antialias: true, alpha: true }} dpr={[1, 1.5]}>
          <LibraryScene design={design} metal={metal} />
        </Canvas>

        <div className="absolute top-3 left-3 flex gap-1">
          <Badge variant="outline" className={`text-[9px] ${CATEGORY_STYLES[design.category] ?? ""}`}>
            {design.category}
          </Badge>
          {isProc && (
            <Badge variant="outline" className="text-[9px] bg-primary/5 text-primary/60 border-primary/15">
              procedural
            </Badge>
          )}
        </div>

        <div className="absolute top-3 right-3">
          <Badge variant="outline" className="text-[9px] bg-card/60 backdrop-blur-sm border-border/50 text-muted-foreground">
            {design.width}
          </Badge>
        </div>

        <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-4">
          <span className="text-[10px] text-primary flex items-center gap-1">
            <Eye className="w-3 h-3" /> View Details
          </span>
        </div>
      </div>

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

function DesignDetail({ design, onClose }: { design: LibraryDesign; onClose: () => void }) {
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
          <div className="aspect-square relative bg-gradient-to-br from-forge-dark to-card rounded-t-2xl lg:rounded-l-2xl lg:rounded-tr-none overflow-hidden">
            <Canvas camera={{ position: [0, 1.0, 3.2], fov: 32 }} gl={{ antialias: true, alpha: true }} dpr={[1, 2]}>
              <LibraryScene design={design} metal={metal} />
            </Canvas>

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

          <div className="p-6 sm:p-8 flex flex-col gap-5">
            <div>
              <div className="flex gap-1.5 mb-3">
                <Badge variant="outline" className={`text-[9px] ${CATEGORY_STYLES[design.category] ?? ""}`}>
                  {design.category}
                </Badge>
                {design.source.type === "procedural" && (
                  <Badge variant="outline" className="text-[9px] bg-primary/5 text-primary/60 border-primary/15">
                    procedural
                  </Badge>
                )}
              </div>
              <h2 className="font-display text-2xl sm:text-3xl text-foreground">{design.name}</h2>
              <p className="text-xs text-primary/80 mt-1 tracking-wide">{design.tagline}</p>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed font-body">{design.lore}</p>

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

            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Width", value: design.width },
                { label: "Metal", value: metal.label },
                { label: "Type", value: design.source.type === "stl" ? "STL Model" : "Procedural" },
              ].map((s) => (
                <div key={s.label} className="p-2.5 rounded-lg bg-secondary/50 border border-border/50">
                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground/70 mb-0.5">{s.label}</p>
                  <p className="text-xs font-medium text-foreground">{s.value}</p>
                </div>
              ))}
            </div>

            {design.engraving && (
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/70">✒️ Default Engraving</p>
                <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-[11px] font-mono tracking-wider border border-primary/20 bg-primary/5 text-primary/90">
                  {design.engraving}
                </span>
              </div>
            )}

            <div className="flex gap-3 pt-2 mt-auto">
              <Button
                onClick={() => navigate("/builder")}
                className="bg-primary text-primary-foreground hover:bg-ember-glow flex-1 font-display tracking-wider text-xs gap-2"
              >
                <Flame className="w-3.5 h-3.5" /> Customize This Ring
              </Button>
              <Button variant="outline" onClick={onClose} className="border-border text-muted-foreground text-xs">
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

const ALL_CATEGORIES: DesignCategory[] = ["band", "statement", "wedding", "signet", "avant-garde", "minimalist", "textured", "geometric"];

export default function DesignLibrary() {
  const navigate = useNavigate();
  const [selectedDesign, setSelectedDesign] = useState<LibraryDesign | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const allDesigns = LIBRARY_DESIGNS;
  const filtered = useMemo(() => {
    let result = allDesigns;
    if (filterCategory !== "all") {
      result = result.filter((d) => d.category === filterCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (d) => d.name.toLowerCase().includes(q) || d.tagline.toLowerCase().includes(q) || d.category.includes(q) || d.defaultMetal.toLowerCase().includes(q)
      );
    }
    return result;
  }, [allDesigns, filterCategory, searchQuery]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: allDesigns.length };
    allDesigns.forEach((d) => {
      counts[d.category] = (counts[d.category] ?? 0) + 1;
    });
    return counts;
  }, [allDesigns]);

  return (
    <div className="min-h-screen bg-background pt-20 pb-16">
      {/* Hero header */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 mb-10 sm:mb-14">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <p className="text-[10px] uppercase tracking-[0.3em] text-primary/70 mb-3 font-body">
            ForgeLab · Design Collection
          </p>
          <h1 className="font-display text-3xl sm:text-4xl md:text-5xl mb-4">
            The <span className="text-primary">Forge</span> Library
          </h1>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto font-body leading-relaxed">
            {allDesigns.length} hand-crafted ring designs — STL models and procedurally generated profiles.
            Every design is investment-cast ready and fully customisable.
          </p>
        </motion.div>

        {/* Search */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="max-w-sm mx-auto mt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Search designs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-xs bg-card border-border"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="w-3 h-3 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>
        </motion.div>

        {/* Category filters */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex flex-wrap justify-center gap-2 mt-6"
        >
          <button
            onClick={() => setFilterCategory("all")}
            className={`px-4 py-2 rounded-lg text-xs font-medium border transition-all ${
              filterCategory === "all"
                ? "bg-primary/10 border-primary/40 text-primary"
                : "bg-card border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            All ({categoryCounts.all})
          </button>
          {ALL_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-4 py-2 rounded-lg text-xs font-medium border transition-all capitalize ${
                filterCategory === cat
                  ? "bg-primary/10 border-primary/40 text-primary"
                  : "bg-card border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {cat} ({categoryCounts[cat] ?? 0})
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
            <p className="text-muted-foreground text-sm">No designs match your search</p>
            <button onClick={() => { setFilterCategory("all"); setSearchQuery(""); }} className="text-xs text-primary mt-2 hover:underline">
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* Upload CTA */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-10">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="p-6 rounded-2xl border border-dashed border-border bg-card/30 text-center"
        >
          <Upload className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
          <h3 className="font-display text-base text-foreground mb-1">Upload Your Own STL</h3>
          <p className="text-[11px] text-muted-foreground mb-4 max-w-md mx-auto">
            Have your own ring designs? Upload STL files to add them to your personal library. Coming soon — for now, use the builder to create from scratch.
          </p>
          <Button
            onClick={() => navigate("/builder")}
            variant="outline"
            className="border-border text-muted-foreground text-xs gap-2"
          >
            <Flame className="w-3.5 h-3.5" /> Open Builder
          </Button>
        </motion.div>
      </div>

      {/* Bottom CTA */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-8">
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
