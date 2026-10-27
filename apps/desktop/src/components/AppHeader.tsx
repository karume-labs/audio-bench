import { Tip } from "@/components/Tip";
import { useProjectStore } from "@/stores/useProjectStore";
import {
  ActionIcon,
  Badge,
  Burger,
  Button,
  Group,
  Kbd,
  SegmentedControl,
  Text,
  Title,
  UnstyledButton,
  useMantineColorScheme,
} from "@mantine/core";
import {
  IconArrowBackUp,
  IconArrowForwardUp,
  IconBrightnessAuto,
  IconHelpCircle,
  IconInfoCircle,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
  IconLayoutSidebarRightCollapse,
  IconLayoutSidebarRightExpand,
  IconMoon,
  IconSettings,
  IconSunHigh,
} from "@tabler/icons-react";

interface AppHeaderProps {
  navbarOpened: boolean;
  toggleNavbar: () => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  inspectorCollapsed: boolean;
  toggleInspector: () => void;
  openInspector: () => void;
  openHelp: () => void;
  openAbout: () => void;
  openSettings: () => void;
}

export const AppHeader = ({
  navbarOpened,
  toggleNavbar,
  sidebarCollapsed,
  toggleSidebar,
  inspectorCollapsed,
  toggleInspector,
  openInspector,
  openHelp,
  openAbout,
  openSettings,
}: AppHeaderProps) => {
  const project = useProjectStore((s) => s.project);
  const busy = useProjectStore((s) => s.busy);
  const exporting = useProjectStore((s) => s.exporting);
  const progress = useProjectStore((s) => s.progress);
  const canUndo = useProjectStore((s) => s.undoStack.length > 0);
  const canRedo = useProjectStore((s) => s.redoStack.length > 0);
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);
  const colorScheme = useMantineColorScheme();
  const onDropHint = (): void => {
    // noop fallback; header logo click is informational
  };

  return (
    <Group h="100%" px="md" justify="space-between" wrap="nowrap">
      <Group gap="sm" wrap="nowrap">
        <Burger opened={navbarOpened} onClick={toggleNavbar} hiddenFrom="sm" />
        {project && (
          <Tip
            label={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
            description="Collapse or expand the left sidebar."
          >
            <ActionIcon
              variant="subtle"
              size="sm"
              visibleFrom="sm"
              onClick={toggleSidebar}
              aria-label={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
            >
              {sidebarCollapsed ? (
                <IconLayoutSidebarLeftExpand size={16} />
              ) : (
                <IconLayoutSidebarLeftCollapse size={16} />
              )}
            </ActionIcon>
          </Tip>
        )}
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
            <Badge size="sm" variant="light" color="gray" visibleFrom="sm">
              24-bit · 48 kHz · mono
            </Badge>
          </Tip>
        )}
      </Group>

      <Group gap="sm" wrap="nowrap">
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
              label={inspectorCollapsed ? "Show inspector" : "Hide inspector"}
              description="Collapse or expand the right inspector panel."
            >
              <ActionIcon
                variant="subtle"
                size="sm"
                visibleFrom="md"
                onClick={toggleInspector}
                aria-label={inspectorCollapsed ? "Show inspector" : "Hide inspector"}
              >
                {inspectorCollapsed ? (
                  <IconLayoutSidebarRightExpand size={16} />
                ) : (
                  <IconLayoutSidebarRightCollapse size={16} />
                )}
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
        {project && (
          <Tip label="Project settings" description="Rename the project, change the export name template or delete it.">
            <ActionIcon
              variant="subtle"
              size="sm"
              onClick={openSettings}
              aria-label="Project settings"
            >
              <IconSettings size={16} />
            </ActionIcon>
          </Tip>
        )}
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
        {(busy || exporting) && (
          <Group gap="xs" wrap="nowrap">
            <Text size="xs" c="dimmed" visibleFrom="sm">
              {progress
                ? progress.message
                : exporting
                  ? "Exporting..."
                  : "Analyzing..."}
            </Text>
          </Group>
        )}
        {project && (
          <Tip
            label="Keyboard shortcuts"
            description="Space plays - S splits - M merges - A approves - R rejects"
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
  );
};
