import { readFileSync, existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Supabase renders these with Go templates. The dashboard copy for
// production is pasted by hand from these files, and the local config
// points at them, so the two must keep the variables Supabase fills in.
const TEMPLATES = {
  confirmation: {
    path: "supabase/templates/confirmation.html",
    subject: "Confirm your email for Zenerate",
  },
  recovery: {
    path: "supabase/templates/recovery.html",
    subject: "Reset your Zenerate password",
  },
} as const;

function configSection(name: string): Record<string, string> {
  const toml = readFileSync("supabase/config.toml", "utf8");
  const match = toml.match(
    new RegExp(`^\\[auth\\.email\\.template\\.${name}\\]\\n((?:[^\\[\\n][^\\n]*\\n)*)`, "m"),
  );
  const body = match?.[1] ?? "";
  return Object.fromEntries(
    [...body.matchAll(/^(\w+)\s*=\s*"([^"]*)"/gm)].map((m) => [m[1], m[2]]),
  );
}

describe.each(Object.entries(TEMPLATES))("%s template", (name, { path, subject }) => {
  it("exists and carries every variable Supabase substitutes", () => {
    expect(existsSync(path)).toBe(true);
    const html = readFileSync(path, "utf8");
    // The button, and the pasteable fallback link's href and visible text.
    expect(html.match(/\{\{ \.ConfirmationURL \}\}/g)).toHaveLength(3);
    expect(html).toContain("{{ .Email }}");
    expect(html).toContain("{{ .SiteURL }}");
  });

  it("names the product and nothing about Supabase", () => {
    const html = readFileSync(path, "utf8");
    expect(html).toContain("Zenerate");
    expect(html.toLowerCase()).not.toContain("supabase");
    expect(html.toLowerCase()).not.toContain("powered by");
  });

  it("is wired into the local config with its subject", () => {
    expect(configSection(name)).toEqual({ subject, content_path: `./${path}` });
  });
});
