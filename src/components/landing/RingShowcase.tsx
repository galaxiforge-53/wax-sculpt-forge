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
  { id: "silver", label: "Silver", color: "#C0C0C0", roughness: 0.12, metalness: 0.95, envIntensity: 1.6 },
  { id: "gold", label: "Gold", color: "#FFD700", roughness: 0.1, metalness: 0.98, envIntensity: 1.8 },
  { id: "rose-gold", label: "Rose Gold", color: "#E8A090", roughness: 0.15, metalness: 0.92, envIntensity: 1.5 },
  { id: "titanium", label: "Titanium", color: "#878681", roughness: 0.2, metalness: 0.88, envIntensity: 1.3 },
  { id: "tungsten", label: "Tungsten", color: "#555555", roughness: 0.08, metalness: 0.97, envIntensity: 1.4 },
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

// ── Meteorite Widmanstätten texture ──────────────────────────────

function useMeteoriteTexture(seed: number) {
  return useMemo(() => {
    const size = 128;
    const data = new Uint8Array(size * size * 4);
    let s = seed | 0 || 1;
    const rng = () => { s = (s * 16807) % 2147483647; return (s & 0x7fffffff) / 0x7fffffff; };

    for (let i = 0; i < size * size; i++) {
      const v = 140 + rng() * 30;
      data[i * 4] = v;
      data[i * 4 + 1] = v;
      data[i * 4 + 2] = v;
      data[i * 4 + 3] = 255;
    }

    const lineCount = 8 + Math.floor(rng() * 8);
    for (let l = 0; l < lineCount; l++) {
      const angle = rng() * Math.PI;
      const cx = rng() * size;
      const cy = rng() * size;
      const length = 20 + rng() * 60;
      const width = 1 + rng() * 2;
      const brightness = 180 + rng() * 50;

      for (let t = -length / 2; t < length / 2; t += 0.5) {
        for (let w2 = -width; w2 <= width; w2 += 0.5) {
          const px = Math.round(cx + Math.cos(angle) * t + Math.cos(angle + Math.PI / 2) * w2);
          const py = Math.round(cy + Math.sin(angle) * t + Math.sin(angle + Math.PI / 2) * w2);
          if (px >= 0 && px < size && py >= 0 && py < size) {
            const idx = (py * size + px) * 4;
            const falloff = 1 - Math.abs(w2) / width;
            const v = data[idx] * (1 - falloff * 0.4) + brightness * falloff * 0.4;
            data[idx] = v;
            data[idx + 1] = v;
            data[idx + 2] = v;
          }
        }
      }
    }

    const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 1);
    tex.needsUpdate = true;
    return tex;
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
        <meshStandardMaterial
          color={inlay.color}
          emissive={inlay.emissive}
          emissiveIntensity={inlay.emissiveIntensity}
          roughness={inlay.roughness}
          metalness={inlay.metalness}
          transparent
          opacity={inlay.opacity}
          envMapIntensity={inlay.material === "opal" ? 3.0 : inlay.material === "crystal" ? 2.5 : 1.0}
          map={inlay.material === "meteorite" ? meteorTex : null}
        />
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
          <sphereGeometry args={[stoneR, 32, 24]} />
          <meshStandardMaterial
            color={stone.color}
            emissive={stone.emissive}
            emissiveIntensity={stone.emissiveIntensity}
            roughness={0.04}
            metalness={0.02}
            transparent
            opacity={stone.opacity}
            envMapIntensity={3.5}
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
          <octahedronGeometry args={[stoneR, 1]} />
          <meshStandardMaterial
            color={stone.color}
            emissive={stone.emissive}
            emissiveIntensity={stone.emissiveIntensity}
            roughness={0.02}
            metalness={0.03}
            transparent
            opacity={stone.opacity}
            envMapIntensity={4.0}
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

// ── 3D Ring Mesh ─────────────────────────────────────────────────

function ShowcaseRing({ design, metal }: { design: RingDesign; metal: MetalDef }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.25;
    }
  });

  const innerR = 0.85;
  const outerR = innerR + design.thickness / 10;
  const w = design.width / 10;

  const geometry = useMemo(() => {
    const bevel = design.bevel / 10;
    const points: THREE.Vector2[] = [];
    const steps = 64;

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

    const lathe = new THREE.LatheGeometry(points, 128);

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

    lathe.computeVertexNormals();
    return lathe;
  }, [design, innerR, outerR, w]);

  const isWax = metal.id === "wax";

  return (
    <group ref={groupRef}>
      {/* Main ring body */}
      <mesh geometry={geometry} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <meshStandardMaterial
          color={metal.color}
          roughness={isWax ? 0.85 : metal.roughness}
          metalness={isWax ? 0.05 : metal.metalness}
          envMapIntensity={isWax ? 0.2 : metal.envIntensity}
        />
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
    </group>
  );
}

// ── Scene wrapper ────────────────────────────────────────────────

function ShowcaseScene({ design, metal }: { design: RingDesign; metal: MetalDef }) {
  return (
    <>
      <ambientLight intensity={0.2} />
      <directionalLight position={[4, 5, 5]} intensity={1.6} castShadow color="#ffffff" />
      <directionalLight position={[-3, 2, -4]} intensity={0.5} color="#ff8c00" />
      <pointLight position={[0, 0, 3]} intensity={0.6} color="#ffffff" />
      <pointLight position={[2, -1, -3]} intensity={0.4} color="#e879f9" />
      <pointLight position={[-2, 1, 2]} intensity={0.35} color="#38bdf8" />
      <pointLight position={[0, 2, 0]} intensity={0.3} color="#fbbf24" />

      <ShowcaseRing design={design} metal={metal} />

      <ContactShadows position={[0, -0.7, 0]} opacity={0.5} scale={4} blur={2} far={3} />
      <Environment preset="studio" />
      <OrbitControls
        enablePan={false}
        enableZoom={false}
        autoRotate={false}
        minPolarAngle={Math.PI / 3}
        maxPolarAngle={Math.PI / 1.8}
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
              camera={{ position: [0, 1.5, 3.5], fov: 35 }}
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
