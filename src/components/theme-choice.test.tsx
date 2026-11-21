import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-themes", () => ({ useTheme: () => ({ theme: "dark", setTheme: () => {} }) }));

const { ThemeChoice } = await import("./theme-choice");

describe("ThemeChoice", () => {
  const html = renderToStaticMarkup(<ThemeChoice />);

  it("is a radio group named by its visible Theme label", () => {
    expect(html).toContain('role="radiogroup"');
    expect(html).toContain('aria-labelledby="theme-label"');
    expect(html).toMatch(/id="theme-label"[^>]*>Theme</);
  });

  it("offers System, Light and Dark", () => {
    const values = [...html.matchAll(/type="radio"[^>]*value="(\w+)"/g)].map((m) => m[1]);
    expect(values).toEqual(["system", "light", "dark"]);
  });

  it("checks nothing on the server, where the stored choice is unknown", () => {
    expect(html).not.toContain(`checked=""`);
  });
});
