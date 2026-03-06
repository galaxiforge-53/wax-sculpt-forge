import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment, ContactShadows } from "@react-three/drei";
import { useMemo, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Sparkles, Gem, Diamond } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

// ── Inlay material definition ────────────────────────────────────

interface InlayDef {
  material: "crystal" | "opal" | "meteorite";
  name: string;
  placement: number;
  widthMm: number;
  color: string;
  emissive: string;
  emissiveIntensity: number;
  roughness: number;
  metalness: number;
  opacity: number;
  depthMm?: number;
}

// ── Stone setting definition ─────────────────────────────────────

interface StoneSetting {
  shape: "cabochon" | "faceted" | "emerald-cut";
  name: string;
  sizeMm: number;
  color: string;
  emissive: string;
  emissiveIntensity: number;
  opacity: number;
  angleFromTop: number; // radians, 0 = top dead center
}

// ── Design definitions ───────────────────────────────────────────

interface RingDesign {
  id: string;
  name: string;
  tagline: string;
  lore: string;
  profile: "dome" | "flat" | "knife" | "comfort" | "runic" | "cosmic";
  grooves: number;
  grooveDepth: number;
  bevel: number;
  width: number;
  thickness: number;
  inlays: InlayDef[];
  stones?: StoneSetting[];
  engraving?: string;
}

interface MetalDef {
  id: string;
  label: string;
  color: string;
  roughness: number;
  metalness: number;
  envIntensity: number;
}

// ── Band designs (existing) ──────────────────────────────────────

const BAND_DESIGNS: RingDesign[] = [
  {
    id: "yggdrasil",
    name: "Yggdrasil Band",
    tagline: "Roots of the World Tree",
    lore: "Deep grooves echo the bark of eternity. Channels of crushed emerald crystal and ancient meteorite fill the roots that connect the Nine Realms.",
    profile: "runic",
    grooves: 4,
    grooveDepth: 0.35,
    bevel: 0.3,
    width: 8,
    thickness: 2.2,
    engraving: "YGGDRASIL · ETERNAL",
    inlays: [
      { material: "crystal", name: "Emerald", placement: -0.32, widthMm: 1.2, color: "#22c55e", emissive: "#0a6b2e", emissiveIntensity: 0.8, roughness: 0.08, metalness: 0.05, opacity: 0.82, depthMm: 0.4 },
      { material: "meteorite", name: "Muonionalusta", placement: 0.0, widthMm: 1.4, color: "#9ca3af", emissive: "#4b5563", emissiveIntensity: 0.15, roughness: 0.55, metalness: 0.7, opacity: 0.95, depthMm: 0.3 },
      { material: "crystal", name: "Emerald", placement: 0.32, widthMm: 1.2, color: "#22c55e", emissive: "#0a6b2e", emissiveIntensity: 0.8, roughness: 0.08, metalness: 0.05, opacity: 0.82, depthMm: 0.4 },
    ],
  },
  {
    id: "nebula-edge",
    name: "Nebula Edge",
    tagline: "Born from Stellar Dust",
    lore: "A luminous vein of fire opal flanked by tanzanite crystals — like a dying star's final breath frozen in precious metal.",
    profile: "knife",
    grooves: 2,
    grooveDepth: 0.2,
    bevel: 0.1,
    width: 7,
    thickness: 2.0,
    engraving: "GALAXIFORGE · EHAND3D",
    inlays: [
      { material: "crystal", name: "Tanzanite", placement: -0.22, widthMm: 0.9, color: "#7c3aed", emissive: "#5b21b6", emissiveIntensity: 0.7, roughness: 0.06, metalness: 0.04, opacity: 0.8, depthMm: 0.3 },
      { material: "opal", name: "Fire Opal", placement: 0.0, widthMm: 1.6, color: "#ff6b2b", emissive: "#ff4500", emissiveIntensity: 1.1, roughness: 0.04, metalness: 0.02, opacity: 0.85, depthMm: 0.5 },
      { material: "crystal", name: "Tanzanite", placement: 0.22, widthMm: 0.9, color: "#7c3aed", emissive: "#5b21b6", emissiveIntensity: 0.7, roughness: 0.06, metalness: 0.04, opacity: 0.8, depthMm: 0.3 },
    ],
  },
  {
    id: "mjolnir-forge",
    name: "Mjölnir Forge",
    tagline: "Hammered by Thunder",
    lore: "Three mighty channels of lapis lazuli, meteorite iron, and amethyst — Odin's ravens embedded in the anvil's memory.",
    profile: "flat",
    grooves: 3,
    grooveDepth: 0.4,
    bevel: 0.5,
    width: 10,
    thickness: 2.8,
    engraving: "FORGED IN THUNDER",
    inlays: [
      { material: "crystal", name: "Lapis Lazuli", placement: -0.28, widthMm: 1.3, color: "#2563eb", emissive: "#1e3a8a", emissiveIntensity: 0.6, roughness: 0.1, metalness: 0.06, opacity: 0.88, depthMm: 0.4 },
      { material: "meteorite", name: "Campo del Cielo", placement: 0.0, widthMm: 1.8, color: "#78716c", emissive: "#57534e", emissiveIntensity: 0.12, roughness: 0.6, metalness: 0.75, opacity: 0.95, depthMm: 0.5 },
      { material: "crystal", name: "Amethyst", placement: 0.28, widthMm: 1.3, color: "#a855f7", emissive: "#7e22ce", emissiveIntensity: 0.6, roughness: 0.1, metalness: 0.06, opacity: 0.88, depthMm: 0.4 },
    ],
  },
  {
    id: "aurora-comfort",
    name: "Aurora Comfort",
    tagline: "Northern Light's Embrace",
    lore: "Broad white opal captures the aurora borealis — shifting prismatic light sealed between twin diamond-dust crystal rails.",
    profile: "dome",
    grooves: 1,
    grooveDepth: 0.15,
    bevel: 0.0,
    width: 7,
    thickness: 2.0,
    engraving: "AURORA · BOREALIS",
    inlays: [
      { material: "crystal", name: "Diamond Dust", placement: -0.2, widthMm: 0.6, color: "#f0f9ff", emissive: "#bae6fd", emissiveIntensity: 0.9, roughness: 0.02, metalness: 0.03, opacity: 0.75, depthMm: 0.25 },
      { material: "opal", name: "White Opal", placement: 0.0, widthMm: 2.2, color: "#e0f0ff", emissive: "#93c5fd", emissiveIntensity: 0.85, roughness: 0.03, metalness: 0.02, opacity: 0.8, depthMm: 0.5 },
      { material: "crystal", name: "Diamond Dust", placement: 0.2, widthMm: 0.6, color: "#f0f9ff", emissive: "#bae6fd", emissiveIntensity: 0.9, roughness: 0.02, metalness: 0.03, opacity: 0.75, depthMm: 0.25 },
    ],
  },
  {
    id: "voidwalker",
    name: "Voidwalker",
    tagline: "Between Dimensions",
    lore: "Five channels alternate black opal and moldavite — the space between stars made tangible. Each band pulses with cosmic energy.",
    profile: "cosmic",
    grooves: 5,
    grooveDepth: 0.25,
    bevel: 0.2,
    width: 9,
    thickness: 2.4,
    engraving: "GALAXIFORGE · EHAND3D",
    inlays: [
      { material: "opal", name: "Black Opal", placement: -0.35, widthMm: 0.9, color: "#1e293b", emissive: "#3b82f6", emissiveIntensity: 1.2, roughness: 0.03, metalness: 0.08, opacity: 0.88, depthMm: 0.35 },
      { material: "crystal", name: "Moldavite", placement: -0.15, widthMm: 0.8, color: "#4ade80", emissive: "#16a34a", emissiveIntensity: 0.8, roughness: 0.1, metalness: 0.06, opacity: 0.82, depthMm: 0.3 },
      { material: "meteorite", name: "Gibeon", placement: 0.0, widthMm: 1.0, color: "#a1a1aa", emissive: "#71717a", emissiveIntensity: 0.1, roughness: 0.5, metalness: 0.8, opacity: 0.95, depthMm: 0.4 },
      { material: "crystal", name: "Moldavite", placement: 0.15, widthMm: 0.8, color: "#4ade80", emissive: "#16a34a", emissiveIntensity: 0.8, roughness: 0.1, metalness: 0.06, opacity: 0.82, depthMm: 0.3 },
      { material: "opal", name: "Black Opal", placement: 0.35, widthMm: 0.9, color: "#1e293b", emissive: "#8b5cf6", emissiveIntensity: 1.2, roughness: 0.03, metalness: 0.08, opacity: 0.88, depthMm: 0.35 },
    ],
  },
  {
    id: "fenrir-claw",
    name: "Fenrir's Claw",
    tagline: "Unbound Fury",
    lore: "Twin blood-red labradorite gashes separated by ancient meteorite iron — the wolf god's claw marks forged forever in dark tungsten.",
    profile: "flat",
    grooves: 2,
    grooveDepth: 0.5,
    bevel: 0.6,
    width: 12,
    thickness: 3.0,
    engraving: "FENRIR · UNBOUND",
    inlays: [
      { material: "crystal", name: "Labradorite", placement: -0.25, widthMm: 1.8, color: "#6366f1", emissive: "#4f46e5", emissiveIntensity: 0.75, roughness: 0.08, metalness: 0.1, opacity: 0.85, depthMm: 0.5 },
      { material: "meteorite", name: "Muonionalusta", placement: 0.0, widthMm: 1.5, color: "#a1a1aa", emissive: "#71717a", emissiveIntensity: 0.12, roughness: 0.5, metalness: 0.8, opacity: 0.95, depthMm: 0.4 },
      { material: "crystal", name: "Labradorite", placement: 0.25, widthMm: 1.8, color: "#6366f1", emissive: "#4f46e5", emissiveIntensity: 0.75, roughness: 0.08, metalness: 0.1, opacity: 0.85, depthMm: 0.5 },
    ],
  },
];

// ── Bespoke stone-set designs ────────────────────────────────────

const STONE_DESIGNS: RingDesign[] = [
  {
    id: "celestial-cabochon",
    name: "Celestial Cabochon",
    tagline: "Cosmic Orb of Power",
    lore: "A polished amethyst cabochon crowns this comfort-fit band, flanked by twin sapphire accents — a cosmic talisman forged in fire.",
    profile: "comfort",
    grooves: 0,
    grooveDepth: 0,
    bevel: 0,
    width: 7,
    thickness: 2.2,
    engraving: "CELESTIAL · FORGELAB",
    inlays: [],
    stones: [
      { shape: "cabochon", name: "Amethyst Cabochon", sizeMm: 5.0, color: "#9333ea", emissive: "#7e22ce", emissiveIntensity: 0.9, opacity: 0.85, angleFromTop: 0 },
      { shape: "cabochon", name: "Blue Sapphire", sizeMm: 2.5, color: "#3b82f6", emissive: "#1d4ed8", emissiveIntensity: 0.7, opacity: 0.8, angleFromTop: -0.5 },
      { shape: "cabochon", name: "Blue Sapphire", sizeMm: 2.5, color: "#3b82f6", emissive: "#1d4ed8", emissiveIntensity: 0.7, opacity: 0.8, angleFromTop: 0.5 },
    ],
  },
  {
    id: "crown-solitaire",
    name: "Crown Solitaire",
    tagline: "Brilliant Beyond Measure",
    lore: "A single brilliant-cut diamond set in a raised cathedral bezel — the pinnacle of precision craftsmanship, every facet engineered to capture light.",
    profile: "knife",
    grooves: 0,
    grooveDepth: 0,
    bevel: 0.2,
    width: 5,
    thickness: 2.0,
    engraving: "EHAND3D · FOREVER",
    inlays: [],
    stones: [
      { shape: "faceted", name: "Brilliant Diamond", sizeMm: 6.0, color: "#f0f9ff", emissive: "#e0f2fe", emissiveIntensity: 1.2, opacity: 0.75, angleFromTop: 0 },
    ],
  },
  {
    id: "serpents-eye",
    name: "Serpent's Eye",
    tagline: "Ancient Gaze Awakened",
    lore: "An amber cabochon glows like a serpent's eye atop a runic band, flanked by twin emerald accents. Meteorite iron courses through the band's veins.",
    profile: "runic",
    grooves: 2,
    grooveDepth: 0.3,
    bevel: 0.2,
    width: 8,
    thickness: 2.4,
    engraving: "SERPENT · AWAKENED",
    inlays: [
      { material: "meteorite", name: "Gibeon", placement: 0.0, widthMm: 1.2, color: "#a1a1aa", emissive: "#71717a", emissiveIntensity: 0.1, roughness: 0.5, metalness: 0.8, opacity: 0.95, depthMm: 0.3 },
    ],
    stones: [
      { shape: "cabochon", name: "Baltic Amber", sizeMm: 5.5, color: "#f59e0b", emissive: "#d97706", emissiveIntensity: 1.0, opacity: 0.88, angleFromTop: 0 },
      { shape: "cabochon", name: "Emerald", sizeMm: 2.0, color: "#22c55e", emissive: "#15803d", emissiveIntensity: 0.6, opacity: 0.78, angleFromTop: -0.6 },
      { shape: "cabochon", name: "Emerald", sizeMm: 2.0, color: "#22c55e", emissive: "#15803d", emissiveIntensity: 0.6, opacity: 0.78, angleFromTop: 0.6 },
    ],
  },
  {
    id: "radiant-cluster",
    name: "Radiant Cluster",
    tagline: "A Constellation in Metal",
    lore: "Five faceted gems — ruby, sapphire, emerald, topaz, and amethyst — set in a sweeping arc across a wide comfort band. Each stone a star in a private constellation.",
    profile: "comfort",
    grooves: 0,
    grooveDepth: 0,
    bevel: 0,
    width: 10,
    thickness: 2.6,
    engraving: "GALAXIFORGE · EHAND3D",
    inlays: [],
    stones: [
      { shape: "faceted", name: "Ruby", sizeMm: 3.0, color: "#ef4444", emissive: "#b91c1c", emissiveIntensity: 0.9, opacity: 0.82, angleFromTop: -0.5 },
      { shape: "faceted", name: "Sapphire", sizeMm: 3.5, color: "#3b82f6", emissive: "#1e40af", emissiveIntensity: 0.85, opacity: 0.8, angleFromTop: -0.2 },
      { shape: "faceted", name: "Emerald", sizeMm: 4.0, color: "#22c55e", emissive: "#166534", emissiveIntensity: 0.8, opacity: 0.78, angleFromTop: 0 },
      { shape: "faceted", name: "Topaz", sizeMm: 3.5, color: "#f59e0b", emissive: "#b45309", emissiveIntensity: 0.85, opacity: 0.8, angleFromTop: 0.2 },
      { shape: "faceted", name: "Amethyst", sizeMm: 3.0, color: "#a855f7", emissive: "#7e22ce", emissiveIntensity: 0.9, opacity: 0.82, angleFromTop: 0.5 },
    ],
  },
];

const DESIGNS: RingDesign[] = [...BAND_DESIGNS, ...STONE_DESIGNS];

const METALS: MetalDef[] = [
  { id: "gold", label: "Gold", color: "#D4A520", roughness: 0.08, metalness: 1.0, envIntensity: 3.0 },
  { id: "silver", label: "Silver", color: "#C8C8C8", roughness: 0.1, metalness: 1.0, envIntensity: 2.8 },
  { id: "rose-gold", label: "Rose Gold", color: "#C6897B", roughness: 0.1, metalness: 1.0, envIntensity: 2.6 },
  { id: "titanium", label: "Titanium", color: "#8A8A85", roughness: 0.22, metalness: 0.92, envIntensity: 2.0 },
  { id: "tungsten", label: "Tungsten", color: "#4A4A4A", roughness: 0.06, metalness: 1.0, envIntensity: 2.4 },
  { id: "wax", label: "Wax", color: "#78A85B", roughness: 0.85, metalness: 0.05, envIntensity: 0.2 },
];

// ── Helper: compute ring outer radius at a given Y position ─────

function getOuterRadiusAtY(
  profile: RingDesign["profile"],
  innerR: number,
  outerR: number,
  w: number,
  bevel: number,
  y: number,
): number {
  const t = (y / w) + 0.5;
  const clamped = Math.max(0, Math.min(1, t));
  const angle = clamped * Math.PI;

  switch (profile) {
    case "dome":
    case "comfort":
      return innerR + (outerR - innerR) * (0.5 + 0.5 * Math.sin(angle));
    case "knife":
      return innerR + (outerR - innerR) * Math.pow(Math.sin(angle), 0.45);
    case "runic": {
      const stepped = Math.sin(angle) * 0.7 + Math.sin(angle * 3) * 0.15 + Math.sin(angle * 5) * 0.05;
      return innerR + (outerR - innerR) * Math.max(0, stepped);
    }
    case "cosmic": {
      const base = Math.sin(angle);
      const concave = base - 0.08 * Math.sin(angle * 2);
      return innerR + (outerR - innerR) * Math.max(0, concave);
    }
    case "flat":
    default: {
      const b = bevel / 10;
      if (y < -w / 2 + b) {
        const frac = (y - (-w / 2)) / b;
        return innerR + (outerR - innerR) * Math.max(0, frac);
      }
      if (y > w / 2 - b) {
        const frac = (w / 2 - y) / b;
        return innerR + (outerR - innerR) * Math.max(0, frac);
      }
      return outerR;
    }
  }
}

// ── Meteorite Widmanstätten texture (enhanced) ──────────────────

function useMeteoriteTexture(seed: number) {
  return useMemo(() => {
    const size = 256;
    const data = new Uint8Array(size * size * 4);
    let s = seed | 0 || 1;
    const rng = () => { s = (s * 16807) % 2147483647; return (s & 0x7fffffff) / 0x7fffffff; };

    // Base grain
    for (let i = 0; i < size * size; i++) {
      const v = 120 + rng() * 40;
      data[i * 4] = v;
      data[i * 4 + 1] = v;
      data[i * 4 + 2] = v;
      data[i * 4 + 3] = 255;
    }

    // Widmanstätten crystalline bands — more of them, sharper
    const lineCount = 14 + Math.floor(rng() * 12);
    for (let l = 0; l < lineCount; l++) {
      const angle = rng() * Math.PI;
      // Multiple parallel sub-bands per line group
      const subBands = 1 + Math.floor(rng() * 3);
      for (let sb = 0; sb < subBands; sb++) {
        const cx = rng() * size;
        const cy = rng() * size;
        const length = 30 + rng() * 80;
        const width = 0.5 + rng() * 2.5;
        const brightness = 170 + rng() * 60;

        for (let t = -length / 2; t < length / 2; t += 0.4) {
          for (let w2 = -width; w2 <= width; w2 += 0.4) {
            const px = Math.round(cx + Math.cos(angle) * t + Math.cos(angle + Math.PI / 2) * w2);
            const py = Math.round(cy + Math.sin(angle) * t + Math.sin(angle + Math.PI / 2) * w2);
            const wpx = ((px % size) + size) % size;
            const wpy = ((py % size) + size) % size;
            const idx = (wpy * size + wpx) * 4;
            const falloff = 1 - Math.abs(w2) / width;
            const mix = falloff * 0.5;
            data[idx] = data[idx] * (1 - mix) + brightness * mix;
            data[idx + 1] = data[idx + 1] * (1 - mix) + brightness * mix;
            data[idx + 2] = data[idx + 2] * (1 - mix) + brightness * mix;
          }
        }
      }
    }

    const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 1);
    tex.needsUpdate = true;
    return tex;
  }, [seed]);
}

// ── Casting surface texture (normal + roughness) ────────────────
// Simulates investment casting grain, micro tool marks, and hand-finish imperfections

function useCastingTextures(seed: number) {
  return useMemo(() => {
    const size = 512;
    let s = seed | 0 || 1;
    const rng = () => { s = (s * 16807) % 2147483647; return (s & 0x7fffffff) / 0x7fffffff; };

    // ── Heightmap: casting grain + radial tool marks + pitting ──
    const hmap = new Float32Array(size * size).fill(0.5);

    // 1) Fine casting grain noise
    for (let i = 0; i < hmap.length; i++) {
      hmap[i] += (rng() - 0.5) * 0.08;
    }

    // 2) Circumferential polishing scratches (horizontal streaks in UV)
    const scratchCount = 40 + Math.floor(rng() * 60);
    for (let sc = 0; sc < scratchCount; sc++) {
      const y = Math.floor(rng() * size);
      const width = 1 + Math.floor(rng() * 2);
      const depth = 0.02 + rng() * 0.04;
      const startX = Math.floor(rng() * size * 0.3);
      const length = Math.floor(size * 0.4 + rng() * size * 0.6);
      for (let x = startX; x < startX + length && x < size; x++) {
        for (let dy = -width; dy <= width; dy++) {
          const wy = ((y + dy) % size + size) % size;
          const falloff = 1 - Math.abs(dy) / (width + 1);
          hmap[wy * size + x] -= depth * falloff;
        }
      }
    }

    // 3) Tiny casting pits (investment casting porosity)
    const pitCount = 80 + Math.floor(rng() * 120);
    for (let p = 0; p < pitCount; p++) {
      const px = Math.floor(rng() * size);
      const py = Math.floor(rng() * size);
      const r = 1 + Math.floor(rng() * 3);
      const depth = 0.03 + rng() * 0.06;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d > r) continue;
          const wx = ((px + dx) % size + size) % size;
          const wy = ((py + dy) % size + size) % size;
          hmap[wy * size + wx] -= depth * (1 - d / r);
        }
      }
    }

    // 4) Broader hand-worked undulation
    const blobCount = 8 + Math.floor(rng() * 8);
    for (let b = 0; b < blobCount; b++) {
      const bx = rng() * size;
      const by = rng() * size;
      const br = 20 + rng() * 40;
      const bh = (rng() - 0.5) * 0.06;
      for (let dy = -Math.ceil(br); dy <= Math.ceil(br); dy++) {
        for (let dx = -Math.ceil(br); dx <= Math.ceil(br); dx++) {
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d > br) continue;
          const wx = ((Math.floor(bx) + dx) % size + size) % size;
          const wy = ((Math.floor(by) + dy) % size + size) % size;
          hmap[wy * size + wx] += bh * (1 - (d / br) * (d / br));
        }
      }
    }

    // ── Normal map from heightmap ──
    const normalData = new Uint8Array(size * size * 4);
    const strength = 3.0;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const xl = ((x - 1) + size) % size;
        const xr = (x + 1) % size;
        const yu = Math.max(0, y - 1);
        const yd = Math.min(size - 1, y + 1);
        const left = hmap[y * size + xl];
        const right = hmap[y * size + xr];
        const up = hmap[yu * size + x];
        const down = hmap[yd * size + x];
        let nx = (left - right) * strength;
        let ny = (up - down) * strength;
        let nz = 1.0;
        const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
        nx /= len; ny /= len; nz /= len;
        const idx = (y * size + x) * 4;
        normalData[idx] = Math.round((nx * 0.5 + 0.5) * 255);
        normalData[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
        normalData[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
        normalData[idx + 3] = 255;
      }
    }

    // ── Roughness map — scratches are shinier, pits are rougher ──
    const roughData = new Uint8Array(size * size * 4);
    for (let i = 0; i < hmap.length; i++) {
      const h = hmap[i];
      // Lower heightmap = pit/scratch = slightly different roughness
      const rough = h < 0.48 ? 100 : h > 0.52 ? 140 : 120;
      const jitter = Math.floor((rng() - 0.5) * 20);
      const v = Math.max(0, Math.min(255, rough + jitter));
      const idx = i * 4;
      roughData[idx] = v;
      roughData[idx + 1] = v;
      roughData[idx + 2] = v;
      roughData[idx + 3] = 255;
    }

    const normalMap = new THREE.DataTexture(normalData, size, size, THREE.RGBAFormat);
    normalMap.wrapS = THREE.RepeatWrapping;
    normalMap.wrapT = THREE.RepeatWrapping;
    normalMap.repeat.set(2, 1);
    normalMap.needsUpdate = true;

    const roughnessMap = new THREE.DataTexture(roughData, size, size, THREE.RGBAFormat);
    roughnessMap.wrapS = THREE.RepeatWrapping;
    roughnessMap.wrapT = THREE.RepeatWrapping;
    roughnessMap.repeat.set(2, 1);
    roughnessMap.needsUpdate = true;

    return { normalMap, roughnessMap };
  }, [seed]);
}

// ── Inlay channel as LatheGeometry strip ─────────────────────────

function InlayChannel({
  inlay,
  design,
  innerR,
  outerR,
  ringWidth,
  idx,
}: {
  inlay: InlayDef;
  design: RingDesign;
  innerR: number;
  outerR: number;
  ringWidth: number;
  idx: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const bandHalf = (inlay.widthMm / 10) / 2;
  const yCenter = inlay.placement * ringWidth;
  const meteorTex = useMeteoriteTexture(42 + idx * 7);

  const geometry = useMemo(() => {
    const steps = 16;
    const points: THREE.Vector2[] = [];
    const channelDepth = (inlay.depthMm ?? 0.3) / 10;

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const y = yCenter - bandHalf + t * bandHalf * 2;
      const surfaceR = getOuterRadiusAtY(design.profile, innerR, outerR, ringWidth, design.bevel, y);
      const edgeDist = Math.abs(t - 0.5) * 2;
      const channelCurve = 1 - Math.pow(edgeDist, 2.5);
      const r = surfaceR - channelDepth * channelCurve + 0.001;
      points.push(new THREE.Vector2(Math.max(innerR + 0.01, r), y));
    }

    return new THREE.LatheGeometry(points, 128);
  }, [inlay, design, innerR, outerR, ringWidth, yCenter, bandHalf]);

  const glowGeometry = useMemo(() => {
    if (inlay.material === "meteorite") return null;
    const steps = 8;
    const points: THREE.Vector2[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const y = yCenter - bandHalf * 1.1 + t * bandHalf * 2.2;
      const surfaceR = getOuterRadiusAtY(design.profile, innerR, outerR, ringWidth, design.bevel, y);
      points.push(new THREE.Vector2(surfaceR + 0.004, y));
    }
    return new THREE.LatheGeometry(points, 96);
  }, [inlay, design, innerR, outerR, ringWidth, yCenter, bandHalf]);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const mat = meshRef.current.material as THREE.MeshStandardMaterial;
    const t = clock.getElapsedTime();

    if (inlay.material === "opal") {
      const phase = t * 0.8 + inlay.placement * 4;
      const r = Math.sin(phase) * 0.5 + 0.5;
      const g = Math.sin(phase + 2.1) * 0.5 + 0.5;
      const b = Math.sin(phase + 4.2) * 0.5 + 0.5;
      mat.emissive.setRGB(r * 0.4, g * 0.5, b * 0.6);
      mat.emissiveIntensity = inlay.emissiveIntensity * (0.6 + Math.sin(t * 2.0) * 0.4);
    } else if (inlay.material === "crystal") {
      const pulse = Math.sin(t * 0.7 + idx * 2.0) * 0.3 + 0.7;
      mat.emissiveIntensity = inlay.emissiveIntensity * pulse;
      mat.roughness = inlay.roughness + Math.sin(t * 3 + idx) * 0.03;
    }

    if (glowRef.current && inlay.material !== "meteorite") {
      const gMat = glowRef.current.material as THREE.MeshBasicMaterial;
      gMat.opacity = 0.08 + Math.sin(t * 1.5 + idx) * 0.06;
    }
  });

  return (
    <group>
      <mesh ref={meshRef} geometry={geometry} rotation={[Math.PI / 2, 0, 0]} castShadow>
        {inlay.material === "meteorite" ? (
          <meshStandardMaterial
            color={inlay.color}
            emissive={inlay.emissive}
            emissiveIntensity={inlay.emissiveIntensity}
            roughness={inlay.roughness}
            metalness={inlay.metalness}
            transparent
            opacity={inlay.opacity}
            envMapIntensity={1.2}
            map={meteorTex}
          />
        ) : (
          <meshPhysicalMaterial
            color={inlay.color}
            emissive={inlay.emissive}
            emissiveIntensity={inlay.emissiveIntensity}
            roughness={inlay.roughness}
            metalness={inlay.metalness}
            transparent
            opacity={inlay.opacity}
            envMapIntensity={inlay.material === "opal" ? 3.5 : 3.0}
            transmission={inlay.material === "opal" ? 0.3 : 0.15}
            thickness={0.5}
            ior={inlay.material === "opal" ? 1.45 : 1.55}
            clearcoat={0.4}
            clearcoatRoughness={0.1}
          />
        )}
      </mesh>

      {glowGeometry && inlay.material !== "meteorite" && (
        <mesh ref={glowRef} geometry={glowGeometry} rotation={[Math.PI / 2, 0, 0]}>
          <meshBasicMaterial
            color={inlay.emissive}
            transparent
            opacity={0.1}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
    </group>
  );
}

// ── Gemstone with bezel setting ──────────────────────────────────
// Renders a bezel cup + gemstone (cabochon dome or faceted octahedron)
// positioned on the ring's outer surface at a given angle from top.

function GemStoneGroup({
  stone,
  outerR,
  metalColor,
  isWax,
  idx,
}: {
  stone: StoneSetting;
  outerR: number;
  metalColor: string;
  isWax: boolean;
  idx: number;
}) {
  const gemRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  const stoneR = stone.sizeMm / 10 / 2;
  const bezelH = stoneR * 0.8;
  const θ = stone.angleFromTop;

  // Position on the outer surface of the ring (in group space after mesh rotation PI/2 around X)
  const surfaceR = outerR + bezelH * 0.15;
  const px = surfaceR * Math.sin(θ);
  const py = surfaceR * Math.cos(θ);

  // Animate gem glow
  useFrame(({ clock }) => {
    if (!gemRef.current) return;
    const mat = gemRef.current.material as THREE.MeshStandardMaterial;
    const t = clock.getElapsedTime();

    if (stone.shape === "cabochon") {
      // Warm inner glow pulse
      mat.emissiveIntensity = stone.emissiveIntensity * (0.6 + Math.sin(t * 0.6 + idx * 2.5) * 0.4);
    } else {
      // Faceted sparkle — rapid emissive flicker
      const sparkle = Math.sin(t * 2.5 + idx * 1.7) * 0.3 + Math.sin(t * 4.1 + idx * 3.2) * 0.15;
      mat.emissiveIntensity = stone.emissiveIntensity * (0.55 + sparkle);
    }

    if (glowRef.current) {
      const gMat = glowRef.current.material as THREE.MeshBasicMaterial;
      gMat.opacity = 0.12 + Math.sin(t * 1.2 + idx) * 0.08;
    }
  });

  return (
    <group position={[px, py, 0]} rotation={[0, 0, -θ]}>
      {/* Bezel cup — short tapered cylinder */}
      <mesh position={[0, bezelH * 0.2, 0]} castShadow>
        <cylinderGeometry args={[stoneR + 0.008, stoneR + 0.014, bezelH * 0.55, 32]} />
        <meshStandardMaterial
          color={isWax ? "#78A85B" : metalColor}
          roughness={isWax ? 0.85 : 0.12}
          metalness={isWax ? 0.05 : 0.95}
          envMapIntensity={isWax ? 0.2 : 1.5}
        />
      </mesh>

      {/* Gemstone */}
      {stone.shape === "cabochon" ? (
        // Cabochon: smooth dome (squashed sphere)
        <mesh ref={gemRef} position={[0, bezelH * 0.45, 0]} scale={[1, 0.55, 1]} castShadow>
          <sphereGeometry args={[stoneR, 48, 32]} />
          <meshPhysicalMaterial
            color={stone.color}
            emissive={stone.emissive}
            emissiveIntensity={stone.emissiveIntensity}
            roughness={0.02}
            metalness={0.01}
            transparent
            opacity={stone.opacity}
            envMapIntensity={4.0}
            transmission={0.35}
            thickness={stoneR * 8}
            ior={1.54}
            clearcoat={0.8}
            clearcoatRoughness={0.05}
          />
        </mesh>
      ) : (
        // Faceted: octahedron (diamond cut)
        <mesh
          ref={gemRef}
          position={[0, bezelH * 0.55, 0]}
          scale={[1, 0.75, 1]}
          rotation={[0, Math.PI / 4, 0]}
          castShadow
        >
          <octahedronGeometry args={[stoneR, 2]} />
          <meshPhysicalMaterial
            color={stone.color}
            emissive={stone.emissive}
            emissiveIntensity={stone.emissiveIntensity}
            roughness={0.01}
            metalness={0.02}
            transparent
            opacity={stone.opacity}
            envMapIntensity={5.0}
            transmission={0.4}
            thickness={stoneR * 10}
            ior={2.42}
            clearcoat={1.0}
            clearcoatRoughness={0.02}
          />
        </mesh>
      )}

      {/* Glow halo beneath stone */}
      <mesh ref={glowRef} position={[0, bezelH * 0.5, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[stoneR * 0.3, stoneR * 1.4, 32]} />
        <meshBasicMaterial
          color={stone.emissive}
          transparent
          opacity={0.15}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

// ── Interior Engraving Geometry ──────────────────────────────────
// Creates 3D engraved text on the inner bore of the ring using
// displaced rectangular blocks arranged along the circumference.

function InteriorEngraving({
  text,
  innerR,
  ringWidth,
  metalColor,
  isWax,
}: {
  text: string;
  innerR: number;
  ringWidth: number;
  metalColor: string;
  isWax: boolean;
}) {
  const glyphMeshes = useMemo(() => {
    if (!text) return [];
    const chars = text.split("");
    const charHeight = ringWidth * 0.28; // 28% of ring width
    const charWidth = charHeight * 0.55;
    const spacing = charHeight * 0.15;
    const totalWidth = chars.length * (charWidth + spacing);
    const engravingR = innerR - 0.004; // slightly inset from inner surface
    const depth = 0.008; // engraving depth

    // Angle per character around the circumference
    const circumference = 2 * Math.PI * engravingR;
    const totalAngle = (totalWidth / circumference) * 2 * Math.PI;
    const startAngle = -totalAngle / 2;

    return chars.map((char, i) => {
      if (char === " ") return null;
      const charAngle = startAngle + (i * (charWidth + spacing) / circumference) * 2 * Math.PI;

      // Each character is built from simple rectangular strokes
      const strokes = getCharStrokes(char, charWidth, charHeight);
      return { char, charAngle, strokes, depth, engravingR, charHeight };
    });
  }, [text, innerR, ringWidth]);

  return (
    <group>
      {glyphMeshes.map((glyph, i) => {
        if (!glyph) return null;
        const { charAngle, strokes, depth, engravingR, charHeight } = glyph;

        return (
          <group key={i}>
            {strokes.map((stroke, si) => {
              // Position on inner bore
              const px = engravingR * Math.cos(charAngle + stroke.offsetX / engravingR);
              const pz = engravingR * Math.sin(charAngle + stroke.offsetX / engravingR);
              const py = stroke.offsetY - charHeight / 2;

              return (
                <mesh
                  key={si}
                  position={[px, py, pz]}
                  rotation={[
                    Math.PI / 2,
                    0,
                    -charAngle - stroke.offsetX / engravingR + Math.PI / 2,
                  ]}
                >
                  <boxGeometry args={[stroke.width, depth, stroke.height]} />
                  <meshStandardMaterial
                    color={isWax ? "#5a7a42" : metalColor}
                    roughness={isWax ? 0.9 : 0.3}
                    metalness={isWax ? 0.02 : 0.8}
                    envMapIntensity={0.5}
                  />
                </mesh>
              );
            })}
          </group>
        );
      })}
    </group>
  );
}

// Simple stroke-based character rendering (sans-serif block letters)
interface CharStroke {
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
}

function getCharStrokes(char: string, w: number, h: number): CharStroke[] {
  const t = w * 0.18; // stroke thickness
  const strokes: CharStroke[] = [];

  const patterns: Record<string, () => void> = {
    "A": () => { strokes.push({ offsetX: 0, offsetY: h, width: w, height: t }); strokes.push({ offsetX: -w/2+t/2, offsetY: h/2, width: t, height: h }); strokes.push({ offsetX: w/2-t/2, offsetY: h/2, width: t, height: h }); strokes.push({ offsetX: 0, offsetY: h*0.5, width: w, height: t }); },
    "B": () => { strokes.push({ offsetX: -w/2+t/2, offsetY: h/2, width: t, height: h }); strokes.push({ offsetX: 0, offsetY: h, width: w, height: t }); strokes.push({ offsetX: 0, offsetY: h*0.5, width: w, height: t }); strokes.push({ offsetX: 0, offsetY: 0, width: w, height: t }); strokes.push({ offsetX: w/2-t/2, offsetY: h*0.75, width: t, height: h/2 }); strokes.push({ offsetX: w/2-t/2, offsetY: h*0.25, width: t, height: h/2 }); },
    "C": () => { strokes.push({ offsetX: -w/2+t/2, offsetY: h/2, width: t, height: h }); strokes.push({ offsetX: 0, offsetY: h, width: w, height: t }); strokes.push({ offsetX: 0, offsetY: 0, width: w, height: t }); },
    "D": () => { strokes.push({ offsetX: -w/2+t/2, offsetY: h/2, width: t, height: h }); strokes.push({ offsetX: 0, offsetY: h, width: w, height: t }); strokes.push({ offsetX: 0, offsetY: 0, width: w, height: t }); strokes.push({ offsetX: w/2-t/2, offsetY: h/2, width: t, height: h }); },
    "E": () => { strokes.push({ offsetX: -w/2+t/2, offsetY: h/2, width: t, height: h }); strokes.push({ offsetX: 0, offsetY: h, width: w, height: t }); strokes.push({ offsetX: 0, offsetY: h*0.5, width: w*0.7, height: t }); strokes.push({ offsetX: 0, offsetY: 0, width: w, height: t }); },
    "F": () => { strokes.push({ offsetX: -w/2+t/2, offsetY: h/2, width: t, height: h }); strokes.push({ offsetX: 0, offsetY: h, width: w, height: t }); strokes.push({ offsetX: 0, offsetY: h*0.5, width: w*0.7, height: t }); },
    "G": () => { strokes.push({ offsetX: -w/2+t/2, offsetY: h/2, width: t, height: h }); strokes.push({ offsetX: 0, offsetY: h, width: w, height: t }); strokes.push({ offsetX: 0, offsetY: 0, width: w, height: t }); strokes.push({ offsetX: w/2-t/2, offsetY: h*0.25, width: t, height: h/2 }); strokes.push({ offsetX: w*0.15, offsetY: h*0.5, width: w*0.7, height: t }); },
    "H": () => { strokes.push({ offsetX: -w/2+t/2, offsetY: h/2, width: t, height: h }); strokes.push({ offsetX: w/2-t/2, offsetY: h/2, width: t, height: h }); strokes.push({ offsetX: 0, offsetY: h*0.5, width: w, height: t }); },
    "I": () => { strokes.push({ offsetX: 0, offsetY: h/2, width: t, height: h }); strokes.push({ offsetX: 0, offsetY: h, width: w*0.6, height: t }); strokes.push({ offsetX: 0, offsetY: 0, width: w*0.6, height: t }); },
    "K": () => { strokes.push({ offsetX: -w/2+t/2, offsetY: h/2, width: t, height: h }); strokes.push({ offsetX: w*0.1, offsetY: h*0.5, width: w*0.5, height: t }); strokes.push({ offsetX: w/2-t/2, offsetY: h*0.75, width: t, height: h/2 }); strokes.push({ offsetX: w/2-t/2, offsetY: h*0.25, width: t, height: h/2 }); },
    "L": () => { strokes.push({ offsetX: -w/2+t/2, offsetY: h/2, width: t, height: h }); strokes.push({ offsetX: 0, offsetY: 0, width: w, height: t }); },
    "M": () => { strokes.push({ offsetX: -w/2+t/2, offsetY: h/2, width: t, height: h }); strokes.push({ offsetX: w/2-t/2, offsetY: h/2, width: t, height: h }); strokes.push({ offsetX: -w*0.15, offsetY: h*0.7, width: t, height: h*0.55 }); strokes.push({ offsetX: w*0.15, offsetY: h*0.7, width: t, height: h*0.55 }); strokes.push({ offsetX: 0, offsetY: h, width: w, height: t }); },
    "N": () => { strokes.push({ offsetX: -w/2+t/2, offsetY: h/2, width: t, height: h }); strokes.push({ offsetX: w/2-t/2, offsetY: h/2, width: t, height: h }); strokes.push({ offsetX: 0, offsetY: h, width: w, height: t }); strokes.push({ offsetX: 0, offsetY: 0, width: w, height: t }); },
    "O": () => { strokes.push({ offsetX: -w/2+t/2, offsetY: h/2, width: t, height: h }); strokes.push({ offsetX: w/2-t/2, offsetY: h/2, width: t, height: h }); strokes.push({ offsetX: 0, offsetY: h, width: w, height: t }); strokes.push({ offsetX: 0, offsetY: 0, width: w, height: t }); },
    "P": () => { strokes.push({ offsetX: -w/2+t/2, offsetY: h/2, width: t, height: h }); strokes.push({ offsetX: 0, offsetY: h, width: w, height: t }); strokes.push({ offsetX: 0, offsetY: h*0.5, width: w, height: t }); strokes.push({ offsetX: w/2-t/2, offsetY: h*0.75, width: t, height: h/2 }); },
    "R": () => { strokes.push({ offsetX: -w/2+t/2, offsetY: h/2, width: t, height: h }); strokes.push({ offsetX: 0, offsetY: h, width: w, height: t }); strokes.push({ offsetX: 0, offsetY: h*0.5, width: w, height: t }); strokes.push({ offsetX: w/2-t/2, offsetY: h*0.75, width: t, height: h/2 }); strokes.push({ offsetX: w/2-t/2, offsetY: h*0.25, width: t, height: h/2 }); },
    "S": () => { strokes.push({ offsetX: 0, offsetY: h, width: w, height: t }); strokes.push({ offsetX: -w/2+t/2, offsetY: h*0.75, width: t, height: h/2 }); strokes.push({ offsetX: 0, offsetY: h*0.5, width: w, height: t }); strokes.push({ offsetX: w/2-t/2, offsetY: h*0.25, width: t, height: h/2 }); strokes.push({ offsetX: 0, offsetY: 0, width: w, height: t }); },
    "T": () => { strokes.push({ offsetX: 0, offsetY: h, width: w, height: t }); strokes.push({ offsetX: 0, offsetY: h/2, width: t, height: h }); },
    "U": () => { strokes.push({ offsetX: -w/2+t/2, offsetY: h/2, width: t, height: h }); strokes.push({ offsetX: w/2-t/2, offsetY: h/2, width: t, height: h }); strokes.push({ offsetX: 0, offsetY: 0, width: w, height: t }); },
    "V": () => { strokes.push({ offsetX: -w/2+t/2, offsetY: h/2, width: t, height: h }); strokes.push({ offsetX: w/2-t/2, offsetY: h/2, width: t, height: h }); strokes.push({ offsetX: 0, offsetY: 0, width: w*0.5, height: t }); },
    "W": () => { strokes.push({ offsetX: -w/2+t/2, offsetY: h/2, width: t, height: h }); strokes.push({ offsetX: w/2-t/2, offsetY: h/2, width: t, height: h }); strokes.push({ offsetX: -w*0.15, offsetY: h*0.3, width: t, height: h*0.55 }); strokes.push({ offsetX: w*0.15, offsetY: h*0.3, width: t, height: h*0.55 }); strokes.push({ offsetX: 0, offsetY: 0, width: w, height: t }); },
    "X": () => { strokes.push({ offsetX: -w/2+t/2, offsetY: h*0.75, width: t, height: h/2 }); strokes.push({ offsetX: w/2-t/2, offsetY: h*0.75, width: t, height: h/2 }); strokes.push({ offsetX: 0, offsetY: h*0.5, width: w*0.5, height: t }); strokes.push({ offsetX: -w/2+t/2, offsetY: h*0.25, width: t, height: h/2 }); strokes.push({ offsetX: w/2-t/2, offsetY: h*0.25, width: t, height: h/2 }); },
    "Y": () => { strokes.push({ offsetX: -w/2+t/2, offsetY: h*0.75, width: t, height: h/2 }); strokes.push({ offsetX: w/2-t/2, offsetY: h*0.75, width: t, height: h/2 }); strokes.push({ offsetX: 0, offsetY: h*0.5, width: w*0.5, height: t }); strokes.push({ offsetX: 0, offsetY: h*0.25, width: t, height: h/2 }); },
    "Z": () => { strokes.push({ offsetX: 0, offsetY: h, width: w, height: t }); strokes.push({ offsetX: 0, offsetY: h*0.5, width: t*1.5, height: h*0.8 }); strokes.push({ offsetX: 0, offsetY: 0, width: w, height: t }); },
    "0": () => { patterns["O"]!(); },
    "1": () => { strokes.push({ offsetX: 0, offsetY: h/2, width: t, height: h }); },
    "2": () => { strokes.push({ offsetX: 0, offsetY: h, width: w, height: t }); strokes.push({ offsetX: w/2-t/2, offsetY: h*0.75, width: t, height: h/2 }); strokes.push({ offsetX: 0, offsetY: h*0.5, width: w, height: t }); strokes.push({ offsetX: -w/2+t/2, offsetY: h*0.25, width: t, height: h/2 }); strokes.push({ offsetX: 0, offsetY: 0, width: w, height: t }); },
    "3": () => { strokes.push({ offsetX: 0, offsetY: h, width: w, height: t }); strokes.push({ offsetX: 0, offsetY: h*0.5, width: w, height: t }); strokes.push({ offsetX: 0, offsetY: 0, width: w, height: t }); strokes.push({ offsetX: w/2-t/2, offsetY: h/2, width: t, height: h }); },
    "·": () => { strokes.push({ offsetX: 0, offsetY: h*0.5, width: t*1.2, height: t*1.2 }); },
    "-": () => { strokes.push({ offsetX: 0, offsetY: h*0.5, width: w*0.7, height: t }); },
    "J": () => { strokes.push({ offsetX: w/2-t/2, offsetY: h/2, width: t, height: h }); strokes.push({ offsetX: 0, offsetY: 0, width: w, height: t }); strokes.push({ offsetX: -w/2+t/2, offsetY: h*0.2, width: t, height: h*0.35 }); },
  };

  const upperChar = char.toUpperCase();
  if (patterns[upperChar]) {
    patterns[upperChar]();
  } else {
    // Fallback: small square dot
    strokes.push({ offsetX: 0, offsetY: h * 0.5, width: t, height: t });
  }

  return strokes;
}

// ── 3D Ring Mesh (enhanced with casting detail) ─────────────────

function ShowcaseRing({ design, metal }: { design: RingDesign; metal: MetalDef }) {
  const groupRef = useRef<THREE.Group>(null);
  const castingTex = useCastingTextures(42 + design.id.length * 7);

  useFrame(({ clock }, delta) => {
    if (groupRef.current) {
      const t = clock.getElapsedTime();
      groupRef.current.rotation.y += delta * 0.2;
      // Gentle cinematic tilt — reveals top & bottom surfaces
      groupRef.current.rotation.x = Math.sin(t * 0.3) * 0.12;
      groupRef.current.rotation.z = Math.sin(t * 0.2 + 1.0) * 0.06;
    }
  });

  const innerR = 0.85;
  const outerR = innerR + design.thickness / 10;
  const w = design.width / 10;

  const geometry = useMemo(() => {
    const bevel = design.bevel / 10;
    const points: THREE.Vector2[] = [];
    // High poly for surface detail
    const steps = 128;

    if (design.profile === "dome" || design.profile === "comfort") {
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const angle = t * Math.PI;
        const r = innerR + (outerR - innerR) * (0.5 + 0.5 * Math.sin(angle));
        points.push(new THREE.Vector2(r, (t - 0.5) * w));
      }
    } else if (design.profile === "knife") {
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const angle = t * Math.PI;
        const bulge = Math.pow(Math.sin(angle), 0.45);
        const r = innerR + (outerR - innerR) * bulge;
        points.push(new THREE.Vector2(r, (t - 0.5) * w));
      }
    } else if (design.profile === "runic") {
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const angle = t * Math.PI;
        const stepped = Math.sin(angle) * 0.7 + Math.sin(angle * 3) * 0.15 + Math.sin(angle * 5) * 0.05;
        const r = innerR + (outerR - innerR) * Math.max(0, stepped);
        points.push(new THREE.Vector2(r, (t - 0.5) * w));
      }
    } else if (design.profile === "cosmic") {
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const angle = t * Math.PI;
        const base = Math.sin(angle);
        const concave = base - 0.08 * Math.sin(angle * 2);
        const r = innerR + (outerR - innerR) * Math.max(0, concave);
        points.push(new THREE.Vector2(r, (t - 0.5) * w));
      }
    } else {
      points.push(new THREE.Vector2(innerR, -w / 2));
      points.push(new THREE.Vector2(outerR - bevel, -w / 2));
      points.push(new THREE.Vector2(outerR, -w / 2 + bevel));
      points.push(new THREE.Vector2(outerR, w / 2 - bevel));
      points.push(new THREE.Vector2(outerR - bevel, w / 2));
      points.push(new THREE.Vector2(innerR, w / 2));
    }

    const segments = 256;
    const lathe = new THREE.LatheGeometry(points, segments);

    // ── Groove carving ──
    if (design.grooves > 0) {
      const posAttr = lathe.attributes.position;
      for (let i = 0; i < posAttr.count; i++) {
        const x = posAttr.getX(i);
        const y = posAttr.getY(i);
        const z = posAttr.getZ(i);
        const r = Math.sqrt(x * x + z * z);
        for (let g = 0; g < design.grooves; g++) {
          const grooveY = ((g + 1) / (design.grooves + 1) - 0.5) * w;
          const dist = Math.abs(y - grooveY);
          const grooveW = 0.018;
          if (dist < grooveW) {
            const depth = (design.grooveDepth / 10) * (1 - dist / grooveW);
            const scale = (r - depth) / r;
            posAttr.setX(i, x * scale);
            posAttr.setZ(i, z * scale);
          }
        }
      }
      posAttr.needsUpdate = true;
    }

    // ── Organic surface perturbation — hand-carved wax feel ──
    {
      const posAttr = lathe.attributes.position;
      let seed = design.id.length * 137;
      const srng = () => { seed = (seed * 16807) % 2147483647; return (seed & 0x7fffffff) / 0x7fffffff; };
      // Pre-seed
      for (let i = 0; i < 50; i++) srng();

      for (let i = 0; i < posAttr.count; i++) {
        const x = posAttr.getX(i);
        const y = posAttr.getY(i);
        const z = posAttr.getZ(i);
        const r = Math.sqrt(x * x + z * z);
        if (r < innerR + 0.005) continue; // don't perturb inner surface

        const angle = Math.atan2(z, x);
        // Multi-frequency organic displacement
        const disp1 = Math.sin(angle * 23 + y * 40) * 0.0008;
        const disp2 = Math.sin(angle * 47 + y * 80 + 1.3) * 0.0004;
        const disp3 = Math.sin(angle * 11 + y * 15) * 0.0012;
        // Random per-vertex micro jitter
        const jitter = (srng() - 0.5) * 0.0006;
        const totalDisp = disp1 + disp2 + disp3 + jitter;

        const scale = (r + totalDisp) / r;
        posAttr.setX(i, x * scale);
        posAttr.setZ(i, z * scale);
      }
      posAttr.needsUpdate = true;
    }

    lathe.computeVertexNormals();
    return lathe;
  }, [design, innerR, outerR, w]);

  const isWax = metal.id === "wax";
  const normalScale = useMemo(() => new THREE.Vector2(
    isWax ? 1.2 : 0.6,
    isWax ? -1.2 : -0.6
  ), [isWax]);

  return (
    <group ref={groupRef}>
      {/* Main ring body — meshPhysicalMaterial for PBR realism */}
      <mesh geometry={geometry} rotation={[Math.PI / 2, 0, 0]} castShadow>
        {isWax ? (
          <meshStandardMaterial
            color="#78A85B"
            roughness={0.82}
            metalness={0.05}
            envMapIntensity={0.3}
            normalMap={castingTex.normalMap}
            normalScale={normalScale}
            roughnessMap={castingTex.roughnessMap}
          />
        ) : (
          <meshPhysicalMaterial
            color={metal.color}
            roughness={metal.roughness}
            metalness={metal.metalness}
            envMapIntensity={metal.envIntensity}
            normalMap={castingTex.normalMap}
            normalScale={normalScale}
            roughnessMap={castingTex.roughnessMap}
            clearcoat={0.3}
            clearcoatRoughness={0.15}
            reflectivity={1.0}
            sheen={0.08}
            sheenRoughness={0.25}
            sheenColor={new THREE.Color(metal.color).multiplyScalar(0.4)}
            ior={2.5}
          />
        )}
      </mesh>

      {/* Inlay channels */}
      {design.inlays.map((inlay, i) => (
        <InlayChannel
          key={`${design.id}-inlay-${i}`}
          inlay={inlay}
          design={design}
          innerR={innerR}
          outerR={outerR}
          ringWidth={w}
          idx={i}
        />
      ))}

      {/* Gemstone settings */}
      {design.stones?.map((stone, i) => (
        <GemStoneGroup
          key={`${design.id}-stone-${i}`}
          stone={stone}
          outerR={outerR}
          metalColor={metal.color}
          isWax={isWax}
          idx={i}
        />
      ))}

      {/* Interior engraving */}
      {design.engraving && (
        <InteriorEngraving
          text={design.engraving}
          innerR={innerR}
          ringWidth={w}
          metalColor={metal.color}
          isWax={isWax}
        />
      )}
    </group>
  );
}

// ── Scene wrapper ────────────────────────────────────────────────

function ShowcaseScene({ design, metal }: { design: RingDesign; metal: MetalDef }) {
  return (
    <>
      <ambientLight intensity={0.08} />
      {/* Key light — warm, high angle for dramatic rim highlights */}
      <directionalLight position={[4, 8, 5]} intensity={2.2} castShadow color="#fff5e6" />
      {/* Fill — cooler, softer, opposite side */}
      <directionalLight position={[-5, 3, -4]} intensity={0.5} color="#c8d8f0" />
      {/* Rim light — catches edges sharply */}
      <spotLight position={[0, 0, 4]} intensity={1.2} angle={0.6} penumbra={0.8} color="#ffffff" />
      {/* Back rim — silhouette edge separation */}
      <pointLight position={[-3, -1, -4]} intensity={0.6} color="#ffa040" />
      {/* Top accent — reveals surface detail and grooves */}
      <pointLight position={[0, 4, 0]} intensity={0.8} color="#ffecd2" />
      {/* Side kicker — adds dimensionality */}
      <pointLight position={[3, -1, 2]} intensity={0.4} color="#e0d4f5" />
      {/* Under-fill — subtle groove/shadow fill */}
      <pointLight position={[0, -3, 2]} intensity={0.15} color="#94a3b8" />

      <ShowcaseRing design={design} metal={metal} />

      <ContactShadows position={[0, -0.7, 0]} opacity={0.6} scale={6} blur={2.8} far={3.5} />
      <Environment preset="city" />
      <OrbitControls
        enablePan={false}
        enableZoom={true}
        autoRotate={false}
        minPolarAngle={Math.PI / 4}
        maxPolarAngle={Math.PI / 1.4}
        minDistance={1.5}
        maxDistance={6}
      />
    </>
  );
}

// ── Badges ───────────────────────────────────────────────────────

function InlayBadge({ inlay }: { inlay: InlayDef }) {
  const icons: Record<string, string> = { crystal: "💎", opal: "🔮", meteorite: "☄️" };
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-medium border"
      style={{ borderColor: inlay.color + "40", backgroundColor: inlay.color + "15", color: inlay.color }}
    >
      <span>{icons[inlay.material]}</span>
      {inlay.name}
    </span>
  );
}

function StoneBadge({ stone }: { stone: StoneSetting }) {
  const icon = stone.shape === "cabochon" ? "🔵" : "💎";
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-medium border"
      style={{ borderColor: stone.color + "40", backgroundColor: stone.color + "15", color: stone.color }}
    >
      <span>{icon}</span>
      {stone.name}
    </span>
  );
}

// ── Main Showcase Component ──────────────────────────────────────

export default function RingShowcase() {
  const navigate = useNavigate();
  const [designIdx, setDesignIdx] = useState(0);
  const [metalIdx, setMetalIdx] = useState(0);

  const design = DESIGNS[designIdx];
  const metal = METALS[metalIdx];

  const prevDesign = useCallback(() => {
    setDesignIdx((i) => (i - 1 + DESIGNS.length) % DESIGNS.length);
  }, []);
  const nextDesign = useCallback(() => {
    setDesignIdx((i) => (i + 1) % DESIGNS.length);
  }, []);

  const hasStones = (design.stones?.length ?? 0) > 0;
  const hasInlays = design.inlays.length > 0;
  const featureCount = design.inlays.length + (design.stones?.length ?? 0);

  return (
    <section className="relative py-16 sm:py-24 bg-forge-dark overflow-hidden">
      {/* Background atmosphere */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-primary/[0.03] rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[300px] h-[300px] bg-accent/[0.02] rounded-full blur-[100px]" />
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-8 sm:mb-12"
        >
          <p className="text-[10px] uppercase tracking-[0.3em] text-primary/70 mb-3 font-body">
            Interactive Showcase
          </p>
          <h2 className="font-display text-2xl sm:text-3xl md:text-4xl mb-3">
            Forged <span className="text-primary">Creations</span>
          </h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto font-body">
            Bespoke rings with gemstone settings, crystal inlays &amp; meteorite channels — rendered live in 3D.
          </p>
        </motion.div>

        {/* Main showcase grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10 items-center">
          {/* 3D Viewport */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative aspect-square max-h-[500px] w-full rounded-2xl overflow-hidden border border-border/50 bg-gradient-to-br from-forge-dark via-card to-forge-dark"
          >
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
              style={{
                backgroundImage: `linear-gradient(hsl(var(--border)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border)) 1px, transparent 1px)`,
                backgroundSize: '40px 40px',
              }}
            />

            <Canvas
              camera={{ position: [0.5, 1.8, 3.2], fov: 32 }}
              shadows
              gl={{ antialias: true, alpha: true }}
              dpr={[1, 2]}
            >
              <ShowcaseScene design={design} metal={metal} />
            </Canvas>

            {/* Metal cycle button */}
            <button
              onClick={() => setMetalIdx((i) => (i + 1) % METALS.length)}
              className="absolute bottom-4 right-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-card/80 backdrop-blur-md border border-border/50 hover:border-primary/40 transition-all group"
            >
              <div
                className="w-4 h-4 rounded-full border border-border/50 shadow-inner transition-colors"
                style={{ backgroundColor: metal.color }}
              />
              <span className="text-[11px] font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                {metal.label}
              </span>
            </button>

            {/* Interaction hint */}
            <div className="absolute bottom-4 left-4 px-2 py-1 rounded-md bg-card/60 backdrop-blur-sm border border-border/30">
              <span className="text-[9px] text-muted-foreground/70">
                Drag to orbit · Scroll to zoom · See inside engraving
              </span>
            </div>

            {/* Design counter */}
            <div className="absolute top-4 left-4 px-2 py-1 rounded-md bg-card/60 backdrop-blur-sm border border-border/30">
              <span className="text-[10px] font-mono text-muted-foreground">
                {String(designIdx + 1).padStart(2, '0')}/{String(DESIGNS.length).padStart(2, '0')}
              </span>
            </div>

            {/* Feature indicator */}
            {featureCount > 0 && (
              <div className="absolute top-4 right-4 flex items-center gap-1 px-2 py-1 rounded-md bg-card/60 backdrop-blur-sm border border-border/30">
                {hasStones && <Diamond className="w-3 h-3 text-primary/70" />}
                {hasInlays && <Gem className="w-3 h-3 text-primary/70" />}
                <span className="text-[10px] text-muted-foreground">
                  {hasStones && `${design.stones!.length} stone${design.stones!.length > 1 ? "s" : ""}`}
                  {hasStones && hasInlays && " · "}
                  {hasInlays && `${design.inlays.length} inlay${design.inlays.length > 1 ? "s" : ""}`}
                </span>
              </div>
            )}
          </motion.div>

          {/* Design info panel */}
          <div className="flex flex-col gap-5">
            {/* Navigation arrows + name */}
            <div className="flex items-center gap-3">
              <button
                onClick={prevDesign}
                className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <AnimatePresence mode="wait">
                <motion.div
                  key={design.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25 }}
                  className="flex-1 min-w-0"
                >
                  <h3 className="font-display text-xl sm:text-2xl text-foreground leading-tight">
                    {design.name}
                  </h3>
                  <p className="text-xs text-primary/80 font-body mt-0.5 tracking-wide">
                    {design.tagline}
                  </p>
                </motion.div>
              </AnimatePresence>

              <button
                onClick={nextDesign}
                className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Lore */}
            <AnimatePresence mode="wait">
              <motion.p
                key={design.id + "-lore"}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3, delay: 0.05 }}
                className="text-sm text-muted-foreground font-body leading-relaxed"
              >
                {design.lore}
              </motion.p>
            </AnimatePresence>

            {/* Stone settings */}
            {hasStones && (
              <AnimatePresence mode="wait">
                <motion.div
                  key={design.id + "-stones"}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-1.5"
                >
                  <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/70 flex items-center gap-1.5">
                    <Diamond className="w-3 h-3" /> Gemstone Settings
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {design.stones!.map((stone, i) => (
                      <StoneBadge key={i} stone={stone} />
                    ))}
                  </div>
                </motion.div>
              </AnimatePresence>
            )}

            {/* Inlay materials */}
            {hasInlays && (
              <AnimatePresence mode="wait">
                <motion.div
                  key={design.id + "-inlays"}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-1.5"
                >
                  <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/70 flex items-center gap-1.5">
                    <Gem className="w-3 h-3" /> Inlay Materials
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {design.inlays.map((inlay, i) => (
                      <InlayBadge key={i} inlay={inlay} />
                    ))}
                  </div>
                </motion.div>
              </AnimatePresence>
            )}

            {/* Interior engraving */}
            {design.engraving && (
              <AnimatePresence mode="wait">
                <motion.div
                  key={design.id + "-engraving"}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-1.5"
                >
                  <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/70 flex items-center gap-1.5">
                    ✒️ Interior Engraving
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-[11px] font-mono tracking-wider border border-primary/20 bg-primary/5 text-primary/90">
                      {design.engraving}
                    </span>
                  </div>
                  <p className="text-[9px] text-muted-foreground/60 italic">
                    Zoom in and rotate to see the 3D engraving on the inner bore
                  </p>
                </motion.div>
              </AnimatePresence>
            )}

            {/* Specs grid */}
            <AnimatePresence mode="wait">
              <motion.div
                key={design.id + "-specs"}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, delay: 0.1 }}
                className="grid grid-cols-3 gap-2.5"
              >
                {[
                  { label: "Width", value: `${design.width}mm` },
                  { label: "Thickness", value: `${design.thickness}mm` },
                  { label: "Profile", value: design.profile },
                  { label: "Grooves", value: String(design.grooves) },
                  { label: "Stones", value: String(design.stones?.length ?? 0) },
                  { label: "Metal", value: metal.label },
                  { label: "Engraving", value: design.engraving ? "Yes" : "No" },
                  { label: "Inlays", value: String(design.inlays.length) },
                  { label: "Castable", value: "✓" },
                ].map((spec) => (
                  <div key={spec.label} className="p-2 rounded-lg bg-card/50 border border-border/50">
                    <p className="text-[9px] uppercase tracking-wider text-muted-foreground/70 mb-0.5">{spec.label}</p>
                    <p className="text-xs font-medium text-foreground capitalize">{spec.value}</p>
                  </div>
                ))}
              </motion.div>
            </AnimatePresence>

            {/* Metal swatches */}
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/70">
                Select Metal
              </p>
              <div className="flex gap-2">
                {METALS.map((m, i) => (
                  <button
                    key={m.id}
                    onClick={() => setMetalIdx(i)}
                    className={cn(
                      "w-8 h-8 rounded-full border-2 transition-all hover:scale-110",
                      metalIdx === i
                        ? "border-primary shadow-[0_0_12px_hsl(25_95%_53%/0.4)] scale-110"
                        : "border-border/50 hover:border-border"
                    )}
                    style={{ backgroundColor: m.color }}
                    title={m.label}
                  />
                ))}
              </div>
            </div>

            {/* CTA */}
            <div className="flex gap-3 pt-1">
              <Button
                onClick={() => navigate("/builder")}
                className="bg-primary text-primary-foreground hover:bg-ember-glow px-6 font-display tracking-wider text-xs"
              >
                <Sparkles className="w-3.5 h-3.5 mr-2" />
                Build Your Own
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate("/templates")}
                className="border-border text-muted-foreground hover:text-foreground hover:bg-secondary text-xs"
              >
                Browse Templates
              </Button>
            </div>
          </div>
        </div>

        {/* Design thumbnails strip */}
        <div className="mt-8 sm:mt-12 flex gap-2 sm:gap-3 justify-center flex-wrap">
          {DESIGNS.map((d, i) => {
            const stoneNames = d.stones?.map((s) => s.name) ?? [];
            const inlayNames = d.inlays.map((il) => il.name);
            const allNames = [...new Set([...stoneNames, ...inlayNames])];
            return (
              <button
                key={d.id}
                onClick={() => setDesignIdx(i)}
                className={cn(
                  "px-3 py-2 rounded-lg border text-left transition-all min-w-[120px]",
                  designIdx === i
                    ? "border-primary/50 bg-primary/5"
                    : "border-border/50 bg-card/30 hover:border-border hover:bg-card/50"
                )}
              >
                <p className={cn(
                  "text-[11px] font-display leading-tight transition-colors",
                  designIdx === i ? "text-primary" : "text-foreground/70"
                )}>
                  {d.name}
                </p>
                <p className="text-[9px] text-muted-foreground/60 mt-0.5">
                  {allNames.length > 0 ? allNames.join(" · ") : d.profile}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
