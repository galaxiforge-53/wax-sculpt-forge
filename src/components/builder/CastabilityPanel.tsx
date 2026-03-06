import { CastabilityReport } from "@/types/castability";
import { BalanceAnalysis } from "@/lib/surfaceBalancer";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ShieldCheck, ShieldAlert, ChevronDown, Scale, Wand2 } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";

interface CastabilityPanelProps {
  report: CastabilityReport;
  balanceAnalysis?: BalanceAnalysis;
  onAutoBalance?: () => void;
}

const LEVEL_CONFIG = {
  good: { label: "Ready", variant: "default" as const, className: "bg-emerald-600 border-emerald-600", Icon: ShieldCheck },
  warning: { label: "Review", variant: "secondary" as const, className: "bg-amber-600 border-amber-600 text-white", Icon: AlertTriangle },
  risk: { label: "Not Safe", variant: "destructive" as const, className: "", Icon: ShieldAlert },
};

const SECTOR_LABELS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

function BalanceRadar({ sectorDensity, score }: { sectorDensity: number[]; score: number }) {
  const maxVal = Math.max(...sectorDensity, 0.01);
  const cx = 40, cy = 40, r = 32;

  const points = sectorDensity.map((val, i) => {
    const angle = (i / 8) * Math.PI * 2 - Math.PI / 2;
    const dist = (val / maxVal) * r;
    return {
      x: cx + Math.cos(angle) * dist,
      y: cy + Math.sin(angle) * dist,
    };
  });

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";

  const scoreColor = score >= 80 ? "hsl(var(--primary))" : score >= 50 ? "#f59e0b" : "#ef4444";

  return (
    <svg viewBox="0 0 80 80" className="w-full h-auto max-w-[100px] mx-auto">
      {/* Grid rings */}
      {[0.33, 0.66, 1].map((frac) => (
        <circle key={frac} cx={cx} cy={cy} r={r * frac} fill="none" stroke="hsl(var(--border))" strokeWidth="0.5" opacity={0.4} />
      ))}
      {/* Sector lines */}
      {Array.from({ length: 8 }, (_, i) => {
        const angle = (i / 8) * Math.PI * 2 - Math.PI / 2;
        return (
          <line key={i} x1={cx} y1={cy} x2={cx + Math.cos(angle) * r} y2={cy + Math.sin(angle) * r} stroke="hsl(var(--border))" strokeWidth="0.3" opacity={0.3} />
        );
      })}
      {/* Sector labels */}
      {SECTOR_LABELS.map((label, i) => {
        const angle = (i / 8) * Math.PI * 2 - Math.PI / 2;
        return (
          <text key={label} x={cx + Math.cos(angle) * (r + 6)} y={cy + Math.sin(angle) * (r + 6)} textAnchor="middle" dominantBaseline="central" fontSize="3.5" fill="hsl(var(--muted-foreground))" opacity={0.6}>
            {label}
          </text>
        );
      })}
      {/* Filled area */}
      <path d={pathD} fill={scoreColor} fillOpacity={0.15} stroke={scoreColor} strokeWidth="1" strokeOpacity={0.6} />
      {/* Data points */}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="1.5" fill={scoreColor} opacity={0.8} />
      ))}
    </svg>
  );
}

export default function CastabilityPanel({ report, balanceAnalysis, onAutoBalance }: CastabilityPanelProps) {
  const config = LEVEL_CONFIG[report.level];
  const StatusIcon = config.Icon;
  const [showAll, setShowAll] = useState(false);
  const [showBalance, setShowBalance] = useState(false);

  const issues = report.checks.filter((c) => c.status !== "ok");
  const okChecks = report.checks.filter((c) => c.status === "ok");
  const risks = issues.filter((c) => c.status === "risk");
  const warnings = issues.filter((c) => c.status === "warn");

  // Sort: risks first, then warnings
  const sortedIssues = [...risks, ...warnings];

  const hasBalanceIssues = balanceAnalysis && balanceAnalysis.issues.length > 0;
  const hasFixes = balanceAnalysis && balanceAnalysis.fixes.length > 0;

  return (
    <div className="flex flex-col gap-3">
      {/* Score bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Manufacturing Score</span>
            <span className="text-foreground font-mono">{report.score}/100</span>
          </div>
          <Progress value={report.score} className="h-2" />
        </div>
        <Badge variant={config.variant} className={cn("gap-1", config.className)}>
          <StatusIcon className="w-3 h-3" />
          {config.label}
        </Badge>
      </div>

      {/* Summary line */}
      {issues.length === 0 ? (
        <p className="text-[11px] text-emerald-500/80 flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5" />
          All checks passed — design is safe to manufacture.
        </p>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          {risks.length > 0 && <span className="text-destructive font-medium">{risks.length} critical</span>}
          {risks.length > 0 && warnings.length > 0 && " · "}
          {warnings.length > 0 && <span className="text-amber-500 font-medium">{warnings.length} warning{warnings.length !== 1 ? "s" : ""}</span>}
          {" · "}{okChecks.length} passed
        </p>
      )}

      {/* Issues list */}
      {sortedIssues.length > 0 && (
        <div className="space-y-2">
          {sortedIssues.map((check) => (
            <div
              key={check.id}
              className={cn(
                "text-xs rounded-md border px-2.5 py-2 space-y-1",
                check.status === "risk"
                  ? "border-destructive/30 bg-destructive/5"
                  : "border-amber-500/20 bg-amber-500/5"
              )}
            >
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "inline-block h-2 w-2 rounded-full shrink-0",
                    check.status === "risk" ? "bg-destructive" : "bg-amber-500"
                  )}
                />
                <span className="text-foreground font-medium">{check.label}</span>
              </div>
              <p className="text-muted-foreground text-[11px] pl-3.5">{check.detail}</p>
              {check.suggestedFix && (
                <p className="text-[11px] pl-3.5 text-primary/80">
                  💡 {check.suggestedFix}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Surface Balance Analysis ────────────────────────────── */}
      {balanceAnalysis && (
        <Collapsible open={showBalance} onOpenChange={setShowBalance}>
          <CollapsibleTrigger className="flex items-center justify-between w-full py-1 group">
            <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground/70 font-display group-hover:text-muted-foreground transition-colors">
              <Scale className="w-3 h-3" />
              Surface Balance
            </span>
            <div className="flex items-center gap-2">
              <span className={cn(
                "text-[10px] font-mono",
                balanceAnalysis.score >= 80 ? "text-emerald-500" : balanceAnalysis.score >= 50 ? "text-amber-500" : "text-destructive"
              )}>
                {balanceAnalysis.score}/100
              </span>
              <ChevronDown className={cn("w-3 h-3 text-muted-foreground/50 transition-transform", showBalance && "rotate-180")} />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 pt-2 animate-in slide-in-from-top-1 duration-150">
            {/* Radar chart */}
            <BalanceRadar sectorDensity={balanceAnalysis.sectorDensity} score={balanceAnalysis.score} />

            {/* Balance issues */}
            {balanceAnalysis.issues.map((issue) => (
              <div
                key={issue.id}
                className={cn(
                  "text-[11px] rounded-md border px-2.5 py-1.5",
                  issue.severity === "risk" ? "border-destructive/30 bg-destructive/5" :
                  issue.severity === "warn" ? "border-amber-500/20 bg-amber-500/5" :
                  "border-border/50 bg-secondary/20"
                )}
              >
                <div className="flex items-center gap-1.5">
                  <span className={cn(
                    "inline-block h-1.5 w-1.5 rounded-full shrink-0",
                    issue.severity === "risk" ? "bg-destructive" :
                    issue.severity === "warn" ? "bg-amber-500" : "bg-muted-foreground/40"
                  )} />
                  <span className="text-foreground/80">{issue.message}</span>
                </div>
              </div>
            ))}

            {balanceAnalysis.issues.length === 0 && (
              <p className="text-[11px] text-emerald-500/80 flex items-center gap-1.5">
                <ShieldCheck className="w-3 h-3" />
                Surface features are evenly distributed
              </p>
            )}

            {/* Auto-balance button */}
            {hasFixes && onAutoBalance && (
              <Button
                variant="outline"
                size="sm"
                className="w-full text-[10px] h-7 gap-1.5"
                onClick={onAutoBalance}
              >
                <Wand2 className="w-3 h-3" />
                Auto-Balance ({balanceAnalysis.fixes.length} fix{balanceAnalysis.fixes.length !== 1 ? "es" : ""})
              </Button>
            )}
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Passed checks (collapsible) */}
      {okChecks.length > 0 && (
        <Collapsible open={showAll} onOpenChange={setShowAll}>
          <CollapsibleTrigger className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
            <ChevronDown className={cn("w-3 h-3 transition-transform", showAll && "rotate-180")} />
            {okChecks.length} passed check{okChecks.length !== 1 ? "s" : ""}
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-1.5 space-y-1">
            {okChecks.map((check) => (
              <div key={check.id} className="flex items-center gap-1.5 text-[11px] text-muted-foreground pl-1">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500/60 shrink-0" />
                {check.label}
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
