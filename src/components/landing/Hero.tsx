import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import * as THREE from "three";

// Pre-generate ember particles to avoid re-renders
function useEmbers(count: number) {
  return useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      left: 5 + Math.random() * 90,
      bottom: -5 + Math.random() * 25,
      size: 1 + Math.random() * 3,
      blur: Math.random() > 0.6 ? 2 : 0,
      yTravel: 250 + Math.random() * 500,
      xDrift: (Math.random() - 0.5) * 80,
      duration: 3 + Math.random() * 6,
      delay: Math.random() * 8,
      peak: 0.4 + Math.random() * 0.6,
      color: Math.random() > 0.3
        ? `hsl(${20 + Math.random() * 20}, 95%, ${50 + Math.random() * 20}%)`
        : `hsl(${35 + Math.random() * 15}, 100%, ${55 + Math.random() * 15}%)`,
    }));
  }, [count]);
}

// ── Seeded RNG ────────────────────────────────────────────────────

function seededRng(seed: number) {
  let s = seed | 0 || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s & 0x7fffffff) / 0x7fffffff;
  };
}

// ── Perlin-like 2D noise ──────────────────────────────────────────

function makeNoise2D(seed: number) {
  const rng = seededRng(seed);
  const SIZE = 256;
  const perm = new Uint8Array(SIZE * 2);
  const grad: number[][] = [];
  for (let i = 0; i < SIZE; i++) {
    perm[i] = i;
    const angle = rng() * Math.PI * 2;
    grad.push([Math.cos(angle), Math.sin(angle)]);
  }
  for (let i = SIZE - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  for (let i = 0; i < SIZE; i++) perm[SIZE + i] = perm[i];

  function fade(t: number) { return t * t * t * (t * (t * 6 - 15) + 10); }
  function lerp(a: number, b: number, t: number) { return a + t * (b - a); }
  function dot2(g: number[], x: number, y: number) { return g[0] * x + g[1] * y; }

  return (x: number, y: number): number => {
    const xi = Math.floor(x) & 255;
    const yi = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = fade(xf);
    const v = fade(yf);
    const aa = perm[perm[xi] + yi] & 255;
    const ab = perm[perm[xi] + yi + 1] & 255;
    const ba = perm[perm[xi + 1] + yi] & 255;
    const bb = perm[perm[xi + 1] + yi + 1] & 255;
    return lerp(
      lerp(dot2(grad[aa], xf, yf), dot2(grad[ba], xf - 1, yf), u),
      lerp(dot2(grad[ab], xf, yf - 1), dot2(grad[bb], xf - 1, yf - 1), u),
      v
    );
  };
}

// ── Build lunar heightmap with multi-tier craters ─────────────────

interface CraterTier {
  count: number;
  minR: number;
  maxR: number;
  depth: number;
  rimHeight: number;
  hasCentralPeak: boolean;
  hasEjecta: boolean;
  hasTerraces: boolean;
}

function buildLunarHeightmap(w: number, h: number, seed: number): Float32Array {
  const hmap = new Float32Array(w * h);
  const rng = seededRng(seed);
  const noise = makeNoise2D(seed + 7);

  // Base terrain: multi-octave fractal noise (highland/mare topography)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = x / w;
      const v = y / h;
      let val = 0;
      val += noise(u * 6, v * 4) * 0.3;
      val += noise(u * 12 + 3.7, v * 8 + 1.2) * 0.15;
      val += noise(u * 24 + 7.1, v * 16 + 4.5) * 0.08;
      val += noise(u * 48 + 13.3, v * 32 + 9.8) * 0.04;
      val += noise(u * 96 + 21.0, v * 64 + 15.0) * 0.02;
      hmap[y * w + x] = val * 0.5;
    }
  }

  // 5-tier crater distribution (Mega → Micro)
  const tiers: CraterTier[] = [
    { count: 2,   minR: 40, maxR: 70, depth: 0.45, rimHeight: 0.18, hasCentralPeak: true,  hasEjecta: true,  hasTerraces: true },
    { count: 5,   minR: 20, maxR: 40, depth: 0.35, rimHeight: 0.14, hasCentralPeak: true,  hasEjecta: true,  hasTerraces: true },
    { count: 15,  minR: 10, maxR: 22, depth: 0.28, rimHeight: 0.10, hasCentralPeak: false, hasEjecta: true,  hasTerraces: false },
    { count: 40,  minR: 4,  maxR: 12, depth: 0.20, rimHeight: 0.06, hasCentralPeak: false, hasEjecta: false, hasTerraces: false },
    { count: 120, minR: 1,  maxR: 5,  depth: 0.12, rimHeight: 0.03, hasCentralPeak: false, hasEjecta: false, hasTerraces: false },
  ];

  for (const tier of tiers) {
    for (let c = 0; c < tier.count; c++) {
      const cx = Math.floor(rng() * w);
      const cy = Math.floor(rng() * h);
      const radius = tier.minR + rng() * (tier.maxR - tier.minR);
      const depth = tier.depth * (0.7 + rng() * 0.6);
      const rimH = tier.rimHeight * (0.6 + rng() * 0.8);
      const ellipticity = 0.85 + rng() * 0.3;
      const rotAngle = rng() * Math.PI;
      const cosA = Math.cos(rotAngle);
      const sinA = Math.sin(rotAngle);

      // Central peak params
      const peakHeight = tier.hasCentralPeak ? depth * (0.25 + rng() * 0.2) : 0;
      const peakRadius = radius * (0.12 + rng() * 0.08);

      // Terraced walls
      const terraceCount = tier.hasTerraces ? 2 + Math.floor(rng() * 2) : 0;

      const rr = Math.ceil(radius * 1.8);

      for (let dy = -rr; dy <= rr; dy++) {
        for (let dx = -rr; dx <= rr; dx++) {
          // Rotate for ellipticity
          const lx = cosA * dx + sinA * dy;
          const ly = -sinA * dx + cosA * dy;
          const dist = Math.sqrt((lx * lx) + (ly * ly) / (ellipticity * ellipticity));

          if (dist > radius * 1.8) continue;

          const px = ((cx + dx) % w + w) % w;
          const py = Math.max(0, Math.min(h - 1, cy + dy));
          const idx = py * w + px;

          const normDist = dist / radius;

          if (normDist <= 1.0) {
            // Inside crater bowl
            let bowlProfile: number;
            if (normDist < 0.15 && tier.hasCentralPeak) {
              // Central peak
              const peakDist = normDist / 0.15;
              bowlProfile = -depth * 0.4 + peakHeight * (1 - peakDist * peakDist);
            } else {
              // Parabolic bowl with optional terraces
              bowlProfile = -depth * normDist * normDist;

              // Add terraces
              if (terraceCount > 0 && normDist > 0.3 && normDist < 0.9) {
                const terracePhase = normDist * terraceCount * Math.PI;
                const terrace = Math.sin(terracePhase) * depth * 0.06;
                bowlProfile += terrace;
              }
            }

            // Crater rim (raised lip near edge)
            const rimFactor = Math.pow(normDist, 8);
            bowlProfile += rimH * rimFactor;

            hmap[idx] += bowlProfile;
          } else if (normDist <= 1.8) {
            // Rim and ejecta blanket
            const rimDist = (normDist - 1.0) / 0.8;
            const rimProfile = rimH * Math.exp(-rimDist * 3);

            // Ejecta rays
            let ejecta = 0;
            if (tier.hasEjecta && rimDist < 0.6) {
              const angle = Math.atan2(ly, lx);
              const rayCount = 5 + Math.floor(rng() * 4);
              ejecta = Math.pow(Math.abs(Math.sin(angle * rayCount * 0.5)), 3) * rimH * 0.3 * (1 - rimDist);
            }

            hmap[idx] += rimProfile + ejecta;
          }
        }
      }

      // Secondary impacts around large craters
      if (tier.hasEjecta && radius > 15) {
        const secondaryCount = 3 + Math.floor(rng() * 5);
        for (let s = 0; s < secondaryCount; s++) {
          const sAngle = rng() * Math.PI * 2;
          const sDist = radius * (1.3 + rng() * 0.8);
          const sx = Math.round(cx + Math.cos(sAngle) * sDist);
          const sy = Math.round(cy + Math.sin(sAngle) * sDist);
          const sRadius = 1 + rng() * 3;
          const sDepth = depth * 0.08;

          for (let dy2 = -Math.ceil(sRadius); dy2 <= Math.ceil(sRadius); dy2++) {
            for (let dx2 = -Math.ceil(sRadius); dx2 <= Math.ceil(sRadius); dx2++) {
              const d2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
              if (d2 > sRadius) continue;
              const spx = ((sx + dx2) % w + w) % w;
              const spy = Math.max(0, Math.min(h - 1, sy + dy2));
              const norm2 = d2 / sRadius;
              hmap[spy * w + spx] -= sDepth * (1 - norm2 * norm2);
            }
          }
        }
      }
    }
  }

  // Normalize to 0–1
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < hmap.length; i++) {
    if (hmap[i] < min) min = hmap[i];
    if (hmap[i] > max) max = hmap[i];
  }
  const range = max - min || 1;
  for (let i = 0; i < hmap.length; i++) {
    hmap[i] = (hmap[i] - min) / range;
  }

  return hmap;
}

// ── Generate textures from heightmap ──────────────────────────────

function useLunarTextures() {
  return useMemo(() => {
    const W = 1024;
    const H = 256;
    const hmap = buildLunarHeightmap(W, H, 4207);

    // Normal map from heightmap
    const normalData = new Uint8Array(W * H * 4);
    const strength = 3.0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = y * W + x;
        const xn = ((x - 1) + W) % W;
        const xp = (x + 1) % W;
        const yn = Math.max(0, y - 1);
        const yp = Math.min(H - 1, y + 1);
        const dhdx = (hmap[y * W + xp] - hmap[y * W + xn]) * strength;
        const dhdy = (hmap[yp * W + x] - hmap[yn * W + x]) * strength;
        const len = Math.sqrt(dhdx * dhdx + dhdy * dhdy + 1);
        normalData[idx * 4]     = Math.round(((-dhdx / len) * 0.5 + 0.5) * 255);
        normalData[idx * 4 + 1] = Math.round(((dhdy / len) * 0.5 + 0.5) * 255);
        normalData[idx * 4 + 2] = Math.round(((1 / len) * 0.5 + 0.5) * 255);
        normalData[idx * 4 + 3] = 255;
      }
    }

    const normalTex = new THREE.DataTexture(normalData, W, H, THREE.RGBAFormat);
    normalTex.wrapS = THREE.RepeatWrapping;
    normalTex.wrapT = THREE.ClampToEdgeWrapping;
    normalTex.needsUpdate = true;

    // Roughness map: craters = smoother inside, rough at rims
    const roughData = new Uint8Array(W * H * 4);
    for (let i = 0; i < W * H; i++) {
      // Low areas (craters) are slightly smoother, high areas rougher
      const h = hmap[i];
      const rough = Math.round((0.35 + h * 0.45) * 255);
      roughData[i * 4] = rough;
      roughData[i * 4 + 1] = rough;
      roughData[i * 4 + 2] = rough;
      roughData[i * 4 + 3] = 255;
    }

    const roughTex = new THREE.DataTexture(roughData, W, H, THREE.RGBAFormat);
    roughTex.wrapS = THREE.RepeatWrapping;
    roughTex.wrapT = THREE.ClampToEdgeWrapping;
    roughTex.needsUpdate = true;

    // Displacement map
    const dispData = new Uint8Array(W * H * 4);
    for (let i = 0; i < W * H; i++) {
      const v = Math.round(hmap[i] * 255);
      dispData[i * 4] = v;
      dispData[i * 4 + 1] = v;
      dispData[i * 4 + 2] = v;
      dispData[i * 4 + 3] = 255;
    }

    const dispTex = new THREE.DataTexture(dispData, W, H, THREE.RGBAFormat);
    dispTex.wrapS = THREE.RepeatWrapping;
    dispTex.wrapT = THREE.ClampToEdgeWrapping;
    dispTex.needsUpdate = true;

    return { normalTex, roughTex, dispTex, hmap, W, H };
  }, []);
}

// ── Hero Ring 3D with baked lunar displacement ────────────────────

function HeroRingMesh() {
  const groupRef = useRef<THREE.Group>(null);
  const { normalTex, roughTex, hmap, W, H } = useLunarTextures();

  const geometry = useMemo(() => {
    const innerR = 0.85;
    const outerR = 1.07;
    const w = 0.8;
    const profileSteps = 128;
    const radialSteps = 256;
    const points: THREE.Vector2[] = [];

    for (let i = 0; i <= profileSteps; i++) {
      const t = i / profileSteps;
      const angle = t * Math.PI;
      const r = innerR + (outerR - innerR) * (0.5 + 0.5 * Math.sin(angle));
      points.push(new THREE.Vector2(r, (t - 0.5) * w));
    }

    const lathe = new THREE.LatheGeometry(points, radialSteps);
    const posAttr = lathe.attributes.position;
    const uvAttr = lathe.attributes.uv;

    // Bake lunar heightmap displacement into outer surface vertices
    const displacementScale = 0.018;
    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      const y = posAttr.getY(i);
      const z = posAttr.getZ(i);
      const r = Math.sqrt(x * x + z * z);

      // Only displace outer surface (not inner bore)
      if (r < innerR + 0.02) continue;

      const u = uvAttr.getX(i);
      const v = uvAttr.getY(i);

      // Sample heightmap with bilinear interpolation
      const fx = u * W;
      const fy = v * H;
      const ix = Math.floor(fx) % W;
      const iy = Math.min(Math.floor(fy), H - 1);
      const ix1 = (ix + 1) % W;
      const iy1 = Math.min(iy + 1, H - 1);
      const fracX = fx - Math.floor(fx);
      const fracY = fy - Math.floor(fy);

      const h00 = hmap[iy * W + ix];
      const h10 = hmap[iy * W + ix1];
      const h01 = hmap[iy1 * W + ix];
      const h11 = hmap[iy1 * W + ix1];
      const heightVal = h00 * (1 - fracX) * (1 - fracY)
                      + h10 * fracX * (1 - fracY)
                      + h01 * (1 - fracX) * fracY
                      + h11 * fracX * fracY;

      // Displace along radial direction (outward)
      const disp = (heightVal - 0.5) * displacementScale;
      const scale = (r + disp) / r;
      posAttr.setX(i, x * scale);
      posAttr.setZ(i, z * scale);
    }

    posAttr.needsUpdate = true;
    lathe.computeVertexNormals();
    return lathe;
  }, [hmap, W, H]);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.getElapsedTime();
    groupRef.current.rotation.y = t * 0.12;
    groupRef.current.rotation.x = Math.sin(t * 0.2) * 0.12;
    groupRef.current.rotation.z = Math.sin(t * 0.15 + 0.5) * 0.06;
  });

  return (
    <group ref={groupRef}>
      <mesh geometry={geometry} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <meshPhysicalMaterial
          color="#D4A520"
          roughness={0.12}
          metalness={1.0}
          envMapIntensity={3.5}
          clearcoat={0.3}
          clearcoatRoughness={0.15}
          reflectivity={1.0}
          ior={2.5}
          normalMap={normalTex}
          normalScale={new THREE.Vector2(1.5, 1.5)}
          roughnessMap={roughTex}
        />
      </mesh>
    </group>
  );
}

function HeroScene() {
  return (
    <>
      <ambientLight intensity={0.05} />
      <directionalLight position={[4, 8, 5]} intensity={2.0} color="#fff5e6" />
      <directionalLight position={[-4, 2, -3]} intensity={0.4} color="#c8d8f0" />
      <spotLight position={[0, 0, 4]} intensity={1.0} angle={0.6} penumbra={0.8} color="#ffffff" />
      <pointLight position={[-2, -1, -3]} intensity={0.5} color="#ffa040" />
      <pointLight position={[0, 4, 0]} intensity={0.6} color="#ffecd2" />
      <HeroRingMesh />
      <Environment preset="city" />
    </>
  );
}

export default function Hero() {
  const navigate = useNavigate();
  const embers = useEmbers(30);

  return (
    <section
      className="relative min-h-[85vh] sm:min-h-[90vh] flex items-center justify-center overflow-hidden cosmic-noise starfield"
      aria-label="Hero section showcasing a lunar-textured ring"
    >
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-forge-dark via-background to-background" />

      {/* Warm fire glow at the bottom */}
      <div className="absolute inset-x-0 bottom-0 h-[45%] pointer-events-none z-[1]">
        <div className="absolute inset-x-0 bottom-0 h-full bg-gradient-to-t from-[hsl(20_90%_12%/0.35)] via-[hsl(25_95%_25%/0.12)] to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[hsl(15_95%_45%/0.15)] to-transparent animate-flicker" />
        {/* Glowing hearth line */}
        <div className="absolute inset-x-[10%] bottom-0 h-[2px] bg-gradient-to-r from-transparent via-[hsl(25_95%_53%/0.5)] to-transparent blur-[1px]" />
      </div>

      {/* Cosmic nebula glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-48 sm:w-96 h-48 sm:h-96 bg-primary/[0.04] rounded-full blur-[80px] sm:blur-[120px]" />
        <div className="absolute bottom-1/3 right-1/4 w-36 sm:w-72 h-36 sm:h-72 bg-accent/[0.03] rounded-full blur-[60px] sm:blur-[100px]" />
      </div>

      {/* Ember particles — dense, varied, fire-like */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-[2]">
        {embers.map((e) => (
          <motion.div
            key={e.id}
            className="absolute rounded-full"
            style={{
              left: `${e.left}%`,
              bottom: `${e.bottom}%`,
              width: e.size,
              height: e.size,
              backgroundColor: e.color,
              filter: e.blur ? `blur(${e.blur}px)` : undefined,
              boxShadow: `0 0 ${3 + e.size}px ${e.color}`,
            }}
            animate={{
              y: [0, -e.yTravel],
              x: [0, e.xDrift],
              opacity: [0, e.peak, e.peak * 0.8, 0],
              scale: [0.4, 1, 0.6, 0.2],
            }}
            transition={{
              duration: e.duration,
              repeat: Infinity,
              delay: e.delay,
              ease: "easeOut",
            }}
          />
        ))}
      </div>

      {/* 3D Hero Ring — floating behind/beside the text */}
      <div className="absolute inset-0 z-[3] pointer-events-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.5, delay: 0.3, ease: "easeOut" }}
          className="absolute inset-0"
        >
          <Canvas
            camera={{ position: [0, 0.6, 2.6], fov: 32 }}
            gl={{ antialias: true, alpha: true }}
            dpr={[1, 2]}
            style={{ pointerEvents: "none" }}
          >
            <HeroScene />
          </Canvas>
        </motion.div>
        {/* Subtle vignette — keep ring visible */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/40" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/50 via-transparent to-background/50" />
      </div>

      <div className="relative z-10 text-center px-5 sm:px-6 max-w-3xl">
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-[10px] uppercase tracking-[0.3em] sm:tracking-[0.4em] text-primary/80 mb-6 sm:mb-8 font-body"
        >
          ForgeLab · Powered by GalaxiForge
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="font-display text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-bold leading-[1.1] ember-text"
        >
          Carve Your Wax.
          <br />
          <span className="text-primary">We Forge the Ring.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-6 sm:mt-8 text-sm sm:text-base text-muted-foreground max-w-md mx-auto font-body leading-relaxed"
        >
          Sculpt a custom ring in digital wax, preview it in metal, and send it straight
          to the forge for precision casting.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-8 sm:mt-12 flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center"
        >
          <Button
            size="lg"
            onClick={() => navigate("/builder")}
            className="bg-primary text-primary-foreground hover:bg-ember-glow px-8 sm:px-10 py-5 sm:py-6 text-sm font-display tracking-[0.15em] animate-ember-pulse"
          >
            Start Carving
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() => navigate("/builders")}
            className="border-border text-foreground hover:bg-secondary px-6 sm:px-8 py-5 sm:py-6 text-sm font-body"
          >
            Explore Builders
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
