import { UserPreferences } from "@/hooks/useUserPreferences";
import { RingSizeStandard, DimensionUnit, MetalPreset, FinishPreset, RingProfile } from "@/types/ring";
import { LIGHTING_PRESETS } from "@/types/lighting";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Settings } from "lucide-react";

interface PreferencesPanelProps {
  prefs: UserPreferences;
  onUpdate: (patch: Partial<UserPreferences>) => void;
}

const METALS: { value: MetalPreset; label: string }[] = [
  { value: "silver", label: "Sterling Silver" },
  { value: "gold", label: "14K Gold" },
  { value: "rose-gold", label: "Rose Gold" },
  { value: "titanium", label: "Titanium" },
  { value: "tungsten", label: "Tungsten" },
];

const FINISHES: { value: FinishPreset; label: string }[] = [
  { value: "polished", label: "Polished" },
  { value: "brushed", label: "Brushed" },
  { value: "hammered", label: "Hammered" },
  { value: "matte", label: "Matte" },
  { value: "satin", label: "Satin" },
];

const PROFILES: { value: RingProfile; label: string }[] = [
  { value: "flat", label: "Flat" },
  { value: "dome", label: "Dome" },
  { value: "comfort", label: "Comfort" },
  { value: "square", label: "Square" },
  { value: "knife-edge", label: "Knife Edge" },
];

const CAMERA_VIEWS = [
  { value: "front", label: "Front" },
  { value: "angle", label: "45°" },
  { value: "side", label: "Side" },
  { value: "inside", label: "Inside" },
];

function OptionRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label className="text-[11px] text-muted-foreground whitespace-nowrap">{label}</Label>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function ChipSelect<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1 justify-end">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`px-2 py-0.5 text-[9px] font-medium rounded-md border transition-all
            ${value === o.value
              ? "bg-primary/15 text-primary border-primary/30"
              : "bg-secondary/30 text-muted-foreground border-border/50 hover:text-foreground hover:bg-secondary/60"
            }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function PreferencesPanel({ prefs, onUpdate }: PreferencesPanelProps) {
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Settings className="w-4 h-4 text-primary" />
        <h3 className="text-xs font-display text-primary uppercase tracking-wider">Designer Preferences</h3>
      </div>

      {/* ── Units ── */}
      <div className="space-y-2.5 p-3 rounded-lg bg-secondary/40 border border-border/50">
        <h4 className="text-[10px] font-semibold text-foreground uppercase tracking-wider">Units</h4>
        <OptionRow label="Ring Size Standard">
          <ChipSelect
            value={prefs.sizeStandard}
            options={[
              { value: "US" as RingSizeStandard, label: "US" },
              { value: "UK" as RingSizeStandard, label: "UK" },
              { value: "EU" as RingSizeStandard, label: "EU" },
            ]}
            onChange={(v) => onUpdate({ sizeStandard: v })}
          />
        </OptionRow>
        <OptionRow label="Dimensions">
          <ChipSelect
            value={prefs.dimensionUnit}
            options={[
              { value: "mm" as DimensionUnit, label: "mm" },
              { value: "inch" as DimensionUnit, label: "inch" },
            ]}
            onChange={(v) => onUpdate({ dimensionUnit: v })}
          />
        </OptionRow>
      </div>

      {/* ── Defaults ── */}
      <div className="space-y-2.5 p-3 rounded-lg bg-secondary/40 border border-border/50">
        <h4 className="text-[10px] font-semibold text-foreground uppercase tracking-wider">Defaults</h4>
        <OptionRow label="Metal">
          <ChipSelect value={prefs.defaultMetal} options={METALS} onChange={(v) => onUpdate({ defaultMetal: v })} />
        </OptionRow>
        <OptionRow label="Finish">
          <ChipSelect value={prefs.defaultFinish} options={FINISHES} onChange={(v) => onUpdate({ defaultFinish: v })} />
        </OptionRow>
        <OptionRow label="Profile">
          <ChipSelect value={prefs.defaultProfile} options={PROFILES} onChange={(v) => onUpdate({ defaultProfile: v })} />
        </OptionRow>
      </div>

      {/* ── View ── */}
      <div className="space-y-2.5 p-3 rounded-lg bg-secondary/40 border border-border/50">
        <h4 className="text-[10px] font-semibold text-foreground uppercase tracking-wider">View</h4>
        <OptionRow label="Lighting">
          <ChipSelect
            value={prefs.lightingPreset}
            options={LIGHTING_PRESETS.slice(0, 4).map((p) => ({ value: p.id, label: p.label }))}
            onChange={(v) => onUpdate({ lightingPreset: v })}
          />
        </OptionRow>
        <OptionRow label="Camera">
          <ChipSelect value={prefs.cameraView} options={CAMERA_VIEWS} onChange={(v) => onUpdate({ cameraView: v })} />
        </OptionRow>
        <OptionRow label="Show Measurements">
          <Switch
            checked={prefs.showMeasurements}
            onCheckedChange={(v) => onUpdate({ showMeasurements: v })}
          />
        </OptionRow>
      </div>

      {/* ── Behavior ── */}
      <div className="space-y-2.5 p-3 rounded-lg bg-secondary/40 border border-border/50">
        <h4 className="text-[10px] font-semibold text-foreground uppercase tracking-wider">Behavior</h4>
        <OptionRow label="Comfort Fit by Default">
          <Switch
            checked={prefs.comfortFitDefault}
            onCheckedChange={(v) => onUpdate({ comfortFitDefault: v })}
          />
        </OptionRow>
        <OptionRow label="Auto-save Designs">
          <Switch
            checked={prefs.autoSave}
            onCheckedChange={(v) => onUpdate({ autoSave: v })}
          />
        </OptionRow>
      </div>

      <p className="text-[9px] text-muted-foreground/50 text-center">
        Preferences sync automatically when signed in
      </p>
    </div>
  );
}
