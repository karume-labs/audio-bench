import { createTheme } from "@mantine/core";
import { amber, dark, rose, teal } from "./colors";

export const theme = createTheme({
  primaryColor: "teal",
  primaryShade: { light: 6, dark: 4 },
  autoContrast: true,
  colors: {
    teal,
    dark,
    amber,
    rose,
  },
  fontFamily: "Inter, system-ui, sans-serif",
  fontFamilyMonospace: "JetBrains Mono, monospace",
  headings: {
    fontFamily: "Space Grotesk, system-ui, sans-serif",
    fontWeight: "700",
    sizes: {
      h1: { fontSize: "28px", lineHeight: "1.2" },
      h2: { fontSize: "22px", lineHeight: "1.25" },
      h3: { fontSize: "18px", lineHeight: "1.3" },
      h4: { fontSize: "15px", lineHeight: "1.35" },
      h5: { fontSize: "13px", lineHeight: "1.4" },
      h6: { fontSize: "11px", lineHeight: "1.45" },
    },
  },
  fontSizes: {
    xs: "11px",
    sm: "12px",
    md: "13px",
    lg: "15px",
    xl: "18px",
  },
  spacing: {
    xs: "6px",
    sm: "10px",
    md: "14px",
    lg: "20px",
    xl: "28px",
  },
  radius: {
    xs: "2px",
    sm: "4px",
    md: "8px",
    lg: "12px",
    xl: "20px",
  },
  defaultRadius: "sm",
  components: {
    Button: {
      defaultProps: { size: "sm" },
      styles: { root: { fontWeight: 600 } },
    },
    ActionIcon: {
      defaultProps: { variant: "subtle", color: "gray" },
    },
    Badge: {
      defaultProps: { variant: "light", size: "sm" },
    },
    Paper: {
      defaultProps: { radius: "md", withBorder: true },
    },
    TextInput: { defaultProps: { size: "sm" } },
    NumberInput: { defaultProps: { size: "sm" } },
    Select: { defaultProps: { size: "sm" } },
    SegmentedControl: { defaultProps: { size: "sm" } },
    Table: {
      defaultProps: { fz: "xs", highlightOnHover: true },
    },
    Modal: {
      defaultProps: { centered: true, overlayProps: { blur: 2 } },
    },
    Tooltip: {
      defaultProps: { openDelay: 300, withArrow: true },
    },
    Kbd: { defaultProps: { ff: "monospace" } },
    Code: { defaultProps: { ff: "monospace" } },
  },
});
