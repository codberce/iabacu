import { describe, expect, it } from "vitest";
import {
  hasSectionMarkers,
  parseAiSections,
} from "@/components/ai-message-sections";

describe("hasSectionMarkers", () => {
  it("returns false for plain markdown", () => {
    expect(hasSectionMarkers("Acesta este un text simplu.")).toBe(false);
    expect(hasSectionMarkers("### Ideea cheie\n\nUn text.")).toBe(false);
  });

  it("returns true when markers are present", () => {
    expect(hasSectionMarkers("[IDEA]\nAcesta este un text.")).toBe(true);
    expect(hasSectionMarkers("Intro\n[PASI]\nPas 1\n[VERIFICARE]\nDone.")).toBe(
      true,
    );
  });
});

describe("parseAiSections", () => {
  it("returns the full content as intro when no markers are present", () => {
    const { intro, sections } = parseAiSections("Doar text simplu.");
    expect(intro).toBe("Doar text simplu.");
    expect(sections).toHaveLength(0);
  });

  it("extracts intro text before the first marker", () => {
    const { intro, sections } = parseAiSections(
      "Salut! Hai sa rezolvam.\n[IDEA]\nIdeea cheie aici.",
    );
    expect(intro).toBe("Salut! Hai sa rezolvam.");
    expect(sections).toHaveLength(1);
    expect(sections[0].kind).toBe("idea");
    expect(sections[0].content).toBe("Ideea cheie aici.");
  });

  it("parses multiple sections in order", () => {
    const { intro, sections } = parseAiSections(
      "[IDEA]\nFolosim substitutia.\n[PASI]\n1. Simplificam\n2. Integrarim\n[VERIFICARE]\nDerivata confirma.",
    );
    expect(intro).toBe("");
    expect(sections).toHaveLength(3);
    expect(sections[0].kind).toBe("idea");
    expect(sections[0].content).toBe("Folosim substitutia.");
    expect(sections[1].kind).toBe("steps");
    expect(sections[1].content).toBe("1. Simplificam\n2. Integrarim");
    expect(sections[2].kind).toBe("verification");
    expect(sections[2].content).toBe("Derivata confirma.");
  });

  it("handles all marker types", () => {
    const { sections } = parseAiSections(
      "[DEFINITIE]\nO functie continua.\n[IDEA]\nAbordarea.\n[PASI]\nStep.\n[VERIFICARE]\nCheck.\n[ATENTIE]\nWarning.\n[PUNCTAJ]\n3 puncte.",
    );
    expect(sections).toHaveLength(6);
    expect(sections.map((s) => s.kind)).toEqual([
      "definition",
      "idea",
      "steps",
      "verification",
      "attention",
      "scoring",
    ]);
  });

  it("handles partial content during streaming gracefully", () => {
    const { sections } = parseAiSections("[PASI]\n1. Primul pas...\n");
    expect(sections).toHaveLength(1);
    expect(sections[0].kind).toBe("steps");
    expect(sections[0].content).toBe("1. Primul pas...");
  });

  it("handles no intro with markers at the start", () => {
    const { intro, sections } = parseAiSections(
      "[IDEA]\nDirect la idee.",
    );
    expect(intro).toBe("");
    expect(sections).toHaveLength(1);
  });

  it("trims whitespace in section content", () => {
    const { sections } = parseAiSections(
      "[IDEA]\n\n  Text cu spatii.\n\n[PASI]\n\n  Alt text.\n",
    );
    expect(sections[0].content).toBe("Text cu spatii.");
    expect(sections[1].content).toBe("Alt text.");
  });
});