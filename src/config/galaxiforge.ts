export const GALAXIFORGE_CONFIG = {
  BASE_URL: "https://galaxiforge.com",
  HANDOFF_ENDPOINT: "/api/designs/receive",
  RETURN_PATH: "/my-designs",
  EMBED_MODE_BEHAVIOR: {
    hideHeader: true,
    hideFooter: true,
    showReturnButton: true,
  },
};

export const getReturnUrl = (designId?: string) => {
  const base = `${GALAXIFORGE_CONFIG.BASE_URL}${GALAXIFORGE_CONFIG.RETURN_PATH}`;
  return designId ? `${base}/${designId}` : base;
};

export const getHandoffUrl = () =>
  `${GALAXIFORGE_CONFIG.BASE_URL}${GALAXIFORGE_CONFIG.HANDOFF_ENDPOINT}`;

export const isEmbedMode = () => {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return params.get("embed") === "1";
};
