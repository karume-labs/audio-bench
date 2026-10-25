import { Alert, Center, Group, Loader, Stack, Text } from "@mantine/core";
import { convertFileSrc } from "@tauri-apps/api/core";
import { memo, useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.js";
import type { Region } from "wavesurfer.js/dist/plugins/regions.js";
import { generatePeaks } from "../ipc/commands";
import { SAMPLE_RATE, samplesToSeconds } from "../lib/format";
import { waveformBridge } from "../lib/waveformBridge";
import { useEditorStore } from "../stores/useEditorStore";
import { useProjectStore } from "../stores/useProjectStore";

const EXPORT_REGION_ID = "__export_window__";

const clipColor = (status: string, active: boolean): string => {
  if (active) return "rgba(37, 99, 235, 0.32)";
  if (status === "approved") return "rgba(34, 197, 94, 0.18)";
  if (status === "rejected") return "rgba(239, 68, 68, 0.20)";
  return "rgba(245, 158, 11, 0.16)";
};

function WaveformWorkspace() {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const regionsRef = useRef<RegionsPlugin | null>(null);
  const windowModeRef = useRef(false);

  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const project = useProjectStore((s) => s.project);
  const masterPath = project?.source.master_path ?? null;
  const durationSamples = project?.source.duration_samples ?? 0;
  const clips = project?.clips ?? [];
  const activeClipId = useEditorStore((s) => s.activeClipId);
  const zoom = useEditorStore((s) => s.zoom);

  // ---- Create the wavesurfer instance when the master changes ----
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

      const ws = WaveSurfer.create({
        container,
        height: 220,
        url: convertFileSrc(masterPath),
        peaks: [peaks.positive],
        duration: durationSamples / SAMPLE_RATE,
        waveColor: "#4b5563",
        progressColor: "#2563eb",
        cursorColor: "#f8fafc",
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
        const message = err instanceof Error ? err.message : String(err);
        setLoadError(message);
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
      setReady(false);
    };
  }, [masterPath, durationSamples]);

  // ---- Sync regions with clip state ----
  useEffect(() => {
    const regions = regionsRef.current;
    if (!ready || !regions) return;
    regions.clearRegions();

    const active = clips.find((c) => c.id === activeClipId);
    if (active && durationSamples > 0) {
      const settings = project?.export_settings;
      const pre = settings?.pre_window_s ?? 5;
      const post = settings?.post_window_s ?? 5;
      regions.addRegion({
        id: EXPORT_REGION_ID,
        start:
          Math.max(0, active.core_start_sample - pre * SAMPLE_RATE) /
          SAMPLE_RATE,
        end:
          Math.min(
            durationSamples,
            active.core_end_sample + post * SAMPLE_RATE,
          ) / SAMPLE_RATE,
        color: "rgba(99, 102, 241, 0.13)",
        drag: false,
        resize: false,
      });
    }

    for (const clip of clips) {
      const isActive = clip.id === activeClipId;
      regions.addRegion({
        id: clip.id,
        start: samplesToSeconds(clip.core_start_sample),
        end: samplesToSeconds(clip.core_end_sample),
        color: clipColor(clip.status, isActive),
        drag: false,
        resize: false,
      });
    }
  }, [ready, clips, activeClipId, durationSamples, project?.export_settings]);

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
      // not loaded yet — ignore
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

  if (loadError) {
    return (
      <Center h="100%" p="md">
        <Alert color="red" title="Waveform failed to load">
          {loadError}
        </Alert>
      </Center>
    );
  }

  return (
    <Stack gap="xs" h="100%" p="sm" justify="center">
      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          Core regions (solid) · export window (shaded, 5s pad each side)
        </Text>
        {!ready && (
          <Group gap="xs">
            <Loader size="xs" />
            <Text size="xs" c="dimmed">
              Generating peaks…
            </Text>
          </Group>
        )}
      </Group>
      <div ref={containerRef} style={{ minHeight: 220 }} />
    </Stack>
  );
}

export default memo(WaveformWorkspace);
