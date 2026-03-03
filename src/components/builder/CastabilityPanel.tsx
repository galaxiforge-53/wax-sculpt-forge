import { CastabilityReport } from "@/types/castability";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

interface CastabilityPanelProps {
  report: CastabilityReport;
}

const LEVEL_CONFIG = {
  good: { label: "Good", variant: "default" as const, className: "bg-emerald-600 border-emerald-600" },
  warning: { label: "Warning", variant: "secondary" as const, className: "bg-amber-600 border-amber-600 text-white" },
  risk: { label: "Risk", variant: "destructive" as const, className: "" },
};

export default function CastabilityPanel({ report }: CastabilityPanelProps) {
  const config = LEVEL_CONFIG[report.level];

  const importantChecks = [...report.checks]
    .filter((c) => c.status !== "ok")
    .sort((a, b) => (a.status === "risk" ? -1 : 1) - (b.status === "risk" ? -1 : 1))
    .slice(0, 3);

  return (
    <div className="flex flex-col gap-3">

      <div className="flex items-center gap-3">
        <div className="flex-1 space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Score</span>
            <span className="text-foreground font-mono">{report.score}</span>
          </div>
          <Progress value={report.score} className="h-2" />
        </div>
        <Badge variant={config.variant} className={config.className}>
          {config.label}
        </Badge>
      </div>

      {importantChecks.length > 0 && (
        <div className="space-y-2">
          {importantChecks.map((check) => (
            <div key={check.id} className="text-xs space-y-0.5">
              <div className="flex items-center gap-1.5">
                <span
                  className={`inline-block h-1.5 w-1.5 rounded-full ${
                    check.status === "risk" ? "bg-destructive" : "bg-amber-500"
                  }`}
                />
                <span className="text-foreground font-medium">{check.label}</span>
              </div>
              {check.suggestedFix && (
                <p className="text-muted-foreground pl-3">{check.suggestedFix}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
