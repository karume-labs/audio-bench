import { generatePeaks } from "@/ipc/commands";
import { SAMPLE_RATE, samplesToSeconds } from "@/lib/format";
import { waveformBridge } from "@/lib/waveformBridge";
import { useEditorStore } from "@/stores/useEditorStore";
import { useProjectStore } from "@/stores/useProjectStore";
import { getWaveformColors } from "@/theme";
import { Alert, Center, Group, Skeleton, Stack, Text } from "@mantine/core";
import { useMantineColorScheme } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { convertFileSrc } from "@tauri-apps/api/core";
import { memo, useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.js";
import type { Region } from "wavesurfer.js/dist/plugins/regions.js";

const EXPORT_REGION_ID = "__export_window__";

function WaveformWorkspaceComponent() {
  const containerRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const regionsRef = useRef<RegionsPlugin | null>(null);
  const windowModeRef = useRef(false);
  const objectUrlRef = useRef<string | null>(null);

  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const isMobile = useMediaQuery("(max-width: 768px)");
  const waveHeight = isMobile ? 150 : 220;
  const waveHeightRef = useRef(waveHeight);
  waveHeightRef.current = waveHeight;

  const project = useProjectStore((s) => s.project);
  const masterPath = project?.source.master_path ?? null;
  const previewPath = project?.source.preview_path ?? masterPath;
  const durationSamples = project?.source.duration_samples ?? 0;
  const clips = project?.clips ?? [];
  const activeClipId = useEditorStore((s) => s.activeClipId);
  const zoom = useEditorStore((s) => s.zoom);
  const colorScheme = useMantineColorScheme();
  const wfColors = getWaveformColors(
    colorScheme.colorScheme === "light" ? "light" : "dark",
  );
  const wfColorsRef = useRef(wfColors);
  wfColorsRef.current = wfColors;

  useEffect(() => {
    if (!masterPath || !containerRef.current) return;
    const container = containerRef.current;
    let disposed = false;
    setReady(false);
    setLoadError(null);

    (async () => {
      // Backend-precomputed peaks: instant render, no full-file decode (PRD §4).
      const width = Math.max(640, Math.round(container.clientWidth * 1.5));
      const peaks = await generatePeaks(masterPath, width);
      if (disposed) return;

      const audioSrc = convertFileSrc(previewPath ?? masterPath);
      let objectUrl: string | null = null;
      try {
        const response = await fetch(audioSrc);
        if (response.ok) {
          const blob = await response.blob();
          objectUrl = URL.createObjectURL(blob);
        }
      } catch {
        // Fall back to original convertFileSrc url if fetch fails
      }
      if (disposed) {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        return;
      }
      objectUrlRef.current = objectUrl;

      const ws = WaveSurfer.create({
        container,
        height: waveHeightRef.current,
        url: objectUrl ?? audioSrc,
        peaks: [peaks.positive],
        duration: durationSamples / SAMPLE_RATE,
        waveColor: wfColorsRef.current.wave,
        progressColor: wfColorsRef.current.waveProgress,
        cursorColor: wfColorsRef.current.cursor,
        cursorWidth: 2,
        fillParent: true,
        dragToSeek: true,
        autoScroll: true,
        autoCenter: true,
      });
      wsRef.current = ws;

      const regions = ws.registerPlugin(RegionsPlugin.create());
      regionsRef.current = regions;

      ws.on("timeupdate", (t) => useEditorStore.getState().setPlayhead(t));
      ws.on("play", () =>
        useEditorStore.getState().setPlaying(true, windowModeRef.current),
      );
      const stopFlags = () => {
        windowModeRef.current = false;
        useEditorStore.getState().setPlaying(false);
      };
      ws.on("pause", stopFlags);
      ws.on("finish", stopFlags);
      ws.on("error", (err) => {
        const code =
          err && typeof err === "object" && "code" in err
            ? (err as { code?: number }).code
            : undefined;
        const message =
          err instanceof Error
            ? err.message
            : err && typeof err === "object" && "message" in err
              ? String((err as { message?: unknown }).message)
              : String(err);
        setLoadError(
          `Waveform failed to load (media error ${code ?? "?"}): ${message}. ` +
            `master=${masterPath ?? "?"} preview=${previewPath ?? "?"}`,
        );
      });

      regions.on("region-clicked", (region: Region, e: MouseEvent) => {
        e.stopPropagation();
        if (region.id === EXPORT_REGION_ID) return;
        useEditorStore.getState().setActive(region.id);
        ws.setTime(region.start);
      });

      waveformBridge.actions = {
        togglePlay: () => {
          void ws.playPause();
        },
        playExportWindow: () => {
          const state = useProjectStore.getState();
          const editor = useEditorStore.getState();
          const p = state.project;
          const clip = p?.clips.find((c) => c.id === editor.activeClipId);
          if (!p || !clip) return;
          const pre = p.export_settings?.pre_window_s ?? 5;
          const post = p.export_settings?.post_window_s ?? 5;
          const total = p.source.duration_samples ?? 0;
          const start =
            Math.max(0, clip.core_start_sample - pre * SAMPLE_RATE) /
            SAMPLE_RATE;
          const end =
            Math.min(total, clip.core_end_sample + post * SAMPLE_RATE) /
            SAMPLE_RATE;
          windowModeRef.current = true;
          void ws.play(start, end);
        },
        seek: (seconds) => ws.setTime(seconds),
      };

      setReady(true);
    })().catch((err) => {
      if (!disposed) {
        setLoadError(err instanceof Error ? err.message : String(err));
      }
    });

    return () => {
      disposed = true;
      waveformBridge.actions = null;
      regionsRef.current = null;
      wsRef.current?.destroy();
      wsRef.current = null;
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      setReady(false);
    };
  }, [masterPath, previewPath, durationSamples]);

  // ---- Re-apply waveform colours when the colour scheme changes (no audio reload) ----
  useEffect(() => {
    const ws = wsRef.current;
    if (!ready || !ws) return;
    try {
      ws.setOptions({
        waveColor: wfColors.wave,
        progressColor: wfColors.waveProgress,
        cursorColor: wfColors.cursor,
      });
    } catch {
      // ignore
    }
  }, [ready, wfColors]);

  // ---- Sync regions with clip state ----
  useEffect(() => {
    const regions = regionsRef.current;
    if (!ready || !regions) return;
    regions.clearRegions();

    const total = durationSamples || 1;
    const bg = bgRef.current;
    if (bg) {
      bg.innerHTML = "";
      const mkRect = (
        startSample: number,
        endSample: number,
        color: string,
      ) => {
        const left = (startSample / total) * 100;
        const width = ((endSample - startSample) / total) * 100;
        const el = document.createElement("div");
        el.style.position = "absolute";
        el.style.top = "0";
        el.style.bottom = "0";
        el.style.left = `${left}%`;
        el.style.width = `${width}%`;
        el.style.background = color;
        bg.appendChild(el);
      };

      const active = clips.find((c) => c.id === activeClipId);
      if (active && durationSamples > 0) {
        const settings = project?.export_settings;
        const pre = settings?.pre_window_s ?? 5;
        const post = settings?.post_window_s ?? 5;
        mkRect(
          Math.max(0, active.core_start_sample - pre * SAMPLE_RATE),
          Math.min(
            durationSamples,
            active.core_end_sample + post * SAMPLE_RATE,
          ),
          wfColors.exportWindow,
        );
      }

      for (const clip of clips) {
        const color =
          clip.status === "rejected"
            ? wfColors.rejectedRegion
            : (clip.flags?.length ?? 0) > 0
              ? wfColors.flaggedRegion
              : wfColors.coreRegion;
        mkRect(clip.core_start_sample, clip.core_end_sample, color);
      }
    }

    // Transparent click targets (regions) on top of the background layer.
    const active2 = clips.find((c) => c.id === activeClipId);
    if (active2 && durationSamples > 0) {
      const settings = project?.export_settings;
      const pre = settings?.pre_window_s ?? 5;
      const post = settings?.post_window_s ?? 5;
      regions.addRegion({
        id: EXPORT_REGION_ID,
        start:
          Math.max(0, active2.core_start_sample - pre * SAMPLE_RATE) /
          SAMPLE_RATE,
        end:
          Math.min(
            durationSamples,
            active2.core_end_sample + post * SAMPLE_RATE,
          ) / SAMPLE_RATE,
        color: "transparent",
        drag: false,
        resize: false,
      });
    }

    for (const clip of clips) {
      regions.addRegion({
        id: clip.id,
        start: samplesToSeconds(clip.core_start_sample),
        end: samplesToSeconds(clip.core_end_sample),
        color: "transparent",
        drag: false,
        resize: false,
      });
    }
  }, [
    ready,
    clips,
    activeClipId,
    durationSamples,
    project?.export_settings,
    wfColors,
  ]);

  // ---- Scroll the active region into view ----
  useEffect(() => {
    if (!ready || !activeClipId) return;
    const regions = regionsRef.current;
    if (!regions) return;
    const region = regions.getRegions().find((r) => r.id === activeClipId);
    if (region?.element) {
      region.element.scrollIntoView({ block: "nearest", inline: "center" });
    }
  }, [ready, activeClipId]);

  // ---- Zoom (0 means "fit", which is wavesurfer's default) ----
  useEffect(() => {
    const ws = wsRef.current;
    if (!ready || !ws || zoom <= 0) return;
    try {
      ws.zoom(zoom);
    } catch {
      // not loaded yet - ignore
    }
  }, [ready, zoom]);

  if (!project) {
    return (
      <Center h="100%">
        <Stack align="center" gap="xs">
          <Text c="dimmed" size="lg">
            No session loaded
          </Text>
          <Text c="dimmed" size="sm">
            Drop an audio file anywhere in the window, or use the buttons in the
            sidebar
          </Text>
        </Stack>
      </Center>
    );
  }

  return (
    <Stack gap="xs" h="100%" p="sm" justify="center">
      {loadError && (
        <Alert color="rose" title="Waveform failed to load">
          {loadError}
        </Alert>
      )}
      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          Core regions (solid) · export window (shaded, 5s pad each side)
        </Text>
        {!ready && (
          <Group gap="xs">
            <Skeleton width={120} height={12} />
            <Text size="xs" c="dimmed">
              Generating peaks…
            </Text>
          </Group>
        )}
      </Group>
      <div style={{ position: "relative", minHeight: waveHeight, flex: 1 }}>
        <div
          ref={bgRef}
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 0,
            pointerEvents: "none",
            overflow: "hidden",
          }}
        />
        <div
          ref={containerRef}
          style={{ position: "relative", zIndex: 1, minHeight: waveHeight }}
        />
      </div>
    </Stack>
  );
}

export const WaveformWorkspace = memo(WaveformWorkspaceComponent);
