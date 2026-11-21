import { describe, expect, it, vi } from "vitest";
import { avatarPublicBase } from "./avatar";
import { changeAvatar, removeAvatar, type AvatarDeps } from "./avatar-flow";
import type { Profile } from "./profile";
import { AvatarError } from "./resize-avatar";

const USER = "11111111-1111-1111-1111-111111111111";
const BASE = avatarPublicBase("https://proj.supabase.co");
const OLD_OWN = `${BASE}${USER}/old.webp`;

function setup(overrides: Partial<{ upload: unknown; save: unknown; remove: unknown; resize: unknown }> = {}) {
  const calls: string[] = [];
  const upload = vi.fn<AvatarDeps["storage"]["upload"]>(async (path) => {
    calls.push(`upload ${path}`);
    return (overrides.upload as { error: unknown }) ?? { error: null };
  });
  const remove = vi.fn(async (paths: string[]) => {
    calls.push(`remove ${paths.join(",")}`);
    return (overrides.remove as { error: unknown }) ?? { error: null };
  });
  const save = vi.fn(async (body: { avatar_url: string | null }) => {
    calls.push(`save ${body.avatar_url}`);
    return (
      (overrides.save as Awaited<ReturnType<AvatarDeps["save"]>>) ?? {
        ok: true as const,
        profile: { id: USER, avatar_url: body.avatar_url } as Profile,
      }
    );
  });
  const resize =
    (overrides.resize as AvatarDeps["resize"]) ?? vi.fn(async () => new Blob(["x"], { type: "image/webp" }));
  const deps: AvatarDeps = {
    userId: USER,
    publicBase: BASE,
    storage: {
      upload,
      remove,
      publicUrl: (path) => `${BASE}${path}`,
    },
    save,
    resize,
    random: () => "new",
  };
  return { deps, calls, upload, remove, save };
}

const file = new File(["x"], "me.jpg", { type: "image/jpeg" });

describe("changeAvatar", () => {
  it("uploads to a new path in the user's folder, saves its URL, then deletes the old own photo", async () => {
    const { deps, calls, upload } = setup();
    const result = await changeAvatar(file, OLD_OWN, deps);
    expect(result).toMatchObject({ ok: true, profile: { avatar_url: `${BASE}${USER}/new.webp` } });
    expect(calls).toEqual([`upload ${USER}/new.webp`, `save ${BASE}${USER}/new.webp`, `remove ${USER}/old.webp`]);
    expect(upload.mock.calls[0][2]).toMatchObject({ contentType: "image/webp", upsert: false });
  });

  it("stores Safari's JPEG as .jpg", async () => {
    const { deps, calls } = setup({ resize: async () => new Blob(["x"], { type: "image/jpeg" }) });
    await changeAvatar(file, null, deps);
    expect(calls[0]).toBe(`upload ${USER}/new.jpg`);
  });

  it("leaves an external or someone else's URL alone", async () => {
    for (const previous of ["https://example.com/a.png", `${BASE}someone-else/a.webp`, null]) {
      const { deps, remove } = setup();
      await changeAvatar(file, previous, deps);
      expect(remove).not.toHaveBeenCalled();
    }
  });

  it("shows the image step's own message, and touches nothing", async () => {
    const { deps, upload, save } = setup({
      resize: async () => {
        throw new AvatarError("Couldn't read that photo. Try a JPEG or PNG.");
      },
    });
    expect(await changeAvatar(file, OLD_OWN, deps)).toEqual({
      ok: false,
      error: "Couldn't read that photo. Try a JPEG or PNG.",
    });
    expect(upload).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it("a failed upload keeps the old photo and saves nothing", async () => {
    const { deps, save, remove } = setup({ upload: { error: { message: "denied" } } });
    expect(await changeAvatar(file, OLD_OWN, deps)).toMatchObject({ ok: false });
    expect(save).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it("a failed save removes the photo just uploaded and keeps the old one", async () => {
    const { deps, calls } = setup({ save: { ok: false, error: "Couldn't save your profile" } });
    expect(await changeAvatar(file, OLD_OWN, deps)).toEqual({ ok: false, error: "Couldn't save your profile" });
    expect(calls).toEqual([`upload ${USER}/new.webp`, `save ${BASE}${USER}/new.webp`, `remove ${USER}/new.webp`]);
  });

  it("a failed delete of the old photo still counts as changed", async () => {
    const { deps } = setup({ remove: { error: { message: "nope" } } });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await changeAvatar(file, OLD_OWN, deps)).toMatchObject({ ok: true });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("an unexpected throw is a message, not a crash", async () => {
    const { deps } = setup({
      resize: async () => {
        throw new Error("canvas exploded");
      },
    });
    expect(await changeAvatar(file, null, deps)).toEqual({ ok: false, error: "Couldn't prepare that photo. Try another." });
  });
});

describe("removeAvatar", () => {
  it("clears the URL, then deletes the own photo", async () => {
    const { deps, calls } = setup();
    expect(await removeAvatar(OLD_OWN, deps)).toMatchObject({ ok: true, profile: { avatar_url: null } });
    expect(calls).toEqual(["save null", `remove ${USER}/old.webp`]);
  });

  it("clears an external URL without deleting anything", async () => {
    const { deps, remove } = setup();
    expect(await removeAvatar("https://example.com/a.png", deps)).toMatchObject({ ok: true });
    expect(remove).not.toHaveBeenCalled();
  });

  it("a failed save keeps the photo, file and all", async () => {
    const { deps, remove } = setup({ save: { ok: false, error: "Couldn't save your profile" } });
    expect(await removeAvatar(OLD_OWN, deps)).toEqual({ ok: false, error: "Couldn't save your profile" });
    expect(remove).not.toHaveBeenCalled();
  });
});
