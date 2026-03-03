import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { listProjects, deleteProject } from "@/lib/projectsStore";
import { DesignProject } from "@/types/projects";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, ExternalLink } from "lucide-react";
import { STAGES } from "@/config/pipeline";

export default function MyDesigns() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<DesignProject[]>([]);

  useEffect(() => {
    setProjects(listProjects());
  }, []);

  const handleOpen = (id: string) => {
    sessionStorage.setItem("openProjectId", id);
    navigate("/builder");
  };

  const handleDelete = (id: string, name: string) => {
    if (!window.confirm(`Delete "${name}"?`)) return;
    deleteProject(id);
    setProjects(listProjects());
  };

  const stageLabel = (stageId: string) =>
    STAGES.find((s) => s.id === stageId)?.label ?? stageId;

  const scoreColor = (score: number) => {
    if (score >= 80) return "bg-green-900/30 text-green-400 border-green-800";
    if (score >= 50) return "bg-yellow-900/30 text-yellow-400 border-yellow-800";
    return "bg-red-900/30 text-red-400 border-red-800";
  };

  return (
    <div className="min-h-screen bg-background px-4 sm:px-6 py-10 sm:py-16">
      <div className="max-w-5xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-display text-2xl sm:text-3xl md:text-4xl mb-2">My Designs</h1>
          <p className="text-muted-foreground text-sm mb-8 sm:mb-12">
            Your saved ring designs.
          </p>
        </motion.div>

        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 sm:py-24 text-center">
            <span className="text-4xl mb-4 opacity-30">📂</span>
            <p className="text-sm text-muted-foreground">No saved designs yet.</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Start building and save your work to see it here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {projects.map((project, i) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="group rounded-xl border border-border bg-card overflow-hidden hover:border-primary/30 transition-colors"
              >
                {/* Thumbnail */}
                <div className="aspect-video bg-secondary/50 flex items-center justify-center overflow-hidden">
                  {project.thumbnail ? (
                    <img
                      src={project.thumbnail}
                      alt={project.name}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <span className="text-3xl opacity-20">💍</span>
                  )}
                </div>

                {/* Info */}
                <div className="p-3 sm:p-4 space-y-3">
                  <div>
                    <h3 className="font-medium text-sm text-foreground truncate">{project.name}</h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {new Date(project.updatedAt).toLocaleDateString(undefined, {
                        month: "short", day: "numeric", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 py-0 ${scoreColor(
                        project.designPackage.castabilityReport?.score ?? 0
                      )}`}
                    >
                      Score {project.designPackage.castabilityReport?.score ?? "–"}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-border text-muted-foreground">
                      {stageLabel(project.designPackage.pipelineState?.currentStage ?? "WAX_SCULPT")}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      size="sm"
                      className="flex-1 text-xs h-8"
                      onClick={() => handleOpen(project.id)}
                    >
                      <ExternalLink className="h-3 w-3 mr-1" /> Open
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs h-8 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(project.id, project.name)}
                    >
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
