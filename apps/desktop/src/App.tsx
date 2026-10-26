import { AboutModal } from "@/components/AboutModal";
import { ClipInspector } from "@/components/ClipInspector";
import { ClipTable } from "@/components/ClipTable";
import { DropzoneOverlay } from "@/components/DropzoneOverlay";
import { HelpModal } from "@/components/HelpModal";
import { ProjectSidebar } from "@/components/ProjectSidebar";
import { StartScreen } from "@/components/StartScreen";
import { Tip } from "@/components/Tip";
import { WaveformWorkspace } from "@/components/WaveformWorkspace";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { onAnalysisProgress } from "@/ipc/events";
import { formatTimecode } from "@/lib/format";
import { notifyInfo } from "@/lib/notify";
import { ensureNotificationPermission } from "@/lib/osNotify";
import { useEditorStore } from "@/stores/useEditorStore";
import { useProjectStore } from "@/stores/useProjectStore";
import {
  ActionIcon,
  AppShell,
  Badge,
  Burger,
  Button,
  Drawer,
  Group,
  Kbd,
  SegmentedControl,
  Stack,
  Text,
  Title,
  UnstyledButton,
  useMantineColorScheme,
} from "@mantine/core";
import { useDisclosure, useMediaQuery } from "@mantine/hooks";
import { nprogress } from "@mantine/nprogress";
import { Spotlight } from "@mantine/spotlight";
import {
  IconArrowBackUp,
  IconArrowForwardUp,
  IconBrightnessAuto,
  IconHelpCircle,
  IconInfoCircle,
  IconMoon,
  IconSunHigh,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { useFileDrop } from "./hooks/useFileDrop";
import { useSpotlightActions } from "./hooks/useSpotlightActions";

export const App = () => {
  useKeyboardShortcuts();

  const [splashVisible, setSplashVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setSplashVisible(false), 1500);
    return () => clearTimeout(t);
  }, []);

  const [navbarOpened, { toggle: toggleNavbar }] = useDisclosure(false);
  const [inspectorOpened, { open: openInspector, close: closeInspector }] =
    useDisclosure(false);
  const [aboutOpened, { open: openAbout, close: closeAbout }] =
    useDisclosure(false);
  const [helpOpened, { open: openHelp, close: closeHelp }] =
    useDisclosure(false);

  const colorScheme = useMantineColorScheme();

  const isMobile = useMediaQuery("(max-width: 768px)");
  const tableHeight = isMobile ? 180 : 244;
  const headerHeight = 52;

  const busy = useProjectStore((s) => s.busy);
  const exporting = useProjectStore((s) => s.exporting);
  const progress = useProjectStore((s) => s.progress);
  const project = useProjectStore((s) => s.project);
  // Empty app = just the start screen: no sidebar, inspector or clip table.
  const hasProject = project !== null;

  const spotlightActions = useSpotlightActions(
    openHelp,
    openAbout,
    colorScheme,
  );

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

  useFileDrop();

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

  const onDropHint = (): void => {
    notifyInfo(
      "Drop files anywhere",
      "Drag a recording (WAV, FLAC, MP3, M4A) or a .audiobench project file anywhere onto this window. Audio Bench asks before replacing an open session.",
    );
  };

  return (
    <div style={{ display: "contents" }}>
      <AppShell
        header={{ height: headerHeight }}
        navbar={{
          width: 288,
          breakpoint: "sm",
          collapsed: { mobile: !navbarOpened, desktop: !hasProject },
        }}
        aside={{
          width: 336,
          breakpoint: "md",
          collapsed: { mobile: true, desktop: !hasProject },
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
              <Tip
                label="Import by dropping files"
                description="Drag a recording or a .audiobench project anywhere onto the window."
              >
                <UnstyledButton onClick={onDropHint}>
                  <Group gap="sm" wrap="nowrap">
                    <img
                      src="/logo.png"
                      alt="audio-bench logo"
                      width={26}
                      height="auto"
                      style={{ display: "block" }}
                    />
                    <Title order={5}>Audio Bench</Title>
                  </Group>
                </UnstyledButton>
              </Tip>
              {project && (
                <Tip
                  label="Conformed audio format"
                  description="The session master is stored on disk as 24-bit / 48 kHz mono WAV."
                >
                  <Badge
                    size="sm"
                    variant="light"
                    color="gray"
                    visibleFrom="sm"
                  >
                    24-bit · 48 kHz · mono
                  </Badge>
                </Tip>
              )}
            </Group>

            <Group gap="md" wrap="nowrap">
              {(busy || exporting) && (
                <Group gap="xs" wrap="nowrap">
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
                  <Tip label="Undo" description="Step back one edit (Ctrl+Z).">
                    <ActionIcon
                      variant="light"
                      size="sm"
                      disabled={!canUndo}
                      onClick={() => undo()}
                      aria-label="Undo"
                    >
                      <IconArrowBackUp size={16} />
                    </ActionIcon>
                  </Tip>
                  <Tip
                    label="Redo"
                    description="Reapply the edit you just undid (Ctrl+Y)."
                  >
                    <ActionIcon
                      variant="light"
                      size="sm"
                      disabled={!canRedo}
                      onClick={() => redo()}
                      aria-label="Redo"
                    >
                      <IconArrowForwardUp size={16} />
                    </ActionIcon>
                  </Tip>
                  <Tip
                    label="Clip inspector"
                    description="Show the full inspector for the selected clip on narrow windows."
                  >
                    <Button
                      size="xs"
                      variant="light"
                      hiddenFrom="md"
                      onClick={openInspector}
                    >
                      Inspector
                    </Button>
                  </Tip>
                </Group>
              )}
              <Tip
                label="Color scheme"
                description="Follow the system theme, or force light or dark."
              >
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
              </Tip>
              <Tip
                label="Help"
                description="What every button does, plus all keyboard shortcuts."
              >
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  onClick={openHelp}
                  aria-label="Help"
                >
                  <IconHelpCircle size={16} />
                </ActionIcon>
              </Tip>
              <Tip
                label="About Audio Bench"
                description="Credits, privacy and licence."
              >
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  onClick={openAbout}
                  aria-label="About Audio Bench"
                >
                  <IconInfoCircle size={16} />
                </ActionIcon>
              </Tip>
              {project && (
                <Tip
                  label="Keyboard shortcuts"
                  description="Space plays · S splits · M merges · A approves · R rejects"
                >
                  <Group gap={6} visibleFrom="md">
                    <Kbd size="xs">Space</Kbd>
                    <Kbd size="xs">↑↓</Kbd>
                    <Kbd size="xs">S</Kbd>
                    <Kbd size="xs">M</Kbd>
                    <Kbd size="xs">A</Kbd>
                  </Group>
                </Tip>
              )}
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
          {hasProject ? (
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
          ) : (
            <StartScreen headerHeight={headerHeight} />
          )}
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
      <HelpModal opened={helpOpened} onClose={closeHelp} />
      <Spotlight
        shortcut="mod+K"
        actions={spotlightActions}
        nothingFound="Nothing found"
        scrollable
        maxHeight={360}
        searchProps={{ placeholder: "Search actions, projects..." }}
      />

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
            height="auto"
            style={{ display: "block" }}
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

      {/* Window-level drop overlay (scrim + dashed drop area). Always
          mounted so show/hide both animate; hidden state is inert. */}
      <DropzoneOverlay />
    </div>
  );
};
