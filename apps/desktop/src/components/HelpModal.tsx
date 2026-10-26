import {
  Divider,
  Group,
  Kbd,
  Modal,
  ScrollArea,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { IconKeyboard } from "@tabler/icons-react";

const BUTTON_HELP: Array<[name: string, description: string]> = [
  [
    "Import recording",
    "Pick a WAV, FLAC, MP3 or M4A file. It is conformed to 24-bit / 48 kHz mono, then split into clips for review.",
  ],
  [
    "Open",
    "Load a saved .audiobench project, including each clip's status and flags.",
  ],
  [
    "Save",
    "Write the project file immediately - the app also autosaves after every edit.",
  ],
  [
    "Export clips",
    "Choose a folder and write every non-rejected clip plus manifest.csv and alignment_report.csv.",
  ],
  [
    "Undo / Redo",
    "Step through edit history for splits, merges and status changes.",
  ],
  [
    "Approve selected",
    "Mark every ticked clip in the table as approved in one action.",
  ],
  ["All", "Tick or untick every clip in the table for a bulk status change."],
  [
    "Status / Start / Dur",
    "Sort the clip table by that column; click again to reverse the order.",
  ],
  [
    "Approve (A) · Reject (R) · Restore",
    "Set the active clip's status. Rejected clips are excluded from export.",
  ],
  [
    "Merge next (M) · Split @ playhead (S)",
    "Join the active clip with the one after it, or cut it at the playhead.",
  ],
  ["Inspector", "Open the clip inspector drawer on narrow windows."],
  ["Color scheme", "Follow the system theme, or force light or dark."],
  ["Help · About", "This dialog, and credits plus licence information."],
  [
    "Drop files anywhere",
    "Drag a recording or project file anywhere onto the window. Audio Bench asks before replacing an open session.",
  ],
];

const KEY_HELP: Array<[keys: string[], description: string]> = [
  [["Space"], "Play / pause"],
  [["Shift", "Space"], "Audition the active clip's export window"],
  [["↑", "↓"], "Previous / next clip (also seeks the playhead)"],
  [["S"], "Split the active clip at the playhead"],
  [["M"], "Merge the active clip with the next one"],
  [["A"], "Approve the active clip"],
  [["R"], "Reject the active clip"],
  [["Ctrl", "Z"], "Undo"],
  [["Ctrl", "Y"], "Redo"],
  [
    ["Esc"],
    "Dismiss the drop overlay - or close the open project (asks first)",
  ],
];

export interface HelpModalProps {
  opened: boolean;
  onClose: () => void;
}

export default function HelpModal({ opened, onClose }: HelpModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Help"
      size="lg"
      scrollAreaComponent={ScrollArea.Autosize}
    >
      <Stack gap="md">
        <div>
          <Text size="xs" tt="uppercase" fw={700} c="dimmed" mb={6}>
            The workflow
          </Text>
          <Text size="sm" c="dimmed">
            Import a recording - review the detected clips on the waveform and
            in the table - then export the approved clips with their manifest.
            Everything runs locally on your machine.
          </Text>
        </div>

        <Divider />

        <div>
          <Title order={5} mb={8}>
            What each control does
          </Title>
          <Stack gap={10}>
            {BUTTON_HELP.map(([name, description]) => (
              <div key={name}>
                <Text size="sm" fw={600}>
                  {name}
                </Text>
                <Text size="xs" c="dimmed">
                  {description}
                </Text>
              </div>
            ))}
          </Stack>
        </div>

        <Divider />

        <div>
          <Title order={5} mb={8}>
            <Group gap={6}>
              <IconKeyboard size={16} />
              Keyboard
            </Group>
          </Title>
          <Stack gap={8}>
            {KEY_HELP.map(([keys, description]) => (
              <Group
                key={description}
                gap="xs"
                wrap="nowrap"
                align="flex-start"
              >
                <Group gap={4} wrap="nowrap" style={{ minWidth: 104 }}>
                  {keys.map((key) => (
                    <Kbd key={key} size="xs">
                      {key}
                    </Kbd>
                  ))}
                </Group>
                <Text size="xs" c="dimmed">
                  {description}
                </Text>
              </Group>
            ))}
          </Stack>
        </div>

        <Text size="xs" c="dimmed">
          Every control also explains itself when you hover it.
        </Text>
      </Stack>
    </Modal>
  );
}
