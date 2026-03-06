import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are a ring design assistant for ForgeLab, a 3D ring builder. You handle TWO modes:

1. ADJUSTMENT MODE — user describes a change to their current ring. You tweak specific parameters.
2. GENERATION MODE — user describes a complete ring concept from scratch. You set ALL relevant parameters to create the described design.

For generation mode, be bold and creative — set many parameters to bring the vision to life. Always enable lunar texture for crater/moon/texture prompts. Always switch to cast mode and pick an appropriate metal when the prompt implies a finished ring.

You have access to these parameters:

RING PARAMETERS:
- width: ring width in mm (3-16). Default 6. Dramatic/bold = 10-14. Minimal = 3-5.
- thickness: ring thickness in mm (1-5). Default 2. Chunky/bold = 3-5. Thin/delicate = 1-1.5.
- size: ring size (3-15). Keep at current unless specified.
- profile: "flat" | "dome" | "comfort" | "square" | "knife-edge". Dramatic = knife-edge. Classic = dome. Modern = flat.
- comfortFit: boolean. Enable for wide rings.
- grooveCount: number of grooves (0-5). Industrialal/mechanical = 2-4. Clean = 0.
- grooveDepth: groove depth (0-1). Deep grooves = 0.6-0.9. Subtle = 0.1-0.3.
- bevelSize: bevel size (0-1). Sharper edges = 0.0-0.2. Softer = 0.4-0.8.

LUNAR TEXTURE (surface craters/texture):
- lunar_enabled: boolean — MUST be true for any textured/cratered/lunar/moon ring
- lunar_intensity: 0-100. Light texturing = 20-40. Dramatic/deep = 70-100.
- lunar_craterDensity: "low" | "med" | "high". Sparse/minimal = low. Dramatic = high.
- lunar_craterSize: "small" | "med" | "large". Fine grain = small. Bold impacts = large.
- lunar_smoothEdges: boolean. Polished feel = true. Raw/rough = false.
- lunar_microDetail: 0-100. Smooth = 10-20. Gritty/rough = 60-100.
- lunar_rimSharpness: 0-100. Soft = 10-30. Sharp/defined = 70-100.
- lunar_overlapIntensity: 0-100. Clean separate craters = 10-30. Chaotic overlapping = 60-100.
- lunar_rimHeight: 0-100. Flat = 10-20. Raised dramatic rims = 60-100.
- lunar_bowlDepth: 0-100. Shallow = 10-30. Deep carved impacts = 60-100.
- lunar_erosion: 0-100. Fresh/sharp = 0-15. Ancient/weathered = 50-100.
- lunar_terrainRoughness: 0-100. Smooth base = 5-15. Rocky terrain = 50-90.
- lunar_craterVariation: 0-100. Uniform = 10-25. Organic/random = 60-100.

VIEW/MATERIAL:
- viewMode: "wax" | "cast" | "wax-print". Use "cast" when describing a finished metal ring.
- metalPreset: "silver" | "gold" | "rose-gold" | "titanium" | "tungsten"
- finishPreset: "polished" | "brushed" | "hammered" | "matte" | "satin"

CREATIVE MAPPING GUIDELINES:
- "lunar" / "moon" / "crater" → enable lunar, high intensity, med-high density
- "dramatic" / "bold" / "statement" → wide ring, thick, high intensity features
- "deep impacts" → large craterSize, high bowlDepth, high rimHeight
- "ancient" / "weathered" / "aged" → high erosion, high craterVariation
- "minimal" / "sleek" / "clean" → thin, flat/dome profile, low or no texture
- "rough" / "raw" / "brutalist" → high terrainRoughness, high microDetail, no smooth edges
- "elegant" / "refined" → dome/comfort profile, polished finish, moderate features
- "volcanic" / "lava" → high intensity, large craters, high overlap, matte or hammered finish
- "space" / "cosmic" / "asteroid" → high variation, mixed sizes, brushed titanium/tungsten
- "organic" / "natural" → high variation, moderate erosion, comfort fit
- "industrial" / "mechanical" → flat profile, grooves, brushed/matte finish, tungsten
- Gold implies warmth, luxury. Titanium implies modern, tough. Silver implies classic.

Only include parameters you want to CHANGE/SET. Always respond with a brief, enthusiastic explanation of the design you're creating.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...messages,
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "adjust_ring_design",
                description:
                  "Adjust or generate ring design parameters. For generation prompts, set ALL relevant parameters to bring the concept to life. For adjustment prompts, only change what's requested.",
                parameters: {
                  type: "object",
                  properties: {
                    width: { type: "number", description: "Ring width in mm (3-16)" },
                    thickness: { type: "number", description: "Ring thickness in mm (1-5)" },
                    profile: { type: "string", enum: ["flat", "dome", "comfort", "square", "knife-edge"] },
                    comfortFit: { type: "boolean" },
                    grooveCount: { type: "integer", description: "Number of grooves (0-5)" },
                    grooveDepth: { type: "number", description: "Groove depth (0-1)" },
                    bevelSize: { type: "number", description: "Bevel size (0-1)" },
                    lunar_enabled: { type: "boolean" },
                    lunar_intensity: { type: "integer", description: "0-100" },
                    lunar_craterDensity: { type: "string", enum: ["low", "med", "high"] },
                    lunar_craterSize: { type: "string", enum: ["small", "med", "large"] },
                    lunar_smoothEdges: { type: "boolean" },
                    lunar_microDetail: { type: "integer", description: "0-100" },
                    lunar_rimSharpness: { type: "integer", description: "0-100" },
                    lunar_overlapIntensity: { type: "integer", description: "0-100" },
                    lunar_rimHeight: { type: "integer", description: "0-100" },
                    lunar_bowlDepth: { type: "integer", description: "0-100" },
                    lunar_erosion: { type: "integer", description: "0-100" },
                    lunar_terrainRoughness: { type: "integer", description: "0-100" },
                    lunar_craterVariation: { type: "integer", description: "0-100" },
                    viewMode: { type: "string", enum: ["wax", "cast", "wax-print"] },
                    metalPreset: { type: "string", enum: ["silver", "gold", "rose-gold", "titanium", "tungsten"] },
                    finishPreset: { type: "string", enum: ["polished", "brushed", "hammered", "matte", "satin"] },
                    explanation: { type: "string", description: "Brief, enthusiastic explanation of the design created" },
                  },
                  required: ["explanation"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "adjust_ring_design" } },
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits depleted. Please add funds in Settings → Usage." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "AI service error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall) {
      const content = data.choices?.[0]?.message?.content || "I couldn't determine what to adjust. Try being more specific!";
      return new Response(
        JSON.stringify({ explanation: content, adjustments: {} }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const args = JSON.parse(toolCall.function.arguments);
    const { explanation, ...adjustments } = args;

    return new Response(
      JSON.stringify({ explanation, adjustments }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("design-assistant error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
