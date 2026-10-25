import {
  AppShell,
  Badge,
  Group,
  Kbd,
  Loader,
  Stack,
  Text,
  Title,
  UnstyledButton,
} from "@mantine/core";
import { nprogress } from "@mantine/nprogress";
import { IconUpload } from "@tabler/icons-react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { useEffect } from "react";
import ClipInspector from "./components/ClipInspector";
import ClipTable from "./components/ClipTable";
import ProjectSidebar from "./components/ProjectSidebar";
import WaveformWorkspace from "./components/WaveformWorkspace";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { isTauri } from "./ipc/commands";
import { onAnalysisProgress } from "./ipc/events";
import { formatTimecode } from "./lib/format";
import { notifyError, notifyInfo } from "./lib/notify";
import { useEditorStore } from "./stores/useEditorStore";
import { useProjectStore } from "./stores/useProjectStore";

const TABLE_HEIGHT = 244;

export default function App() {
  useKeyboardShortcuts();

  const busy = useProjectStore((s) => s.busy);
  const exporting = useProjectStore((s) => s.exporting);
  const progress = useProjectStore((s) => s.progress);
  const project = useProjectStore((s) => s.project);
  const ingestPath = useProjectStore((s) => s.ingestPath);
  const setProgress = useProjectStore((s) => s.setProgress);

  const playhead = useEditorStore((s) => s.playhead);
  const playing = useEditorStore((s) => s.playing);
  const playingWindow = useEditorStore((s) => s.playingWindow);

  // ---- Backend progress -> notification center + top progress bar ----
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;

    void onAnalysisProgress((p) => {
      setProgress(p);
      // nprogress.set() takes 0..100; backend pct arrives as 0..1.
      nprogress.set(Math.max(0, Math.min(1, p.pct)) * 100);
    }).then((fn) => {
      if (cancelled) fn();
      else unlisten = fn;
    });

    return () => {
      cancelled = true;
      unlisten?.();
      setProgress(null);
    };
  }, [setProgress]);

  // ---- Busy/exporting -> mount or retire the top progress bar.
  // Kept separate from the exact-percentage effect above: nprogress.start()
  // self-increments, so it must only run when the flag *changes*.
  useEffect(() => {
    if (busy || exporting) nprogress.start();
    else nprogress.complete();
  }, [busy, exporting]);

  // ---- Native drag & drop routing (Tauri webview, not HTML5) ----
  useEffect(() => {
    if (!isTauri()) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;

    void getCurrentWebview()
      .onDragDropEvent((event) => {
        if (event.payload.type !== "drop") return;
        const paths = event.payload.paths ?? [];
        if (paths.length === 0) return;
        void ingestPath(paths[0]);
      })
      .then((fn) => {
        if (disposed) fn();
        else unlisten = fn;
      })
      .catch((err) => notifyError("Drag & drop unavailable", err));

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [ingestPath]);

  const onDropHint = (): void => {
    notifyInfo(
      "Drop files here",
      "Drag an audio file or a .audiobench project anywhere in this window.",
    );
  };

  return (
    <AppShell
      header={{ height: 52 }}
      navbar={{
        width: 288,
        breakpoint: "sm",
        collapsed: { desktop: false, mobile: true },
      }}
      aside={{
        width: 336,
        breakpoint: "lg",
        collapsed: { desktop: false, mobile: true },
      }}
      padding={0}
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <UnstyledButton
              onClick={onDropHint}
              title="Drop files anywhere to import"
            >
              <Group gap="xs" wrap="nowrap">
                <IconUpload size={18} stroke={1.7} />
                <Title order={5}>Audio Workbench</Title>
              </Group>
            </UnstyledButton>
            {project && (
              <Badge size="sm" variant="light" color="gray">
                24-bit · 48 kHz · mono
              </Badge>
            )}
          </Group>

          <Group gap="md" wrap="nowrap">
            {(busy || exporting) && (
              <Group gap="xs" wrap="nowrap">
                <Loader size="xs" />
                <Text size="xs" c="dimmed">
                  {progress
                    ? progress.message
                    : exporting
                      ? "Exporting…"
                      : "Analyzing…"}
                </Text>
              </Group>
            )}
            {project && (
              <Group gap="xs" wrap="nowrap">
                <Badge
                  size="sm"
                  variant="dot"
                  color={playingWindow ? "grape" : playing ? "green" : "gray"}
                >
                  {playingWindow ? "window" : playing ? "playing" : "stopped"}
                </Badge>
                <Text size="sm" ff="monospace">
                  {formatTimecode(playhead)}
                </Text>
              </Group>
            )}
            <Group gap={6} visibleFrom="md">
              <Kbd size="xs">Space</Kbd>
              <Kbd size="xs">↑↓</Kbd>
              <Kbd size="xs">S</Kbd>
              <Kbd size="xs">M</Kbd>
              <Kbd size="xs">A</Kbd>
            </Group>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p={0}>
        <ProjectSidebar />
      </AppShell.Navbar>

      <AppShell.Aside p={0}>
        <ClipInspector />
      </AppShell.Aside>

      <AppShell.Main>
        <Stack
          gap={0}
          style={{
            minHeight: "calc(100vh - 52px)",
          }}
        >
          <div
            style={{
              height: `calc(100vh - 52px - ${TABLE_HEIGHT}px)`,
              minHeight: 260,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <WaveformWorkspace />
          </div>

          <div
            style={{
              height: TABLE_HEIGHT,
              borderTop: "1px solid var(--mantine-color-default-border)",
              overflow: "hidden",
            }}
          >
            <ClipTable />
          </div>
        </Stack>
      </AppShell.Main>
    </AppShell>
  );
}
