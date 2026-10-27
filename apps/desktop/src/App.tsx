import { AppHeader } from "@/components/AppHeader";
import { AppOverlays } from "@/components/AppOverlays";
import { InspectorPanel } from "@/components/InspectorPanel";
import { ClipTable } from "@/components/ClipTable";
import { ProjectSidebar } from "@/components/ProjectSidebar";
import { StartScreen } from "@/components/StartScreen";
import { WaveformWorkspace } from "@/components/WaveformWorkspace";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { onAnalysisProgress } from "@/ipc/events";
import { ensureNotificationPermission } from "@/lib/osNotify";
import { useProjectStore } from "@/stores/useProjectStore";
import { AppShell, Stack, useMantineColorScheme } from "@mantine/core";
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

  const [settingsOpened, { open: openSettings, close: closeSettings }] =
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
            openSettings={openSettings}
          />
        </AppShell.Header>

        <AppShell.Navbar p={0}>
          <ProjectSidebar />
        </AppShell.Navbar>

        <AppShell.Aside p={0}>
          <InspectorPanel />
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

      <AppOverlays
        splashVisible={splashVisible}
        inspectorOpened={inspectorOpened}
        closeInspector={closeInspector}
        aboutOpened={aboutOpened}
        closeAbout={closeAbout}
        helpOpened={helpOpened}
        closeHelp={closeHelp}
        settingsOpened={settingsOpened}
        closeSettings={closeSettings}
      />

      <Spotlight
        shortcut="mod+K"
        actions={spotlightActions}
        nothingFound="Nothing found"
        scrollable
        maxHeight={360}
        searchProps={{ placeholder: "Search actions, projects..." }}
      />
    </div>
  );
};
