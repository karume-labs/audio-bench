import { amber, dark, rose, teal } from "@/theme/colors";
import type { MantineTheme } from "@mantine/core";

export const cssVariablesResolver = (_theme: MantineTheme) => ({
  variables: {
    "--ab-sidebar-width": "260px",
    "--ab-inspector-width": "320px",
    "--ab-clip-table-height": "240px",
    "--ab-waveform-height": "220px",
  },
  light: {
    "--mantine-color-body": "#F5F5F6",
    "--ab-waveform-bg": "#ECECEE",
    "--ab-wave-color": teal[6],
    "--ab-core-region": teal[6],
    "--ab-export-window": "rgba(45, 150, 140, 0.16)",
    "--ab-cut-line": amber[6],
    "--ab-playhead": rose[6],
    "--ab-dropzone-scrim": "rgba(26, 26, 29, 0.40)",
    // Tooltip = inverse chip: dark surface, light text. Mantine's default
    // falls back to `gray-2`, which in our custom scale is near-white and
    // would render a white tooltip in dark mode.
    "--tooltip-bg": dark[6],
    "--tooltip-color": dark[0],
  },
  dark: {
    "--mantine-color-body": dark[7],
    "--ab-waveform-bg": dark[8],
    "--ab-wave-color": teal[4],
    "--ab-core-region": teal[4],
    "--ab-export-window": "rgba(79, 209, 197, 0.16)",
    "--ab-cut-line": amber[4],
    "--ab-playhead": rose[5],
    "--ab-dropzone-scrim": "rgba(8, 8, 10, 0.66)",
    "--tooltip-bg": dark[5],
    "--tooltip-color": dark[0],
  },
});
