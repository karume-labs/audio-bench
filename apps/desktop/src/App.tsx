import {
  ActionIcon,
  AppShell,
  Badge,
  Burger,
  Button,
  Drawer,
  Group,
  Kbd,
  Loader,
  SegmentedControl,
  Stack,
  Text,
  Title,
  UnstyledButton,
  useMantineColorScheme,
} from "@mantine/core";
import { useDisclosure, useMediaQuery } from "@mantine/hooks";
import { nprogress } from "@mantine/nprogress";
import {
  IconArrowBackUp,
  IconArrowForwardUp,
  IconBrightnessAuto,
  IconInfoCircle,
  IconMoon,
  IconSunHigh,
} from "@tabler/icons-react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { useEffect, useState } from "react";
import AboutModal from "./components/AboutModal";
import ClipInspector from "./components/ClipInspector";
import ClipTable from "./components/ClipTable";
import ProjectSidebar from "./components/ProjectSidebar";
import WaveformWorkspace from "./components/WaveformWorkspace";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { isTauri } from "./ipc/commands";
import { onAnalysisProgress } from "./ipc/events";
import { formatTimecode } from "./lib/format";
import { notifyError, notifyInfo } from "./lib/notify";
import { ensureNotificationPermission } from "./lib/osNotify";
import { useEditorStore } from "./stores/useEditorStore";
import { useProjectStore } from "./stores/useProjectStore";

export default function App() {
  useKeyboardShortcuts();

  const [splashVisible, setSplashVisible] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSplashVisible(false), 1500);
    return () => clearTimeout(t);
  }, []);

  const [navbarOpened, { toggle: toggleNavbar }] = useDisclosure(false);
  const [inspectorOpened, { open: openInspector, close: closeInspector }] =
    useDisclosure(false);
  const [aboutOpened, { open: openAbout, close: closeAbout }] =
    useDisclosure(false);

  const colorScheme = useMantineColorScheme();

  const isMobile = useMediaQuery("(max-width: 768px)");
  const tableHeight = isMobile ? 180 : 244;
  const headerHeight = 52;

  const busy = useProjectStore((s) => s.busy);
  const exporting = useProjectStore((s) => s.exporting);
  const progress = useProjectStore((s) => s.progress);
  const project = useProjectStore((s) => s.project);
  const ingestPath = useProjectStore((s) => s.ingestPath);
  const setProgress = useProjectStore((s) => s.setProgress);
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);
  const canUndo = useProjectStore((s) => s.undoStack.length > 0);
  const canRedo = useProjectStore((s) => s.redoStack.length > 0);

  const playhead = useEditorStore((s) => s.playhead);
  const playing = useEditorStore((s) => s.playing);
  const playingWindow = useEditorStore((s) => s.playingWindow);

  useEffect(() => {
    void ensureNotificationPermission();
  }, []);

  useEffect(() => {
    const onDragOver = (_e: DragEvent) => {
      _e.preventDefault();
      setIsDragging(true);
    };
    const onDragLeave = (_e: DragEvent) => {
      setTimeout(() => setIsDragging(false), 150);
    };
    const onDrop = (_e: DragEvent) => {
      setIsDragging(false);
    };
    document.addEventListener("dragover", onDragOver);
    document.addEventListener("dragleave", onDragLeave);
    document.addEventListener("drop", onDrop);
    return () => {
      document.removeEventListener("dragover", onDragOver);
      document.removeEventListener("dragleave", onDragLeave);
      document.removeEventListener("drop", onDrop);
    };
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;

    void onAnalysisProgress((p) => {
      setProgress(p);
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

  useEffect(() => {
    if (busy || exporting) nprogress.start();
    else nprogress.complete();
  }, [busy, exporting]);

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
      "Drop an audio file or a .audiobench project anywhere in this window.",
    );
  };

  return (
    <div style={{ display: "contents" }}>
      <AppShell
        header={{ height: headerHeight }}
        navbar={{
          width: 288,
          breakpoint: "sm",
          collapsed: { mobile: !navbarOpened, desktop: false },
        }}
        aside={{
          width: 336,
          breakpoint: "md",
          collapsed: { mobile: true, desktop: false },
        }}
        padding={0}
      >
        <AppShell.Header>
          <Group h="100%" px="md" justify="space-between" wrap="nowrap">
            <Group gap="sm" wrap="nowrap">
              <Burger
                opened={navbarOpened}
                onClick={toggleNavbar}
                hiddenFrom="sm"
                size="sm"
                aria-label="Toggle sidebar"
              />
              <UnstyledButton
                onClick={onDropHint}
                title="Drop files anywhere to import"
              >
                <Group gap="sm" wrap="nowrap">
                  <img
                    src="/logo.png"
                    alt="audio-bench logo"
                    width={24}
                    height={24}
                    style={{ borderRadius: 4, display: "block" }}
                  />
                  <Title order={5}>Audio Bench</Title>
                </Group>
              </UnstyledButton>
              {project && (
                <Badge size="sm" variant="light" color="gray" visibleFrom="sm">
                  24-bit · 48 kHz · mono
                </Badge>
              )}
            </Group>

            <Group gap="md" wrap="nowrap">
              {(busy || exporting) && (
                <Group gap="xs" wrap="nowrap">
                  <Loader size="xs" />
                  <Text size="xs" c="dimmed" visibleFrom="sm">
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
              {project && (
                <Group gap="xs" wrap="nowrap">
                  <ActionIcon
                    variant="light"
                    size="sm"
                    disabled={!canUndo}
                    onClick={() => undo()}
                    title="Undo (Ctrl+Z)"
                  >
                    <IconArrowBackUp size={16} />
                  </ActionIcon>
                  <ActionIcon
                    variant="light"
                    size="sm"
                    disabled={!canRedo}
                    onClick={() => redo()}
                    title="Redo (Ctrl+Y)"
                  >
                    <IconArrowForwardUp size={16} />
                  </ActionIcon>
                  <Button
                    size="xs"
                    variant="light"
                    hiddenFrom="md"
                    onClick={openInspector}
                  >
                    Inspector
                  </Button>
                </Group>
              )}
              <SegmentedControl
                size="xs"
                value={colorScheme.colorScheme}
                onChange={(v) =>
                  colorScheme.setColorScheme(v as "light" | "dark" | "auto")
                }
                data={[
                  { value: "auto", label: <IconBrightnessAuto size={14} /> },
                  { value: "light", label: <IconSunHigh size={14} /> },
                  { value: "dark", label: <IconMoon size={14} /> },
                ]}
                aria-label="Color scheme"
                visibleFrom="md"
              />
              <ActionIcon
                variant="subtle"
                size="sm"
                onClick={openAbout}
                title="About Audio Bench"
                aria-label="About Audio Bench"
              >
                <IconInfoCircle size={16} />
              </ActionIcon>
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
            style={{ minHeight: `calc(100vh - ${headerHeight}px)` }}
          >
            <div
              style={{
                height: `calc(100vh - ${headerHeight}px - ${tableHeight}px)`,
                minHeight: 200,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <WaveformWorkspace />
            </div>

            <div
              style={{
                height: tableHeight,
                borderTop: "1px solid var(--mantine-color-default-border)",
                overflow: "hidden",
              }}
            >
              <ClipTable />
            </div>
          </Stack>
        </AppShell.Main>
      </AppShell>

      <Drawer
        opened={inspectorOpened}
        onClose={closeInspector}
        position="right"
        size="85%"
        title="Clip inspector"
        hiddenFrom="md"
      >
        <ClipInspector />
      </Drawer>

      <AboutModal opened={aboutOpened} onClose={closeAbout} />

      {/* Splash screen */}
      {splashVisible && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 24,
            padding: 32,
            background: "var(--mantine-color-dark-7)",
            transition: "opacity 300ms ease-out",
            opacity: splashVisible ? 1 : 0,
          }}
        >
          <img
            src="/logo.png"
            alt="audio-bench"
            width={96}
            height={96}
            style={{ borderRadius: 16, display: "block" }}
          />
          <Title
            order={2}
            style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 700 }}
          >
            Audio Bench
          </Title>
          <Text size="sm" c="dimmed">
            Audio workstation
          </Text>
        </div>
      )}

      {/* Drag-over indicator */}
      {isDragging && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9997,
            background: "var(--mantine-color-teal-6)",
            opacity: 0.15,
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
}
