import { describe, expect, test } from "bun:test";
import {
  classifyDropPaths,
  dropAnnouncement,
  dropCopy,
  isIngestible,
} from "./dropKind";

describe("classifyDropPaths", () => {
  test("empty drop", () => {
    expect(classifyDropPaths([])).toBe("none");
  });

  test("single recording by extension", () => {
    expect(classifyDropPaths(["/tmp/take1.wav"])).toBe("recording");
    expect(classifyDropPaths(["take1.FLAC"])).toBe("recording");
    expect(classifyDropPaths(["a.mp3"])).toBe("recording");
    expect(classifyDropPaths(["a.m4a"])).toBe("recording");
  });

  test("single project file", () => {
    expect(classifyDropPaths(["/tmp/session.audiobench"])).toBe("project");
  });

  test("recording plus project together", () => {
    expect(classifyDropPaths(["/tmp/take1.wav", "/tmp/take1.audiobench"])).toBe(
      "both",
    );
    expect(classifyDropPaths(["/tmp/take1.audiobench", "/tmp/take1.wav"])).toBe(
      "both",
    );
  });

  test("two recordings are rejected", () => {
    expect(classifyDropPaths(["a.wav", "b.wav"])).toBe("multiple");
  });

  test("two project files are rejected", () => {
    expect(classifyDropPaths(["a.audiobench", "b.audiobench"])).toBe(
      "multiple",
    );
  });

  test("three otherwise valid files are rejected", () => {
    expect(classifyDropPaths(["a.wav", "b.audiobench", "c.audiobench"])).toBe(
      "multiple",
    );
  });

  test("unsupported files win over everything else", () => {
    expect(classifyDropPaths(["notes.pdf"])).toBe("unsupported");
    expect(classifyDropPaths(["a.wav", "notes.pdf"])).toBe("unsupported");
    expect(classifyDropPaths(["a.csv"])).toBe("unsupported");
  });

  test("isIngestible matches the classification", () => {
    expect(isIngestible("a.wav")).toBe(true);
    expect(isIngestible("a.audiobench")).toBe(true);
    expect(isIngestible("a.csv")).toBe(false);
    expect(isIngestible("a.txt")).toBe(false);
  });
});

describe("dropCopy", () => {
  const idle = { hasProject: false, busy: false };
  const open = { hasProject: true, busy: false };

  test("no project: invites a recording and lists accepted types", () => {
    const copy = dropCopy("none", idle);
    expect(copy.title).toContain("Drop a recording");
    expect(copy.hint).toContain("WAV · FLAC · MP3 · M4A");
    expect(copy.accept).toBe(true);
  });

  test("project open: says it will ask before replacing", () => {
    const copy = dropCopy("recording", open);
    expect(copy.title).toContain("replace");
    expect(copy.hint).toContain("confirm");
    expect(copy.accept).toBe(true);
  });

  test("busy: refuses the drop", () => {
    for (const busy of [true] as const) {
      const copy = dropCopy("recording", { hasProject: false, busy });
      expect(copy.title).toContain("Can't add files right now");
      expect(copy.accept).toBe(false);
    }
  });

  test("unsupported and multiple are refused with an explanation", () => {
    for (const kind of ["unsupported", "multiple"] as const) {
      const copy = dropCopy(kind, idle);
      expect(copy.accept).toBe(false);
      expect(copy.hint.length).toBeGreaterThan(0);
    }
  });

  test("recording + project announces both", () => {
    const copy = dropCopy("both", idle);
    expect(copy.title).toContain("recording + project");
    expect(copy.accept).toBe(true);
  });
});

describe("dropAnnouncement", () => {
  test("silent when no drag is active", () => {
    const copy = dropCopy("none", { hasProject: false, busy: false });
    expect(dropAnnouncement(copy, false)).toBe("");
  });

  test("announces title, hint and the Escape affordance", () => {
    const copy = dropCopy("none", { hasProject: false, busy: false });
    const text = dropAnnouncement(copy, true);
    expect(text).toContain(copy.title);
    expect(text).toContain(copy.hint);
    expect(text).toContain("Escape");
  });
});
