import { LightingSettings, LIGHTING_PRESETS } from "@/types/lighting";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

interface LightingStudioPanelProps {
  settings: LightingSettings;
  onChange: (settings: LightingSettings) => void;
}

function LightSlider({ label, value, min, max, step, onChange, suffix = "" }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; suffix?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">{label}</span>
        <span className="text-[10px] font-mono text-foreground">{value.toFixed(step < 1 ? 1 : 0)}{suffix}</span>
      </div>
      <Slider
        min={min} max={max} step={step}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        className="w-full"
      />
    </div>
  );
}

const ENV_OPTIONS: { id: LightingSettings["envPreset"]; label: string }[] = [
  { id: "city", label: "City" },
  { id: "studio", label: "Studio" },
  { id: "warehouse", label: "Warehouse" },
  { id: "sunset", label: "Sunset" },
  { id: "dawn", label: "Dawn" },
  { id: "night", label: "Night" },
  { id: "forest", label: "Forest" },
  { id: "apartment", label: "Apartment" },
  { id: "park", label: "Park" },
  { id: "lobby", label: "Lobby" },
];

export default function LightingStudioPanel({ settings, onChange }: LightingStudioPanelProps) {
  const update = (patch: Partial<LightingSettings>) => onChange({ ...settings, ...patch });

  return (
    <div className="space-y-4">
      {/* Presets */}
      <div className="space-y-1.5">
        <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Presets</span>
        <div className="grid grid-cols-3 gap-1.5">
          {LIGHTING_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => update(preset.settings)}
              className={cn(
                "flex flex-col items-center gap-0.5 p-2 rounded-lg border text-[10px] transition-all",
                "border-border bg-card/50 hover:bg-secondary/50 hover:border-primary/30 text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="text-base">{preset.icon}</span>
              <span>{preset.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Direction */}
      <div className="space-y-2">
        <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Light Direction</span>
        
        {/* Visual direction indicator */}
        <div className="flex items-center justify-center">
          <div className="relative w-16 h-16 rounded-full border border-border/50 bg-secondary/20">
            {/* Ring icon center */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30" />
            </div>
            {/* Light dot */}
            <div
              className="absolute w-2.5 h-2.5 rounded-full bg-primary shadow-[0_0_6px_hsl(var(--primary)/0.6)]"
              style={{
                left: `${50 + Math.sin(settings.azimuth * Math.PI / 180) * 38}%`,
                top: `${50 - Math.cos(settings.azimuth * Math.PI / 180) * 38}%`,
                transform: "translate(-50%, -50%)",
              }}
            />
          </div>
        </div>

        <LightSlider label="Azimuth" value={settings.azimuth} min={0} max={360} step={5} onChange={(v) => update({ azimuth: v })} suffix="°" />
        <LightSlider label="Elevation" value={settings.elevation} min={0} max={90} step={5} onChange={(v) => update({ elevation: v })} suffix="°" />
      </div>

      {/* Intensity */}
      <div className="space-y-2">
        <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Intensity</span>
        <LightSlider label="Key Light" value={settings.keyIntensity} min={0.2} max={4.0} step={0.1} onChange={(v) => update({ keyIntensity: v })} />
        <LightSlider label="Fill Light" value={settings.fillIntensity} min={0} max={2.0} step={0.1} onChange={(v) => update({ fillIntensity: v })} />
        <LightSlider label="Ambient" value={settings.ambientIntensity} min={0} max={1.5} step={0.05} onChange={(v) => update({ ambientIntensity: v })} />
      </div>

      {/* Warmth */}
      <div className="space-y-2">
        <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Color Temperature</span>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">Warmth</span>
            <span className="text-[10px] font-mono text-foreground">
              {settings.warmth < 40 ? "Cool" : settings.warmth > 60 ? "Warm" : "Neutral"}
            </span>
          </div>
          <div className="relative">
            <div className="absolute inset-0 rounded-full h-2 mt-[7px]" style={{
              background: "linear-gradient(to right, #8ec8f0, #ffffff, #ffcc77)"
            }} />
            <Slider
              min={0} max={100} step={5}
              value={[settings.warmth]}
              onValueChange={([v]) => update({ warmth: v })}
              className="w-full relative"
            />
          </div>
        </div>
      </div>

      {/* Environment */}
      <div className="space-y-2">
        <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Environment</span>
        <LightSlider label="Reflection Intensity" value={settings.envIntensity} min={0} max={5.0} step={0.1} onChange={(v) => update({ envIntensity: v })} />
        <div className="grid grid-cols-5 gap-1">
          {ENV_OPTIONS.map((env) => (
            <button
              key={env.id}
              onClick={() => update({ envPreset: env.id })}
              className={cn(
                "px-1.5 py-1.5 rounded-md border text-[9px] transition-all text-center",
                settings.envPreset === env.id
                  ? "bg-primary/15 border-primary/40 text-primary"
                  : "bg-card/50 border-border text-muted-foreground hover:text-foreground hover:border-primary/20"
              )}
            >
              {env.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
