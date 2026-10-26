import { AboutModal } from "@/components/AboutModal";
import { ClipInspector } from "@/components/ClipInspector";
import { DropzoneOverlay } from "@/components/DropzoneOverlay";
import { HelpModal } from "@/components/HelpModal";
import { Drawer, Text, Title } from "@mantine/core";

interface AppOverlaysProps {
  splashVisible: boolean;
  inspectorOpened: boolean;
  closeInspector: () => void;
  aboutOpened: boolean;
  closeAbout: () => void;
  helpOpened: boolean;
  closeHelp: () => void;
}

export const AppOverlays = ({
  splashVisible,
  inspectorOpened,
  closeInspector,
  aboutOpened,
  closeAbout,
  helpOpened,
  closeHelp,
}: AppOverlaysProps) => (
  <>
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

    <DropzoneOverlay />
  </>
);
