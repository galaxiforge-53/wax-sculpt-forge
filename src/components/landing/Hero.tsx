import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { Environment, OrbitControls, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";

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

// ── Hero Ring 3D — loaded from STL file ──────────────────────────

function HeroRingMesh() {
  const groupRef = useRef<THREE.Group>(null);
  const geometry = useLoader(STLLoader, "/models/Ring_8_mm-2.stl");

  const processedGeo = useMemo(() => {
    const geo = geometry.clone();
    geo.computeVertexNormals();
    geo.computeBoundingBox();
    
    // Center the geometry
    const box = geo.boundingBox!;
    const center = new THREE.Vector3();
    box.getCenter(center);
    geo.translate(-center.x, -center.y, -center.z);
    
    // Scale to fit nicely in the scene (normalize to ~2 units)
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 2.0 / maxDim;
    geo.scale(scale, scale, scale);
    
    return geo;
  }, [geometry]);

  // Slow auto-rotation, tilted 45° with top of ring upward
  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.getElapsedTime();
    groupRef.current.rotation.y = t * 0.15;
    groupRef.current.rotation.x = Math.PI * 0.25; // 45° tilt — top of ring faces viewer
    groupRef.current.rotation.z = 0.1; // slight lean for drama
  });

  return (
    <group ref={groupRef}>
      <mesh geometry={processedGeo} castShadow receiveShadow>
        <meshPhysicalMaterial
          color="#C8A83E"
          roughness={0.15}
          metalness={1.0}
          envMapIntensity={3.5}
          clearcoat={0.25}
          clearcoatRoughness={0.1}
          reflectivity={1.0}
          ior={2.5}
          sheen={0.05}
          sheenColor="#FFD700"
        />
      </mesh>
    </group>
  );
}

function HeroScene() {
  return (
    <>
      <ambientLight intensity={0.08} />
      <directionalLight position={[5, 8, 5]} intensity={2.5} color="#fff5e6" castShadow />
      <directionalLight position={[-4, 3, -3]} intensity={0.6} color="#c8d8f0" />
      <spotLight position={[0, 0, 5]} intensity={1.5} angle={0.5} penumbra={0.8} color="#ffffff" />
      <pointLight position={[-3, -1, -3]} intensity={0.6} color="#ffa040" />
      <pointLight position={[3, 4, 0]} intensity={0.8} color="#ffecd2" />
      <pointLight position={[0, -3, 2]} intensity={0.3} color="#ff8c00" />
      <HeroRingMesh />
      <ContactShadows position={[0, -1.2, 0]} opacity={0.35} scale={5} blur={2.5} far={4} />
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

      {/* 3D Hero Ring — centered, full-width, interactive */}
      <div className="absolute inset-0 z-[3] flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.5, delay: 0.3, ease: "easeOut" }}
          className="w-full h-full max-w-[600px] sm:max-w-none mx-auto"
        >
      <Canvas
            camera={{ position: [0, 1.5, 3.0], fov: 36 }}
            gl={{ antialias: true, alpha: true }}
            dpr={[1, 2]}
          >
            <HeroScene />
            <OrbitControls
              enablePan={false}
              enableZoom={true}
              autoRotate
              autoRotateSpeed={0.8}
              minDistance={2}
              maxDistance={7}
              minPolarAngle={Math.PI / 4}
              maxPolarAngle={Math.PI / 1.3}
            />
          </Canvas>
        </motion.div>
        {/* Subtle vignette — minimal so ring stays visible and centered */}
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-background/20 pointer-events-none" />
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
