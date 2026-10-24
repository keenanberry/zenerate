import { describe, expect, it } from "vitest";
import type { ErrorEvent } from "@sentry/nextjs";
import { scrubBreadcrumb, scrubEvent, withoutSessionTracking } from "./options";

// /privacy promises error reports carry no message contents and identify a
// user by id only. These are the last filter before an event leaves.
describe("scrubEvent", () => {
  it("keeps the method, path and user agent, and drops everything else on the request", () => {
    const event = scrubEvent({
      type: undefined,
      request: {
        method: "POST",
        url: "https://www.zeneratestudio.com/api/chat?draft=1#end",
        data: { messages: [{ text: "I can't sleep since my divorce" }] },
        cookies: { "sb-access-token": "secret" },
        query_string: "draft=1",
        headers: { "user-agent": "Safari", authorization: "Bearer secret" },
      },
    } as ErrorEvent);

    expect(event.request).toEqual({
      method: "POST",
      url: "https://www.zeneratestudio.com/api/chat",
      headers: { "user-agent": "Safari" },
    });
  });

  it("reduces the user to an id", () => {
    const withId = scrubEvent({
      type: undefined,
      user: { id: "user-1", email: "a@example.com", ip_address: "1.2.3.4" },
    } as ErrorEvent);
    expect(withId.user).toEqual({ id: "user-1" });

    const withoutId = scrubEvent({
      type: undefined,
      user: { email: "a@example.com" },
    } as ErrorEvent);
    expect(withoutId.user).toBeUndefined();
  });

  it("strips query strings from breadcrumbs already on the event", () => {
    const event = scrubEvent({
      type: undefined,
      breadcrumbs: [{ category: "navigation", data: { from: "/discover?q=grief", to: "/create" } }],
    } as ErrorEvent);
    expect(event.breadcrumbs?.[0].data).toEqual({ from: "/discover", to: "/create" });
  });
});

describe("scrubBreadcrumb", () => {
  it("strips the query from a fetch URL and leaves other fields alone", () => {
    expect(
      scrubBreadcrumb({
        category: "fetch",
        data: { method: "GET", url: "/api/voices?search=calm", status_code: 200 },
      }),
    ).toEqual({
      category: "fetch",
      data: { method: "GET", url: "/api/voices", status_code: 200 },
    });
  });

  it("passes a breadcrumb without data through unchanged", () => {
    const crumb = { category: "ui.click", message: "button.play" };
    expect(scrubBreadcrumb(crumb)).toBe(crumb);
  });
});

describe("withoutSessionTracking", () => {
  it("drops the session integrations, which report page loads rather than errors", () => {
    const names = withoutSessionTracking([
      { name: "BrowserSession" },
      { name: "ProcessSession" },
      { name: "GlobalHandlers" },
    ]).map((i) => i.name);
    expect(names).toEqual(["GlobalHandlers"]);
  });
});
