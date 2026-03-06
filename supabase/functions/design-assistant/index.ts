import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are a ring design assistant for ForgeLab, a 3D ring builder. Users describe what they want and you adjust ring parameters by calling the adjust_ring_design tool.

You have access to these parameters:

RING PARAMETERS:
- width: ring width in mm (3-16)
- thickness: ring thickness in mm (1-5)
- profile: "flat" | "dome" | "comfort" | "square" | "knife-edge"
- comfortFit: boolean
- grooveCount: number of grooves (0-5)
- grooveDepth: groove depth (0-1)
- bevelSize: bevel size (0-1)

LUNAR TEXTURE (surface craters):
- lunar_enabled: boolean - turn on/off the lunar crater surface
- lunar_intensity: 0-100, overall depth of surface features
- lunar_craterDensity: "low" | "med" | "high"
- lunar_craterSize: "small" | "med" | "large"
- lunar_smoothEdges: boolean
- lunar_microDetail: 0-100, fine surface grain
- lunar_rimSharpness: 0-100, sharpness of crater rims
- lunar_overlapIntensity: 0-100, how much craters overlap
- lunar_rimHeight: 0-100, how much rims protrude
- lunar_bowlDepth: 0-100, how deep crater bowls carve
- lunar_erosion: 0-100, weathering/softening
- lunar_terrainRoughness: 0-100, base landscape bumpiness
- lunar_craterVariation: 0-100, per-crater randomness

VIEW/MATERIAL:
- viewMode: "wax" | "cast" | "wax-print"
- metalPreset: "silver" | "gold" | "rose-gold" | "titanium" | "tungsten"
- finishPreset: "polished" | "brushed" | "hammered" | "matte" | "satin"

Guidelines:
- When users say "more lunar" or "moon-like", enable lunar texture and increase intensity/density.
- When users say "rougher", increase terrainRoughness and microDetail.
- When users say "smoother", decrease terrainRoughness, increase erosion, enable smoothEdges.
- When users say "more craters", increase craterDensity and overlapIntensity.
- When users say "sharper", increase rimSharpness and rimHeight.
- When users say "weathered" or "ancient", increase erosion and craterVariation.
- When users mention a metal like "gold" or "titanium", set metalPreset and switch viewMode to "cast".
- Only include parameters you want to CHANGE, not all parameters.
- Always respond with a brief explanation of what you changed and why.`;

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
                  "Adjust ring design parameters based on the user's request. Only include parameters you want to change.",
                parameters: {
                  type: "object",
                  properties: {
                    // Ring params
                    width: { type: "number", description: "Ring width in mm (3-16)" },
                    thickness: { type: "number", description: "Ring thickness in mm (1-5)" },
                    profile: { type: "string", enum: ["flat", "dome", "comfort", "square", "knife-edge"] },
                    comfortFit: { type: "boolean" },
                    grooveCount: { type: "integer", description: "Number of grooves (0-5)" },
                    grooveDepth: { type: "number", description: "Groove depth (0-1)" },
                    bevelSize: { type: "number", description: "Bevel size (0-1)" },
                    // Lunar
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
                    // View/material
                    viewMode: { type: "string", enum: ["wax", "cast", "wax-print"] },
                    metalPreset: { type: "string", enum: ["silver", "gold", "rose-gold", "titanium", "tungsten"] },
                    finishPreset: { type: "string", enum: ["polished", "brushed", "hammered", "matte", "satin"] },
                    // Explanation
                    explanation: { type: "string", description: "Brief explanation of what was changed and why" },
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
      // Fallback: return raw content
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
