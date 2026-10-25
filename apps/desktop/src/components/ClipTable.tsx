import { type Clip, orderedClips } from "@audio-bench/domain";
import {
  Badge,
  Button,
  Checkbox,
  Group,
  ScrollArea,
  Stack,
  Table,
  Text,
} from "@mantine/core";
import { useEffect, useMemo, useRef } from "react";
import { formatTimecode, samplesToSeconds } from "../lib/format";
import { waveformBridge } from "../lib/waveformBridge";
import { useEditorStore } from "../stores/useEditorStore";
import { useProjectStore } from "../stores/useProjectStore";

const statusColor = (status: string): string =>
  status === "approved" ? "green" : status === "rejected" ? "red" : "orange";

export default function ClipTable() {
  const project = useProjectStore((s) => s.project);
  const setActive = useEditorStore((s) => s.setActive);
  const activeClipId = useEditorStore((s) => s.activeClipId);
  const checked = useEditorStore((s) => s.checked);
  const toggleChecked = useEditorStore((s) => s.toggleChecked);
  const setChecked = useEditorStore((s) => s.setChecked);
  const sort = useEditorStore((s) => s.sort);
  const setSort = useEditorStore((s) => s.setSort);
  const approveChecked = useProjectStore((s) => s.approveChecked);
  const rowRefs = useRef(new Map<string, HTMLTableRowElement>());

  const clips = useMemo(() => {
    if (!project) return [] as Clip[];
    const ordered = orderedClips(project.clips);
    const statusRank: Record<string, number> = {
      proposed: 0,
      approved: 1,
      rejected: 2,
    };

    const sorted = [...ordered];
    const dir = sort.dir === "asc" ? 1 : -1;
    sorted.sort((a, b) => {
      switch (sort.by) {
        case "status":
          return (statusRank[a.status] - statusRank[b.status]) * dir;
        case "duration":
          return (
            (a.core_end_sample -
              a.core_start_sample -
              (b.core_end_sample - b.core_start_sample)) *
            dir
          );
        default:
          return (
            (a.core_start_sample - b.core_start_sample ||
              a.core_end_sample - b.core_end_sample) * dir
          );
      }
    });
    return sorted;
  }, [project, sort]);

  useEffect(() => {
    if (!activeClipId) return;
    rowRefs.current.get(activeClipId)?.scrollIntoView({ block: "nearest" });
  }, [activeClipId]);

  if (!project) {
    return (
      <Stack align="center" justify="center" h="100%" gap="xs">
        <Text c="dimmed" size="sm">
          Clips will appear here after analysis
        </Text>
      </Stack>
    );
  }

  const headerCell = (
    label: string,
    key: "index" | "status" | "duration",
    align?: "left" | "right",
  ) => (
    <Table.Th
      style={{
        cursor: "pointer",
        textAlign: align ?? "left",
        userSelect: "none",
      }}
      onClick={() => setSort(key as "index" | "status" | "duration")}
    >
      <Group
        gap={4}
        justify={align === "right" ? "flex-end" : "flex-start"}
        wrap="nowrap"
      >
        <Text size="xs" fw={600} c="dimmed">
          {label}
        </Text>
        {sort.by === key && (
          <Text size="xs" c="dimmed">
            {sort.dir === "asc" ? "↑" : "↓"}
          </Text>
        )}
      </Group>
    </Table.Th>
  );

  const allChecked = clips.length > 0 && checked.length === clips.length;

  return (
    <Stack gap={4} h="100%" p="xs">
      <Group justify="space-between">
        <Text size="sm" fw={600}>
          Clips ({clips.length})
        </Text>
        <Group gap="xs">
          <Button
            size="xs"
            variant="light"
            disabled={checked.length === 0}
            onClick={() => approveChecked()}
          >
            Approve selected ({checked.length})
          </Button>
          <Checkbox
            size="xs"
            label="All"
            checked={allChecked}
            indeterminate={checked.length > 0 && !allChecked}
            onChange={() =>
              setChecked(allChecked ? [] : clips.map((c) => c.id))
            }
          />
        </Group>
      </Group>

      <ScrollArea type="auto" style={{ flex: 1 }}>
        <Table striped highlightOnHover withTableBorder withColumnBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ width: 34 }} />
              <Table.Th style={{ width: 40 }}>#</Table.Th>
              {headerCell("Status", "status")}
              {headerCell("Start", "index", "right")}
              <Table.Th style={{ textAlign: "right" }}>End</Table.Th>
              {headerCell("Dur", "duration", "right")}
              <Table.Th style={{ width: 90 }}>Flags</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {clips.map((clip, index) => {
              const flags = clip.flags ?? [];
              return (
                <Table.Tr
                  key={clip.id}
                  ref={(el) => {
                    if (el) rowRefs.current.set(clip.id, el);
                    else rowRefs.current.delete(clip.id);
                  }}
                  style={{
                    cursor: "pointer",
                    outline:
                      clip.id === activeClipId
                        ? "1px solid var(--mantine-color-blue-5)"
                        : undefined,
                  }}
                  onClick={() => {
                    setActive(clip.id);
                    waveformBridge.actions?.seek(
                      samplesToSeconds(clip.core_start_sample),
                    );
                  }}
                >
                  <Table.Td onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      size="xs"
                      checked={checked.includes(clip.id)}
                      onChange={() => toggleChecked(clip.id)}
                    />
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" c="dimmed">
                      {index + 1}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge
                      size="xs"
                      color={statusColor(clip.status)}
                      variant="light"
                    >
                      {clip.status}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" ff="monospace">
                      {formatTimecode(samplesToSeconds(clip.core_start_sample))}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" ff="monospace">
                      {formatTimecode(samplesToSeconds(clip.core_end_sample))}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" ff="monospace">
                      {(
                        (clip.core_end_sample - clip.core_start_sample) /
                        48000
                      ).toFixed(2)}
                      s
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={2}>
                      {flags.map((f) => (
                        <Badge
                          key={f}
                          size="xs"
                          color={f === "duration_outlier" ? "red" : "yellow"}
                          variant="light"
                        >
                          {f === "duration_outlier" ? "DUR" : "EDGE"}
                        </Badge>
                      ))}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </ScrollArea>
    </Stack>
  );
}
