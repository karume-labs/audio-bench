import { Tip } from "@/components/Tip";
import { useEditorStore } from "@/stores/useEditorStore";
import { useProjectStore } from "@/stores/useProjectStore";
import { CLIP_STATUS_COLOR } from "@/theme";
import { Button, Group } from "@mantine/core";

interface ClipActionsProps {
  clipId: string;
  status: string;
}

export const ClipActions = ({ clipId, status }: ClipActionsProps) => {
  const setClipStatus = useProjectStore((s) => s.setClipStatus);
  const mergeActiveWithNext = useProjectStore((s) => s.mergeActiveWithNext);
  const splitClipAt = useProjectStore((s) => s.splitClipAt);

  return (
    <>
      <Group gap="xs">
        <Tip
          label="Approve"
          description="Mark this clip as reviewed and ready to export."
        >
          <Button
            size="xs"
            color={CLIP_STATUS_COLOR.approved}
            onClick={() => setClipStatus(clipId, "approved")}
            disabled={status === "approved"}
          >
            Approve (A)
          </Button>
        </Tip>
        <Tip
          label="Reject"
          description="Exclude this clip from the export. It stays in the table and can be restored."
        >
          <Button
            size="xs"
            color={CLIP_STATUS_COLOR.rejected}
            variant="light"
            onClick={() => setClipStatus(clipId, "rejected")}
            disabled={status === "rejected"}
          >
            Reject (R)
          </Button>
        </Tip>
        {status === "rejected" && (
          <Tip
            label="Restore"
            description="Return a rejected clip to proposed so it is exported again."
          >
            <Button
              size="xs"
              variant="outline"
              onClick={() => setClipStatus(clipId, "proposed")}
            >
              Restore
            </Button>
          </Tip>
        )}
      </Group>
      <Group gap="xs">
        <Tip
          label="Merge with next"
          description="Join this clip with the one after it - useful when a pause was cut in the middle of a line."
        >
          <Button
            size="xs"
            variant="light"
            onClick={() => mergeActiveWithNext(clipId)}
          >
            Merge next (M)
          </Button>
        </Tip>
        <Tip
          label="Split at playhead"
          description="Cut this clip at the playhead position. Click the waveform to place the playhead first."
        >
          <Button
            size="xs"
            variant="light"
            onClick={() =>
              splitClipAt(
                Math.round(useEditorStore.getState().playhead * 48_000),
              )
            }
          >
            Split @ playhead (S)
          </Button>
        </Tip>
      </Group>
    </>
  );
};
