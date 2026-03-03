

## Lunar Texture System Expansion

### What Changes

**1. Expanded State Model** (`src/types/lunar.ts`)
Add 5 new parameters: `rimHeight` (0-100), `bowlDepth` (0-100), `erosion` (0-100), `terrainRoughness` (0-100), and `craterVariation` (0-100). These give independent control over protruding rims vs carved bowls, weathering effects, base landscape bumpiness, and how varied each crater looks.

**2. Overhauled Crater Engine** (`src/lib/lunarSurfaceMaps.ts`)
- **5-tier crater distribution** instead of 3: Mega (1-3), Hero (3-8), Medium (15-50), Small (40-200), Micro-pits (hundreds). Real lunar power-law.
- **Central peaks** inside mega/hero craters (like Tycho) — a small mound rises from the bowl center.
- **Terraced inner walls** on large craters — stepped concentric rings inside the bowl.
- **Ejecta rays** — radial streaks extending outward from large impacts, brightening the heightmap along ray paths.
- **Secondary impact chains** — small craters clustered along ejecta ray lines.
- **Erosion pass** — blurs/softens older (larger) craters while keeping fresh (smaller) ones sharp, simulating billions of years of bombardment.
- **Terrain roughness** — independent fBm base layer amplitude so users can make the "plains" between craters bumpy or smooth.
- **Crater variation** — randomizes depth, rim height, bowl shape per-crater so they don't all look identical.

**3. Expanded Panel UI** (`src/components/builder/LunarTexturePanel.tsx`)
- New sliders: Rim Height, Bowl Depth, Erosion, Terrain Roughness, Crater Variation
- Live crater count display showing exactly how many craters are being generated
- 4 new presets: "Tycho Fresh Impact", "South Pole Aitken", "Weathered Highlands", "Dense Bombardment"
- Organized into collapsible sub-sections: Shape, Surface, Advanced

**4. Hook + Sidebar Wiring** (`src/hooks/useRingDesign.ts`, `src/components/builder/BuilderSidebar.tsx`)
Wire new state fields with defaults, ensure save/restore handles new properties with backward-compatible defaults.

**5. STL Mesh Scaling Fix** (`src/components/builder/RingViewport.tsx`)
Remove the 60% blend cap on width correction — use full Y-axis scaling with a wider clamp range (0.5-2.0) so the ring actually reaches target width while keeping XZ craters round.

### Technical Details

New `LunarTextureState` fields:
```typescript
rimHeight: number;        // 0-100, how much rims protrude above surface
bowlDepth: number;        // 0-100, how deep crater bowls carve
erosion: number;          // 0-100, weathering/softening of older craters
terrainRoughness: number; // 0-100, base landscape bumpiness
craterVariation: number;  // 0-100, per-crater randomness in shape
```

Central peak logic (inside `stampCrater`):
```text
if crater.radius > threshold AND dist < peakRadius:
  delta = +peakHeight * bell_curve(dist/peakRadius)
```

Erosion pass (post-stamp):
```text
for each pixel in heightmap:
  blurred = gaussian_blur(neighborhood, erosionKernel)
  hmap[i] = lerp(hmap[i], blurred, erosionFactor)
```

Ejecta rays (per hero+ crater):
```text
for ray in 4-8 random angles:
  for distance along ray:
    brighten heightmap along thin radial strip
    occasionally stamp tiny secondary crater
```

### Files Modified
- `src/types/lunar.ts` — 5 new fields + defaults
- `src/lib/lunarSurfaceMaps.ts` — central peaks, terraces, ejecta, erosion, 5-tier distribution
- `src/components/builder/LunarTexturePanel.tsx` — new sliders, sections, presets, crater count
- `src/hooks/useRingDesign.ts` — wire new defaults
- `src/components/builder/RingViewport.tsx` — fix width scaling, pass new fields to texture cache key

