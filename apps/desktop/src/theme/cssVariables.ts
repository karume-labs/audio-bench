import type { MantineTheme } from "@mantine/core";
import { amber, dark, rose, teal } from "./colors";

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
  },
  dark: {
    "--mantine-color-body": dark[7],
    "--ab-waveform-bg": dark[8],
    "--ab-wave-color": teal[4],
    "--ab-core-region": teal[4],
    "--ab-export-window": "rgba(79, 209, 197, 0.16)",
    "--ab-cut-line": amber[4],
    "--ab-playhead": rose[5],
  },
});
