import { supabase } from "@/integrations/supabase/client";
import { DesignPackage } from "@/types/ring";

export interface DesignVersion {
  id: string;
  design_id: string;
  user_id: string;
  version_number: number;
  label: string;
  design_package: DesignPackage;
  thumbnail: string | null;
  created_at: string;
}

/**
 * List all versions for a given design, newest first.
 */
export async function listVersions(designId: string): Promise<DesignVersion[]> {
  const { data, error } = await supabase
    .from("design_versions")
    .select("*")
    .eq("design_id", designId)
    .order("version_number", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as DesignVersion[];
}

/**
 * Get the next version number for a design.
 */
async function nextVersionNumber(designId: string): Promise<number> {
  const { data, error } = await supabase
    .from("design_versions")
    .select("version_number")
    .eq("design_id", designId)
    .order("version_number", { ascending: false })
    .limit(1);
  if (error) throw error;
  if (!data || data.length === 0) return 1;
  return (data[0].version_number as number) + 1;
}

/**
 * Save a new version snapshot for a design.
 * Called automatically when saving a design (from cloudDesignsStore).
 */
export async function saveVersion(
  designId: string,
  designPackage: DesignPackage,
  label?: string,
  thumbnail?: string | null,
): Promise<DesignVersion> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const versionNumber = await nextVersionNumber(designId);
  const autoLabel = label || `v${versionNumber}`;

  const { data, error } = await supabase
    .from("design_versions")
    .insert({
      design_id: designId,
      user_id: user.id,
      version_number: versionNumber,
      label: autoLabel,
      design_package: designPackage as any,
      thumbnail: thumbnail ?? null,
    } as any)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as DesignVersion;
}

/**
 * Restore a design to a specific version — updates the main ring_designs row.
 */
export async function restoreVersion(
  designId: string,
  versionId: string,
): Promise<void> {
  const { data: version, error: vErr } = await supabase
    .from("design_versions")
    .select("design_package, thumbnail")
    .eq("id", versionId)
    .single();
  if (vErr) throw vErr;
  if (!version) throw new Error("Version not found");

  // Save current state as a new version before restoring (safety net)
  const { data: current } = await supabase
    .from("ring_designs")
    .select("design_package, thumbnail")
    .eq("id", designId)
    .single();
  if (current) {
    await saveVersion(
      designId,
      current.design_package as unknown as DesignPackage,
      "Auto-save before restore",
      current.thumbnail,
    );
  }

  // Overwrite the main design with the old version
  const { error: uErr } = await supabase
    .from("ring_designs")
    .update({
      design_package: version.design_package,
      thumbnail: version.thumbnail ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", designId);
  if (uErr) throw uErr;
}

/**
 * Branch a new design from an older version.
 * Creates a new ring_designs row + initial version.
 */
export async function branchFromVersion(
  versionId: string,
  newName: string,
): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: version, error: vErr } = await supabase
    .from("design_versions")
    .select("design_package, thumbnail")
    .eq("id", versionId)
    .single();
  if (vErr) throw vErr;
  if (!version) throw new Error("Version not found");

  // Create new design
  const { data: newDesign, error: dErr } = await supabase
    .from("ring_designs")
    .insert({
      user_id: user.id,
      name: newName,
      design_package: version.design_package,
      thumbnail: version.thumbnail ?? null,
    })
    .select()
    .single();
  if (dErr) throw dErr;

  // Save initial version for the branched design
  await saveVersion(
    newDesign.id,
    version.design_package as unknown as DesignPackage,
    "Branched from parent",
    version.thumbnail,
  );

  return newDesign.id;
}

/**
 * Delete a specific version.
 */
export async function deleteVersion(versionId: string): Promise<void> {
  const { error } = await supabase
    .from("design_versions")
    .delete()
    .eq("id", versionId);
  if (error) throw error;
}
