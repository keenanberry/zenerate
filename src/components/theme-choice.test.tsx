import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-themes", () => ({ useTheme: () => ({ theme: "dark", setTheme: () => {} }) }));

const { ThemeChoice } = await import("./theme-choice");

describe("ThemeChoice", () => {
  const html = renderToStaticMarkup(<ThemeChoice />);

  it("is a radio group named by its visible Theme label", () => {
    expect(html).toContain('role="radiogroup"');
    const labelledBy = /aria-labelledby="([^"]+)"/.exec(html)?.[1];
    expect(labelledBy).toBeTruthy();
    expect(html).toContain(`id="${labelledBy}"`);
    expect(html).toMatch(new RegExp(`id="${labelledBy}"[^>]*>Theme<`));
  });

  it("offers System, Light and Dark", () => {
    const values = [...html.matchAll(/type="radio"[^>]*value="(\w+)"/g)].map((m) => m[1]);
    expect(values).toEqual(["system", "light", "dark"]);
  });

  it("checks nothing on the server, where the stored choice is unknown", () => {
    expect(html).not.toContain(`checked=""`);
  });
});
