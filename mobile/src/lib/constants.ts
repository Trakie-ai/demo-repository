// Design tokens
export const colors = {
  primary: "#2D6A4F",
  primaryLight: "#40916C",
  bgPrimary: "#0A0A0A",
  bgCard: "#1A1A1A",
  border: "#2A2A2A",
  textPrimary: "#F5F5F5",
  textSecondary: "#A0A0A0",
} as const;

// Environment
export const RELAY_URL =
  process.env.NEXT_PUBLIC_RELAY_URL || "http://localhost:3001";
