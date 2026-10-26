import {
  Button,
  Divider,
  Group,
  Modal,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import {
  IconBrandGithub,
  IconBrandLinkedin,
  IconBrandX,
  IconWorld,
} from "@tabler/icons-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import Tip from "./Tip";

const LINKS = [
  {
    label: "Portfolio",
    handle: "karume.vercel.app",
    url: "https://karume.vercel.app",
    icon: IconWorld,
  },
  {
    label: "GitHub",
    handle: "@karume-labs",
    url: "https://github.com/karume-labs",
    icon: IconBrandGithub,
  },
  {
    label: "LinkedIn",
    handle: "Daniel Karume",
    url: "https://linkedin.com/in/daniel-karume",
    icon: IconBrandLinkedin,
  },
  {
    label: "Twitter / X",
    handle: "@karume_lab",
    url: "https://twitter.com/karume_lab",
    icon: IconBrandX,
  },
];

export interface AboutModalProps {
  opened: boolean;
  onClose: () => void;
}

export default function AboutModal({ opened, onClose }: AboutModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      centered
      title="About Audio Bench"
      size="md"
    >
      <Stack gap="md">
        <Group gap="md" align="center">
          <img
            src="/logo.png"
            alt="Audio Bench logo"
            width={64}
            height={43}
            style={{ display: "block" }}
          />
          <div>
            <Title order={3}>Audio Bench</Title>
            <Text size="sm" c="dimmed">
              Version 0.1.0
            </Text>
          </div>
        </Group>

        <Text size="sm" c="dimmed">
          A local, keyboard-driven audio workstation. It splits long voice
          recordings into export-ready, perfectly named clips — entirely on your
          machine. No cloud uploads, no transcription, no data leaves your
          drive.
        </Text>

        <Divider />

        <div>
          <Text size="xs" tt="uppercase" fw={700} c="dimmed" mb={6}>
            Privacy first
          </Text>
          <Text size="sm" c="dimmed">
            Audio Bench operates 100% locally. Your recordings never leave your
            device.
          </Text>
        </div>

        <div>
          <Text size="xs" tt="uppercase" fw={700} c="dimmed" mb={6}>
            License &amp; terms
          </Text>
          <Text size="sm" c="dimmed">
            Licensed under CC BY-NC-SA 4.0. Strictly prohibited from being used
            for AI training or commercial distribution.
          </Text>
        </div>

        <div>
          <Text size="xs" tt="uppercase" fw={700} c="dimmed" mb={6}>
            Developer
          </Text>
          <Text size="sm" c="dimmed">
            Powered by coffee and sleepless nights —{" "}
            <Text span fw={600} c="teal">
              karume-lab.
            </Text>
          </Text>
        </div>

        <Divider />

        <div>
          <Text size="xs" tt="uppercase" fw={700} c="dimmed" mb={6}>
            Links
          </Text>
          <Stack gap={4}>
            {LINKS.map((link) => (
              <Tip
                key={link.url}
                label={`Open ${link.label}`}
                description={`Opens ${link.url} in your browser`}
              >
                <Button
                  variant="subtle"
                  size="sm"
                  leftSection={<link.icon size={16} />}
                  justify="flex-start"
                  onClick={() => void openUrl(link.url)}
                >
                  {link.label}{" "}
                  <Text span size="xs" c="dimmed" ml={6}>
                    {link.handle}
                  </Text>
                </Button>
              </Tip>
            ))}
          </Stack>
        </div>
      </Stack>
    </Modal>
  );
}
