import { AboutModal } from "@/components/AboutModal";
import { AppHeader } from "@/components/AppHeader";
import { ClipInspector } from "@/components/ClipInspector";
import { ClipTable } from "@/components/ClipTable";
import { DropzoneOverlay } from "@/components/DropzoneOverlay";
import { HelpModal } from "@/components/HelpModal";
import { ProjectSidebar } from "@/components/ProjectSidebar";
import { StartScreen } from "@/components/StartScreen";
import { WaveformWorkspace } from "@/components/WaveformWorkspace";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { onAnalysisProgress } from "@/ipc/events";
import { ensureNotificationPermission } from "@/lib/osNotify";
import { useProjectStore } from "@/stores/useProjectStore";
import {
  AppShell,
  Drawer,
  Stack,
  Text,
  Title,
  useMantineColorScheme,
} from "@mantine/core";
import { useDisclosure, useMediaQuery } from "@mantine/hooks";
import { nprogress } from "@mantine/nprogress";
import { Spotlight } from "@mantine/spotlight";

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
  const project = useProjectStore((s) => s.project);
  // Empty app = just the start screen: no sidebar, inspector or clip table.
  const hasProject = project !== null;

  const spotlightActions = useSpotlightActions(
    openHelp,
    openAbout,
    colorScheme,
  );

  const setProgress = useProjectStore((s) => s.setProgress);

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
          <AppHeader
            navbarOpened={navbarOpened}
            toggleNavbar={toggleNavbar}
            openInspector={openInspector}
            openHelp={openHelp}
            openAbout={openAbout}
          />
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
