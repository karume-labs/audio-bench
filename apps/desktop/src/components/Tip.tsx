import { Tooltip } from "@mantine/core";
import { type ReactNode, isValidElement } from "react";

export interface TipProps {
  /** Primary line of the tooltip. */
  label: ReactNode;
  /** Optional second line, rendered dimmed under the label. */
  description?: string;
  children: ReactNode;
  position?: "top" | "bottom" | "left" | "right";
}

/**
 * Tooltip wrapper used for every interactive control in the app.
 *
 * Renders a one-line label, or a bold label plus a dimmed description when
 * `description` is given. Disabled controls do not emit mouse events, so
 * those children are wrapped in a span — otherwise the tooltip could never
 * explain why a button is greyed out.
 */
export default function Tip({
  label,
  description,
  children,
  position = "bottom",
}: TipProps) {
  const body = description ? (
    <span style={{ display: "block", maxWidth: 260 }}>
      <span style={{ display: "block", fontWeight: 600 }}>{label}</span>
      <span
        style={{
          display: "block",
          fontWeight: 400,
          fontSize: 11,
          lineHeight: 1.4,
          opacity: 0.8,
        }}
      >
        {description}
      </span>
    </span>
  ) : (
    label
  );

  const disabled =
    isValidElement(children) &&
    (children.props as { disabled?: unknown }).disabled === true;

  return (
    <Tooltip label={body} position={position} multiline maw={280}>
      {disabled ? (
        <span style={{ display: "inline-flex" }}>{children}</span>
      ) : (
        children
      )}
    </Tooltip>
  );
}
