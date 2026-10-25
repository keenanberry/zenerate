import { describe, expect, it } from "vitest";
import { REPORT_EMAIL, reportHref } from "./report";

function parse(href: string): Record<string, string> {
  const [address, query] = href.replace(/^mailto:/, "").split("?");
  const params: Record<string, string> = Object.fromEntries(
    query.split("&").map((pair) => {
      const [key, value] = pair.split("=");
      return [key, decodeURIComponent(value)];
    }),
  );
  return { address, ...params };
}

describe("reportHref", () => {
  const meditation = { id: "abc-123", title: "Rain & Release" };

  it("mails privacy@ with the title and the meditation's absolute URL", () => {
    const mail = parse(reportHref(meditation, new URL("https://www.zeneratestudio.com")));
    expect(mail.address).toBe(REPORT_EMAIL);
    expect(mail.subject).toBe("Report: Rain & Release");
    expect(mail.body).toContain("Rain & Release\nhttps://www.zeneratestudio.com/meditation/abc-123\n");
  });

  it("percent-encodes spaces and ampersands so the query survives", () => {
    const href = reportHref(meditation, "https://www.zeneratestudio.com");
    expect(href).not.toMatch(/[ +]/);
    expect(href.match(/&/g)).toHaveLength(1);
  });

  it("resolves against the site origin, whatever path it carries", () => {
    const mail = parse(reportHref(meditation, "http://localhost:3000/discover"));
    expect(mail.body).toContain("http://localhost:3000/meditation/abc-123");
  });
});
