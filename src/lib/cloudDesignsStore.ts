import { supabase } from "@/integrations/supabase/client";
import { DesignPackage } from "@/types/ring";
import { saveVersion } from "@/lib/designVersionStore";

export interface CloudDesign {
  id: string;
  user_id: string;
  name: string;
  design_package: DesignPackage;
  thumbnail: string | null;
  status: "draft" | "submitted" | "in_production" | "completed";
  created_at: string;
  updated_at: string;
}

export async function listCloudDesigns(): Promise<CloudDesign[]> {
  const { data, error } = await supabase
    .from("ring_designs")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as CloudDesign[];
}

export async function getCloudDesign(id: string): Promise<CloudDesign | null> {
  const { data, error } = await supabase
    .from("ring_designs")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as CloudDesign | null;
}

export async function saveCloudDesign(
  design: { name: string; design_package: DesignPackage; thumbnail?: string },
  existingId?: string,
): Promise<CloudDesign> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  if (existingId) {
    const { data, error } = await supabase
      .from("ring_designs")
      .update({
        name: design.name,
        design_package: design.design_package as any,
        thumbnail: design.thumbnail ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingId)
      .select()
      .single();
    if (error) throw error;

    // Auto-save version snapshot
    try {
      await saveVersion(existingId, design.design_package, undefined, design.thumbnail);
    } catch (e) {
      console.warn("Version snapshot failed:", e);
    }

    return data as unknown as CloudDesign;
  }

  const { data, error } = await supabase
    .from("ring_designs")
    .insert({
      user_id: user.id,
      name: design.name,
      design_package: design.design_package as any,
      thumbnail: design.thumbnail ?? null,
    })
    .select()
    .single();
  if (error) throw error;

  // Save initial version
  try {
    await saveVersion(data.id, design.design_package, "Initial version", design.thumbnail);
  } catch (e) {
    console.warn("Initial version snapshot failed:", e);
  }

  return data as unknown as CloudDesign;
}

export async function deleteCloudDesign(id: string): Promise<void> {
  const { error } = await supabase
    .from("ring_designs")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function duplicateCloudDesign(id: string): Promise<CloudDesign> {
  const source = await getCloudDesign(id);
  if (!source) throw new Error("Design not found");

  return saveCloudDesign({
    name: `${source.name} (Copy)`,
    design_package: source.design_package,
    thumbnail: source.thumbnail ?? undefined,
  });
}

export async function updateDesignStatus(id: string, status: CloudDesign["status"]): Promise<void> {
  const { error } = await supabase
    .from("ring_designs")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function renameCloudDesign(id: string, name: string): Promise<void> {
  const { error } = await supabase
    .from("ring_designs")
    .update({ name, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}
