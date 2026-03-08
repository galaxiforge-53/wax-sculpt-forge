import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Save, FolderOpen, Trash2, Plus, ChevronDown, Layers, Moon, Maximize } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePresets, PresetCategory, UserPreset } from "@/hooks/usePresets";
import { RingParameters } from "@/types/ring";
import { LunarTextureState } from "@/types/lunar";
import { cn } from "@/lib/utils";

interface PresetManagerProps {
  params: RingParameters;
  lunarTexture: LunarTextureState;
  onApplyDimensions: (params: Partial<RingParameters>) => void;
  onApplyLunar: (state: LunarTextureState) => void;
}

const CATEGORIES: { id: PresetCategory; label: string; icon: typeof Layers }[] = [
  { id: "dimensions", label: "Dimensions", icon: Maximize },
  { id: "surface", label: "Surface Style", icon: Moon },
  { id: "crater", label: "Crater Settings", icon: Layers },
];

function extractDimensionsData(params: RingParameters): Record<string, unknown> {
  return {
    size: params.size,
    innerDiameter: params.innerDiameter,
    width: params.width,
    thickness: params.thickness,
    profile: params.profile,
    comfortFit: params.comfortFit,
    bevelSize: params.bevelSize,
    grooveCount: params.grooveCount,
    grooveDepth: params.grooveDepth,
    edgeStyle: params.edgeStyle,
    interiorProfile: params.interiorProfile,
    interiorCurvature: params.interiorCurvature,
    comfortFitDepth: params.comfortFitDepth,
  };
}

function extractSurfaceData(lunar: LunarTextureState): Record<string, unknown> {
  return {
    enabled: lunar.enabled,
    intensity: lunar.intensity,
    terrainRoughness: lunar.terrainRoughness,
    erosion: lunar.erosion,
    microDetail: lunar.microDetail,
    terrainType: lunar.terrainType,
    terrainContrast: lunar.terrainContrast,
    mariaFill: lunar.mariaFill,
    highlandRidges: lunar.highlandRidges,
    ejectaStrength: lunar.ejectaStrength,
    symmetry: lunar.symmetry,
    symmetryBlend: lunar.symmetryBlend,
    layerLargeCraters: lunar.layerLargeCraters,
    layerMediumImpacts: lunar.layerMediumImpacts,
    layerMicroPitting: lunar.layerMicroPitting,
  };
}

function extractCraterData(lunar: LunarTextureState): Record<string, unknown> {
  return {
    craterDensity: lunar.craterDensity,
    craterSize: lunar.craterSize,
    craterShape: lunar.craterShape,
    rimHeight: lunar.rimHeight,
    bowlDepth: lunar.bowlDepth,
    rimSharpness: lunar.rimSharpness,
    craterVariation: lunar.craterVariation,
    craterFloorTexture: lunar.craterFloorTexture,
    overlapIntensity: lunar.overlapIntensity,
    smoothEdges: lunar.smoothEdges,
    ovalElongation: lunar.ovalElongation,
    ovalAngle: lunar.ovalAngle,
  };
}

export default function PresetManager({
  params,
  lunarTexture,
  onApplyDimensions,
  onApplyLunar,
}: PresetManagerProps) {
  const { savePreset, deletePreset, getPresetsByCategory } = usePresets();
  const [activeCategory, setActiveCategory] = useState<PresetCategory>("dimensions");
  const [savingName, setSavingName] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);

  const categoryPresets = getPresetsByCategory(activeCategory);

  const handleSave = () => {
    if (!savingName.trim()) return;

    let data: Record<string, unknown>;
    switch (activeCategory) {
      case "dimensions": data = extractDimensionsData(params); break;
      case "surface": data = extractSurfaceData(lunarTexture); break;
      case "crater": data = extractCraterData(lunarTexture); break;
    }

    savePreset(savingName.trim(), activeCategory, data);
    setSavingName("");
    setShowSaveInput(false);
  };

  const handleApply = (preset: UserPreset) => {
    if (preset.category === "dimensions") {
      onApplyDimensions(preset.preset_data as Partial<RingParameters>);
    } else {
      // Surface or crater — merge into lunar state
      onApplyLunar({ ...lunarTexture, ...preset.preset_data } as LunarTextureState);
    }
  };

  const activeCat = CATEGORIES.find((c) => c.id === activeCategory)!;

  return (
    <div className="space-y-3">
      {/* Category tabs */}
      <div className="flex gap-1">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const count = getPresetsByCategory(cat.id).length;
          return (
            <button
              key={cat.id}
              onClick={() => { setActiveCategory(cat.id); setShowSaveInput(false); }}
              className={cn(
                "flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-[9px] font-medium rounded-md border transition-all",
                activeCategory === cat.id
                  ? "bg-primary/15 text-primary border-primary/30"
                  : "bg-secondary/30 text-muted-foreground border-border/50 hover:text-foreground hover:bg-secondary/50"
              )}
            >
              <Icon className="w-3 h-3" />
              <span className="hidden sm:inline">{cat.label}</span>
              {count > 0 && (
                <span className="text-[8px] bg-primary/20 text-primary px-1 rounded-full">{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Save new preset */}
      <AnimatePresence>
        {showSaveInput ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex gap-1.5">
              <Input
                value={savingName}
                onChange={(e) => setSavingName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                placeholder={`Name this ${activeCat.label.toLowerCase()} preset…`}
                className="h-7 text-[10px]"
                autoFocus
              />
              <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={handleSave} disabled={!savingName.trim()}>
                <Save className="w-3 h-3" />
              </Button>
              <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => setShowSaveInput(false)}>
                ✕
              </Button>
            </div>
          </motion.div>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="w-full h-7 text-[10px] gap-1"
            onClick={() => setShowSaveInput(true)}
          >
            <Plus className="w-3 h-3" /> Save Current {activeCat.label}
          </Button>
        )}
      </AnimatePresence>

      {/* Preset list */}
      <div className="space-y-1 max-h-[200px] overflow-y-auto">
        {categoryPresets.length === 0 ? (
          <p className="text-[9px] text-muted-foreground/50 text-center py-3">
            No {activeCat.label.toLowerCase()} presets saved yet
          </p>
        ) : (
          categoryPresets.map((preset) => (
            <motion.div
              key={preset.id}
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="group flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-border/40 bg-secondary/20 hover:bg-secondary/40 transition-all"
            >
              <FolderOpen className="w-3 h-3 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-medium text-foreground truncate">{preset.name}</p>
                <p className="text-[8px] text-muted-foreground/50">
                  {new Date(preset.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleApply(preset)}
                  className="w-5 h-5 rounded flex items-center justify-center bg-primary/15 text-primary hover:bg-primary/25 transition-colors"
                  title="Apply preset"
                >
                  <ChevronDown className="w-3 h-3" />
                </button>
                <button
                  onClick={() => deletePreset(preset.id)}
                  className="w-5 h-5 rounded flex items-center justify-center bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                  title="Delete preset"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
