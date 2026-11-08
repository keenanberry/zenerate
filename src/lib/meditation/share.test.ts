import { describe, expect, it, vi } from "vitest";
import { shareMeditation, sharePayload } from "./share";

const meditation = { id: "abc-123", title: "Rain & Release" };
const payload = sharePayload(meditation, "https://www.zeneratestudio.com");

function abort() {
  return Object.assign(new Error("Share canceled"), { name: "AbortError" });
}

describe("sharePayload", () => {
  it("carries the title, a short line and the canonical URL", () => {
    expect(payload).toEqual({
      title: "Rain & Release",
      text: "Rain & Release, a meditation on Zenerate",
      url: "https://www.zeneratestudio.com/meditation/abc-123",
    });
  });

  it("resolves against the site origin, whatever path it carries", () => {
    expect(sharePayload(meditation, new URL("http://localhost:3000/discover?q=x")).url).toBe(
      "http://localhost:3000/meditation/abc-123",
    );
  });
});

describe("shareMeditation", () => {
  it("opens the share sheet when the browser has one", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn();
    const outcome = await shareMeditation(payload, {
      share,
      canShare: () => true,
      clipboard: { writeText } as unknown as Clipboard,
    });
    expect(outcome).toBe("shared");
    expect(share).toHaveBeenCalledWith(payload);
    expect(writeText).not.toHaveBeenCalled();
  });

  it("shares without canShare, which some browsers lack", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    expect(await shareMeditation(payload, { share })).toBe("shared");
  });

  it("treats a cancelled sheet as nothing to report", async () => {
    const writeText = vi.fn();
    const outcome = await shareMeditation(payload, {
      share: vi.fn().mockRejectedValue(abort()),
      clipboard: { writeText } as unknown as Clipboard,
    });
    expect(outcome).toBe("cancelled");
    expect(writeText).not.toHaveBeenCalled();
  });

  it("copies the URL when there is no share sheet", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const outcome = await shareMeditation(payload, {
      clipboard: { writeText } as unknown as Clipboard,
    });
    expect(outcome).toBe("copied");
    expect(writeText).toHaveBeenCalledWith(payload.url);
  });

  it("copies when canShare refuses the payload", async () => {
    const share = vi.fn();
    const writeText = vi.fn().mockResolvedValue(undefined);
    const outcome = await shareMeditation(payload, {
      share,
      canShare: () => false,
      clipboard: { writeText } as unknown as Clipboard,
    });
    expect(outcome).toBe("copied");
    expect(share).not.toHaveBeenCalled();
  });

  it("falls back to the clipboard when the sheet fails for another reason", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const outcome = await shareMeditation(payload, {
      share: vi.fn().mockRejectedValue(new DOMException("No gesture", "NotAllowedError")),
      clipboard: { writeText } as unknown as Clipboard,
    });
    expect(outcome).toBe("copied");
  });

  it("reports a failure when neither works", async () => {
    expect(await shareMeditation(payload, {})).toBe("failed");
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    expect(
      await shareMeditation(payload, { clipboard: { writeText } as unknown as Clipboard }),
    ).toBe("failed");
  });
});
