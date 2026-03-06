import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  listCloudDesigns, deleteCloudDesign, duplicateCloudDesign,
  renameCloudDesign, updateDesignStatus, CloudDesign,
} from "@/lib/cloudDesignsStore";
import { listProjects, deleteProject, duplicateProject, renameProject } from "@/lib/projectsStore";
import { DesignProject } from "@/types/projects";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Trash2, ExternalLink, Copy, Pencil, Check, X, Plus,
  Send, Cloud, HardDrive, LogIn, Loader2,
} from "lucide-react";
import { STAGES } from "@/config/pipeline";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type UnifiedDesign = {
  id: string;
  name: string;
  updatedAt: string;
  createdAt: string;
  thumbnail?: string | null;
  source: "cloud" | "local";
  status?: CloudDesign["status"];
  designPackage: any;
};

export default function MyDesigns() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const [designs, setDesigns] = useState<UnifiedDesign[]>([]);
  const [loading, setLoading] = useState(true);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const unified: UnifiedDesign[] = [];

      // Cloud designs (if authenticated)
      if (user) {
        const cloud = await listCloudDesigns();
        cloud.forEach((d) => unified.push({
          id: d.id,
          name: d.name,
          updatedAt: d.updated_at,
          createdAt: d.created_at,
          thumbnail: d.thumbnail,
          source: "cloud",
          status: d.status,
          designPackage: d.design_package,
        }));
      }

      // Local designs
      const local: DesignProject[] = listProjects();
      local.forEach((p) => {
        // Skip if already exists in cloud (by name match)
        if (!unified.some((u) => u.name === p.name && u.source === "cloud")) {
          unified.push({
            id: p.id,
            name: p.name,
            updatedAt: p.updatedAt,
            createdAt: p.createdAt,
            thumbnail: p.thumbnail,
            source: "local",
            designPackage: p.designPackage,
          });
        }
      });

      unified.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      setDesigns(unified);
    } catch (err: any) {
      toast({ title: "Error loading designs", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    if (!authLoading) refresh();
  }, [authLoading, refresh]);

  const handleOpen = (design: UnifiedDesign) => {
    if (design.source === "cloud") {
      sessionStorage.setItem("openCloudDesignId", design.id);
    } else {
      sessionStorage.setItem("openProjectId", design.id);
    }
    navigate("/builder");
  };

  const handleDelete = async (design: UnifiedDesign) => {
    if (!window.confirm(`Delete "${design.name}"? This cannot be undone.`)) return;
    setActionLoading(design.id);
    try {
      if (design.source === "cloud") {
        await deleteCloudDesign(design.id);
      } else {
        deleteProject(design.id);
      }
      toast({ title: "Deleted", description: `"${design.name}" removed.` });
      refresh();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDuplicate = async (design: UnifiedDesign) => {
    setActionLoading(design.id);
    try {
      if (design.source === "cloud") {
        await duplicateCloudDesign(design.id);
      } else {
        duplicateProject(design.id);
      }
      toast({ title: "Duplicated", description: `Copy of "${design.name}" created.` });
      refresh();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleSendToProduction = async (design: UnifiedDesign) => {
    if (design.source !== "cloud") {
      toast({ title: "Sign in required", description: "Save to cloud first to submit for production.", variant: "destructive" });
      return;
    }
    setActionLoading(design.id);
    try {
      await updateDesignStatus(design.id, "submitted");
      toast({ title: "Submitted!", description: `"${design.name}" has been sent for production review.` });
      refresh();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const startRename = (id: string, currentName: string) => {
    setRenamingId(id);
    setRenameValue(currentName);
  };

  const confirmRename = async () => {
    if (!renamingId || !renameValue.trim()) return;
    const design = designs.find((d) => d.id === renamingId);
    if (!design) return;
    try {
      if (design.source === "cloud") {
        await renameCloudDesign(renamingId, renameValue.trim());
      } else {
        renameProject(renamingId, renameValue.trim());
      }
      setRenamingId(null);
      toast({ title: "Renamed" });
      refresh();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const cancelRename = () => {
    setRenamingId(null);
    setRenameValue("");
  };

  const stageLabel = (stageId: string) =>
    STAGES.find((s) => s.id === stageId)?.label ?? stageId;

  const scoreColor = (score: number) => {
    if (score >= 80) return "bg-emerald-900/30 text-emerald-400 border-emerald-800";
    if (score >= 50) return "bg-amber-900/30 text-amber-400 border-amber-800";
    return "bg-red-900/30 text-red-400 border-red-800";
  };

  const statusConfig: Record<string, { label: string; className: string }> = {
    draft: { label: "Draft", className: "border-border text-muted-foreground" },
    submitted: { label: "Submitted", className: "border-primary/40 text-primary bg-primary/10" },
    in_production: { label: "In Production", className: "border-amber-500/40 text-amber-400 bg-amber-500/10" },
    completed: { label: "Completed", className: "border-emerald-500/40 text-emerald-400 bg-emerald-500/10" },
  };

  const designSummary = (pkg: any) => {
    const p = pkg?.parameters;
    if (!p) return "";
    const parts: string[] = [];
    parts.push(`Size ${p.size}`);
    parts.push(`${p.width}×${p.thickness}mm`);
    parts.push(p.profile);
    const cs = pkg?.craftState;
    if (cs?.engraving?.enabled && cs.engraving.text) parts.push("engraved");
    if (cs?.lunarTexture?.enabled) parts.push("lunar");
    if (cs?.inlays?.channels?.length) parts.push(`${cs.inlays.channels.length} inlay(s)`);
    return parts.join(" · ");
  };

  return (
    <div className="min-h-screen bg-background px-4 sm:px-6 py-10 sm:py-16">
      <div className="max-w-5xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-8 sm:mb-12 flex-wrap gap-3">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl md:text-4xl mb-1">My Designs</h1>
            <p className="text-muted-foreground text-sm flex items-center gap-2">
              {loading ? "Loading..." : `${designs.length} design${designs.length !== 1 ? "s" : ""}`}
              {user && (
                <Badge variant="outline" className="text-[9px] gap-1 border-primary/30 text-primary/70">
                  <Cloud className="w-3 h-3" /> Cloud synced
                </Badge>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!user && (
              <Button variant="outline" onClick={() => navigate("/auth")} className="gap-1.5 text-xs">
                <LogIn className="h-3.5 w-3.5" /> Sign in to sync
              </Button>
            )}
            <Button onClick={() => navigate("/builder")} className="gap-1.5">
              <Plus className="h-4 w-4" /> New Design
            </Button>
          </div>
        </motion.div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : designs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 sm:py-24 text-center">
            <span className="text-4xl mb-4 opacity-30">📂</span>
            <p className="text-sm text-muted-foreground">No saved designs yet.</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Start building and save your work to see it here.
            </p>
            <Button variant="outline" className="mt-6" onClick={() => navigate("/builder")}>
              Open Builder
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {designs.map((design, i) => (
              <motion.div
                key={`${design.source}-${design.id}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="group rounded-xl border border-border bg-card overflow-hidden hover:border-primary/30 transition-colors"
              >
                {/* Thumbnail */}
                <div
                  className="aspect-video bg-secondary/50 flex items-center justify-center overflow-hidden cursor-pointer relative"
                  onClick={() => handleOpen(design)}
                >
                  {design.thumbnail ? (
                    <img src={design.thumbnail} alt={design.name} className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-3xl opacity-20">💍</span>
                  )}
                  {/* Source indicator */}
                  <div className="absolute top-2 right-2">
                    {design.source === "cloud" ? (
                      <Cloud className="w-3.5 h-3.5 text-primary/50" />
                    ) : (
                      <HardDrive className="w-3.5 h-3.5 text-muted-foreground/40" />
                    )}
                  </div>
                </div>

                {/* Info */}
                <div className="p-3 sm:p-4 space-y-3">
                  {/* Name */}
                  <div>
                    {renamingId === design.id ? (
                      <div className="flex items-center gap-1">
                        <Input
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") confirmRename();
                            if (e.key === "Escape") cancelRename();
                          }}
                          className="h-7 text-xs bg-secondary border-border"
                          autoFocus
                          maxLength={80}
                        />
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={confirmRename}>
                          <Check className="h-3 w-3 text-emerald-400" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={cancelRename}>
                          <X className="h-3 w-3 text-muted-foreground" />
                        </Button>
                      </div>
                    ) : (
                      <h3 className="font-medium text-sm text-foreground truncate">{design.name}</h3>
                    )}
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {new Date(design.updatedAt).toLocaleDateString(undefined, {
                        month: "short", day: "numeric", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </p>
                  </div>

                  <p className="text-[10px] text-muted-foreground/80 truncate">
                    {designSummary(design.designPackage)}
                  </p>

                  {/* Badges */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge
                      variant="outline"
                      className={cn("text-[10px] px-1.5 py-0", scoreColor(
                        design.designPackage?.castabilityReport?.score ?? 0
                      ))}
                    >
                      Score {design.designPackage?.castabilityReport?.score ?? "–"}
                    </Badge>
                    {design.status && (
                      <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", statusConfig[design.status]?.className)}>
                        {statusConfig[design.status]?.label}
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-border text-muted-foreground">
                      {design.designPackage?.metalPreset ?? "—"}
                    </Badge>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                    <Button size="sm" className="flex-1 text-xs h-8" onClick={() => handleOpen(design)}>
                      <ExternalLink className="h-3 w-3 mr-1" /> Open
                    </Button>
                    {design.source === "cloud" && design.status === "draft" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-8 px-2 border-primary/30 text-primary hover:bg-primary/10"
                        onClick={() => handleSendToProduction(design)}
                        disabled={actionLoading === design.id}
                        title="Send to production"
                      >
                        <Send className="h-3 w-3" />
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="text-xs h-8 px-2"
                      onClick={() => handleDuplicate(design)} disabled={actionLoading === design.id} title="Duplicate">
                      <Copy className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="outline" className="text-xs h-8 px-2"
                      onClick={() => startRename(design.id, design.name)} title="Rename">
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="ghost"
                      className="text-xs h-8 px-2 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(design)} disabled={actionLoading === design.id} title="Delete">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
