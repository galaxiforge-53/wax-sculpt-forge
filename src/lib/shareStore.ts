import { supabase } from "@/integrations/supabase/client";

/** Generate a short alphanumeric share code */
function generateShareCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export interface ShareResult {
  shareCode: string;
  shareUrl: string;
}

/** Create a shareable link for a design */
export async function createShareLink(
  userId: string,
  name: string,
  designPackage: any,
  thumbnail?: string | null,
): Promise<ShareResult> {
  const shareCode = generateShareCode();

  const { error } = await supabase
    .from("shared_templates" as any)
    .insert({
      share_code: shareCode,
      user_id: userId,
      name,
      design_package: designPackage,
      thumbnail: thumbnail ?? null,
    } as any);

  if (error) throw new Error(`Failed to create share link: ${error.message}`);

  const shareUrl = `${window.location.origin}/share/${shareCode}`;
  return { shareCode, shareUrl };
}

/** Load a shared template by code */
export async function getSharedTemplate(shareCode: string) {
  const { data, error } = await (supabase
    .from("shared_templates" as any)
    .select("*")
    .eq("share_code", shareCode)
    .single() as any);

  if (error || !data) return null;

  // Increment view count (fire and forget)
  (supabase.rpc as any)("increment_share_views", { p_share_code: shareCode }).catch(() => {});

  return data as {
    id: string;
    share_code: string;
    user_id: string;
    name: string;
    design_package: any;
    thumbnail: string | null;
    view_count: number;
    created_at: string;
  };
}
