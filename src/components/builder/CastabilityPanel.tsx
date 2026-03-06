import { CastabilityReport } from "@/types/castability";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ShieldCheck, ShieldAlert, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface CastabilityPanelProps {
  report: CastabilityReport;
}

const LEVEL_CONFIG = {
  good: { label: "Ready", variant: "default" as const, className: "bg-emerald-600 border-emerald-600", Icon: ShieldCheck },
  warning: { label: "Review", variant: "secondary" as const, className: "bg-amber-600 border-amber-600 text-white", Icon: AlertTriangle },
  risk: { label: "Not Safe", variant: "destructive" as const, className: "", Icon: ShieldAlert },
};

export default function CastabilityPanel({ report }: CastabilityPanelProps) {
  const config = LEVEL_CONFIG[report.level];
  const StatusIcon = config.Icon;
  const [showAll, setShowAll] = useState(false);

  const issues = report.checks.filter((c) => c.status !== "ok");
  const okChecks = report.checks.filter((c) => c.status === "ok");
  const risks = issues.filter((c) => c.status === "risk");
  const warnings = issues.filter((c) => c.status === "warn");

  // Sort: risks first, then warnings
  const sortedIssues = [...risks, ...warnings];

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
