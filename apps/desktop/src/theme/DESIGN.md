# Design System - audio-bench desktop

This document describes the Mantine theme and design tokens for `apps/desktop`.
All feature code must use these tokens instead of hard-coding colours, fonts, spacing or radii.

## Location

- `apps/desktop/src/theme/` - theme modules, exported from `index.ts`.
- `apps/desktop/src/main.tsx` - provider wiring (theme, cssVariablesResolver, dark default, fonts).

## Colours

Defined as full 10-shade Mantine scales in `colors.ts`.

| Scale | Purpose | Stated shade |
|---|---|---|
| `teal` | Brand + primary (audio, approved) | 4 = `#4FD1C5` |
| `dark` | Neutrals (text → background) | 0 text `#E8EDF4`, 2 dimmed `#8C9BB1`, 4 borders `#33445E`, 5 hover `#263650`, 6 surfaces `#16253A`, 7 app bg `#0F1B2D`, 8 recessed `#0B1524`, 9 `#070E19` |
| `amber` | Cut line, warnings, flagged | 4 = `#FBBF24` |
| `rose` | Playhead, rejected, destructive, errors | 5 = `#F43F5E` |

Primary colour is `teal`. Primary shade: 6 (light), 4 (dark). Auto-contrast is on.

### Semantic rules

- Teal = audio & approved. Amber = cut line / warning / flagged. Rose = playhead / rejected / destructive. Never decorative.
- Clip status mapping (exported as `CLIP_STATUS_COLOR`): proposed = gray, approved = teal, rejected = rose.
- Clip flags (`duration_outlier`, `edge_clamped`) = amber (`CLIP_FLAG_COLOR`).
- Never rely on colour alone: statuses also need an icon and a text label (`CLIP_STATUS_LABEL`).

## Typography

- UI: Inter. Headings/wordmark: Space Grotesk 700. Mono: JetBrains Mono.
- Compact scale: xs 11px, sm 12px, md 13px (base), lg 15px, xl 18px.
- Headings: h1 28, h2 22, h3 18, h4 15, h5 13, h6 11.
- Mono is mandatory for script IDs, timestamps, sample indices and file names. IDs are strings with leading zeros - never format as numbers.

## Spacing, radius, depth

- Spacing: xs 6, sm 10, md 14, lg 20, xl 28 (px).
- Radius: xs 2, sm 4, md 8, lg 12, xl 20. Default radius is `sm`.
- Flat: depth from surface colour + 1px borders. Shadows only for floating layers (menus, modals, tooltips).

## Component defaults

- Button: size sm, semi-bold (600). One filled teal primary per view; others light/subtle; destructive uses rose.
- ActionIcon: subtle, gray, with aria-label + tooltip showing the shortcut.
- Badge: light variant, small, colours only from the semantic mapping.
- Paper: bordered, radius md, no shadow.
- Inputs (TextInput, NumberInput, Select, SegmentedControl): size sm.
- Table: compact, sticky header on recessed colour, hover highlight, selected row = teal left edge, IDs in mono.
- Modal: centered, dimmed overlay with slight blur - only for destructive confirms and export settings.
- Tooltip: 300ms open delay, with arrow.
- Kbd and Code: mono font.
- Visible focus ring everywhere.

## Custom CSS variables

Defined via `cssVariablesResolver` (separate light/dark values):

Layout: `--ab-sidebar-width: 260px`, `--ab-inspector-width: 320px`, `--ab-clip-table-height: 240px`, `--ab-waveform-height: 220px`.

Waveform: `--ab-waveform-bg` (dark 8), `--ab-wave-color` (teal), `--ab-core-region` (teal), `--ab-export-window` (teal 16%), `--ab-cut-line` (amber), `--ab-playhead` (rose).

## Wavesurfer integration

Wavesurfer cannot read CSS variables. `WAVEFORM_COLORS` in `waveformColors.ts` exports raw colour strings and **must stay in sync** with the CSS variables above.

Values: background `#0B1524`, wave `rgba(79,209,197,0.55)`, wave progress `#4FD1C5`, cursor `#E8EDF4`, core region `rgba(79,209,197,0.90)`, export window `rgba(79,209,197,0.16)`, cut line `#FBBF24`, playhead `#F43F5E`, rejected region `rgba(244,63,94,0.28)`, flagged region `rgba(251,191,36,0.28)`.

Visual rules: core region is solid teal; the 5s export window is the lighter shaded area behind it (mirrors the logo); cut marker is a 2px amber line; playhead is a 2px rose line with a small triangle on top. The only animated element on the waveform is the playhead.

## Accessibility and motion

- AA contrast (teal on app background ~9:1, dimmed text ~6:1).
- Everything reachable by keyboard.
- Transitions 120–160ms ease-out; respect `prefers-reduced-motion`.

## Fonts

Bundled locally via `@fontsource/*` in `main.tsx`. No network dependency.
