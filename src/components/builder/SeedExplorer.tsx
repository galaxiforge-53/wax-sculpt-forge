import { useState, useMemo, useCallback, useEffect } from "react";
import { LunarTextureState } from "@/types/lunar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Dices, Check, Search, Grid3X3, LayoutList, Heart, Sparkles } from "lucide-react";
import SurfaceThumbnail from "./SurfaceThumbnail";

interface SeedExplorerProps {
  state: LunarTextureState;
  onChange: (state: LunarTextureState) => void;
}

const SEEDS_PER_PAGE = 12;

// Generate deterministic seed variations around a base
function generateSeedVariations(baseSeed: number, count: number): number[] {
  const seeds: number[] = [];
  for (let i = 0; i < count; i++) {
    // Create visually distinct seeds using a spread pattern
    const variation = (baseSeed + i * 137 + Math.floor(i / 4) * 1000) % 10000;
    seeds.push(variation);
  }
  return seeds;
}

// Generate truly random seeds
function generateRandomSeeds(count: number): number[] {
  return Array.from({ length: count }, () => Math.floor(Math.random() * 10000));
}

export default function SeedExplorer({ state, onChange }: SeedExplorerProps) {
  const [viewMode, setViewMode] = useState<"grid" | "carousel">("grid");
  const [pageIndex, setPageIndex] = useState(0);
  const [favorites, setFavorites] = useState<number[]>([]);
  const [searchValue, setSearchValue] = useState("");
  const [seedPool, setSeedPool] = useState<number[]>(() => generateRandomSeeds(SEEDS_PER_PAGE * 5));

  // Current page of seeds
  const currentSeeds = useMemo(() => {
    const start = pageIndex * SEEDS_PER_PAGE;
    return seedPool.slice(start, start + SEEDS_PER_PAGE);
  }, [seedPool, pageIndex]);

  const totalPages = Math.ceil(seedPool.length / SEEDS_PER_PAGE);

  // Handle seed selection
  const selectSeed = useCallback((seed: number) => {
    onChange({ ...state, seed });
  }, [state, onChange]);

  // Toggle favorite
  const toggleFavorite = useCallback((seed: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites(prev => 
      prev.includes(seed) 
        ? prev.filter(s => s !== seed)
        : [...prev, seed]
    );
  }, []);

  // Generate new random batch
  const shuffleSeeds = useCallback(() => {
    setSeedPool(generateRandomSeeds(SEEDS_PER_PAGE * 5));
    setPageIndex(0);
  }, []);

  // Navigate pages
  const prevPage = () => setPageIndex(p => Math.max(0, p - 1));
  const nextPage = () => setPageIndex(p => Math.min(totalPages - 1, p + 1));

  // Search for specific seed
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(searchValue, 10);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 9999) {
      selectSeed(parsed);
      setSearchValue("");
    }
  };

  // Quick cycle through seeds with keyboard
  const cycleSeed = useCallback((direction: 1 | -1) => {
    const currentIndex = seedPool.indexOf(state.seed);
    if (currentIndex === -1) {
      // Seed not in pool, just pick first/last
      selectSeed(direction === 1 ? seedPool[0] : seedPool[seedPool.length - 1]);
    } else {
      const newIndex = (currentIndex + direction + seedPool.length) % seedPool.length;
      selectSeed(seedPool[newIndex]);
      // Auto-scroll to show the selected seed
      const newPage = Math.floor(newIndex / SEEDS_PER_PAGE);
      if (newPage !== pageIndex) setPageIndex(newPage);
    }
  }, [seedPool, state.seed, selectSeed, pageIndex]);

  // Build preview state for a given seed
  const previewState = useCallback((seed: number): LunarTextureState => ({
    ...state,
    seed,
  }), [state]);

  return (
    <div className="space-y-3">
      {/* Header with controls */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className={cn("h-7 w-7 p-0", viewMode === "grid" && "bg-secondary")}
            onClick={() => setViewMode("grid")}
            title="Grid view"
          >
            <Grid3X3 className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn("h-7 w-7 p-0", viewMode === "carousel" && "bg-secondary")}
            onClick={() => setViewMode("carousel")}
            title="Carousel view"
          >
            <LayoutList className="w-3.5 h-3.5" />
          </Button>
        </div>

        <form onSubmit={handleSearch} className="flex items-center gap-1">
          <Input
            type="number"
            min={0}
            max={9999}
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Seed #"
            className="h-7 w-20 text-[10px] px-2"
          />
          <Button type="submit" variant="ghost" size="sm" className="h-7 w-7 p-0">
            <Search className="w-3 h-3" />
          </Button>
        </form>

        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2 gap-1 text-[10px]"
          onClick={shuffleSeeds}
        >
          <Dices className="w-3 h-3" />
          Shuffle
        </Button>
      </div>

      {/* Current seed indicator */}
      <div className="flex items-center justify-center gap-2 py-1.5 bg-secondary/30 rounded-lg">
        <span className="text-[10px] text-muted-foreground">Current seed:</span>
        <span className="font-mono text-xs text-primary font-medium">{state.seed}</span>
      </div>

      {/* Quick cycle buttons */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 h-8 gap-1.5 text-[10px]"
          onClick={() => cycleSeed(-1)}
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1 h-8 gap-1.5 text-[10px]"
          onClick={() => cycleSeed(1)}
        >
          Next
          <ChevronRight className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Grid view */}
      {viewMode === "grid" && (
        <div className="grid grid-cols-4 gap-1.5">
          {currentSeeds.map((seed) => (
            <button
              key={seed}
              onClick={() => selectSeed(seed)}
              className={cn(
                "relative group rounded-lg overflow-hidden border-2 transition-all aspect-square",
                state.seed === seed
                  ? "border-primary ring-2 ring-primary/30 scale-105"
                  : "border-border/50 hover:border-primary/50 hover:scale-102"
              )}
            >
              <SurfaceThumbnail preset={previewState(seed)} size={48} className="w-full h-full" />
              
              {/* Seed number overlay */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-1 py-0.5">
                <span className="text-[8px] font-mono text-white/90">{seed}</span>
              </div>

              {/* Selected check */}
              {state.seed === seed && (
                <div className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                  <Check className="w-2.5 h-2.5 text-primary-foreground" />
                </div>
              )}

              {/* Favorite button */}
              <button
                onClick={(e) => toggleFavorite(seed, e)}
                className={cn(
                  "absolute top-0.5 left-0.5 w-4 h-4 rounded-full flex items-center justify-center transition-all",
                  favorites.includes(seed)
                    ? "bg-rose-500 text-white"
                    : "bg-black/40 text-white/50 opacity-0 group-hover:opacity-100"
                )}
              >
                <Heart className={cn("w-2.5 h-2.5", favorites.includes(seed) && "fill-current")} />
              </button>
            </button>
          ))}
        </div>
      )}

      {/* Carousel view */}
      {viewMode === "carousel" && (
        <div className="space-y-2">
          {currentSeeds.slice(0, 6).map((seed) => (
            <button
              key={seed}
              onClick={() => selectSeed(seed)}
              className={cn(
                "flex items-center gap-3 w-full p-2 rounded-lg border-2 transition-all text-left",
                state.seed === seed
                  ? "border-primary bg-primary/5"
                  : "border-border/50 hover:border-primary/50 hover:bg-secondary/30"
              )}
            >
              <SurfaceThumbnail preset={previewState(seed)} size={48} className="rounded-md flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm text-foreground">{seed}</span>
                  {state.seed === seed && (
                    <span className="text-[9px] text-primary bg-primary/10 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5" />
                      Active
                    </span>
                  )}
                </div>
                <p className="text-[9px] text-muted-foreground mt-0.5">
                  Click to apply this terrain pattern
                </p>
              </div>
              {favorites.includes(seed) && (
                <Heart className="w-4 h-4 text-rose-500 fill-rose-500 flex-shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-[10px]"
          onClick={prevPage}
          disabled={pageIndex === 0}
        >
          <ChevronLeft className="w-3 h-3 mr-1" />
          Prev
        </Button>
        <span className="text-[10px] text-muted-foreground">
          Page {pageIndex + 1} of {totalPages}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-[10px]"
          onClick={nextPage}
          disabled={pageIndex >= totalPages - 1}
        >
          Next
          <ChevronRight className="w-3 h-3 ml-1" />
        </Button>
      </div>

      {/* Favorites section */}
      {favorites.length > 0 && (
        <div className="pt-2 border-t border-border/30">
          <div className="flex items-center gap-1.5 mb-2">
            <Heart className="w-3 h-3 text-rose-500" />
            <span className="text-[10px] text-muted-foreground">Favorites ({favorites.length})</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {favorites.map((seed) => (
              <button
                key={seed}
                onClick={() => selectSeed(seed)}
                className={cn(
                  "px-2 py-1 rounded text-[10px] font-mono transition-all",
                  state.seed === seed
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
                )}
              >
                {seed}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
