import { ForgeStageMeta } from "@/types/pipeline";

export const STAGES: ForgeStageMeta[] = [
  {
    id: "WAX_SCULPT",
    label: "Wax Sculpt",
    description: "Shape the wax model — adjust profile, width, grooves, and bevels.",
    defaultViewMode: "wax",
  },
  {
    id: "MOLD_PREP",
    label: "Mold Prep",
    description: "Prepare the investment mold around the wax model.",
    defaultViewMode: "wax",
    notes: "The wax tree is encased in plaster-like investment.",
  },
  {
    id: "BURNOUT",
    label: "Burnout",
    description: "Heat the mold to burn out the wax, leaving a hollow cavity.",
    defaultViewMode: "wax",
  },
  {
    id: "POUR",
    label: "Pour",
    description: "Pour molten metal into the mold cavity.",
    defaultViewMode: "cast",
  },
  {
    id: "QUENCH",
    label: "Quench",
    description: "Cool the casting and break away the investment mold.",
    defaultViewMode: "cast",
  },
  {
    id: "FINISH",
    label: "Finish",
    description: "Polish, texture, and apply the final surface treatment.",
    defaultViewMode: "cast",
  },
];
