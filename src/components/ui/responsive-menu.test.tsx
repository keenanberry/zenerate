import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const desktop = vi.hoisted(() => ({ value: true }));
vi.mock("@/lib/use-is-desktop", () => ({ useIsDesktop: () => desktop.value }));

// Each part renders inline as a marker, and the contents record their props.
const seen = vi.hoisted(() => ({ sheet: {} as Record<string, unknown>, dropdown: {} as Record<string, unknown> }));
vi.mock("@/components/ui/bottom-sheet", () => ({
  BottomSheet: ({ children }: { children?: ReactNode }) => <div data-bottom-sheet>{children}</div>,
  BottomSheetTrigger: ({ children }: { children?: ReactNode }) => <>{children}</>,
  BottomSheetContent: (props: { title: ReactNode; header?: ReactNode; description?: ReactNode; children?: ReactNode }) => {
    seen.sheet = props;
    return (
      <section data-sheet-content>
        <h2>{props.title}</h2>
        {props.header}
        {props.description && <p>{props.description}</p>}
        {props.children}
      </section>
    );
  },
  BottomSheetItem: ({ children }: { children?: ReactNode }) => <div data-sheet-item>{children}</div>,
  BottomSheetSeparator: () => <hr data-sheet-separator />,
}));
vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children?: ReactNode }) => <div data-dropdown>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children?: ReactNode }) => <>{children}</>,
  DropdownMenuContent: (props: { children?: ReactNode }) => {
    seen.dropdown = props;
    return <ul data-dropdown-content>{props.children}</ul>;
  },
  DropdownMenuItem: ({ children }: { children?: ReactNode }) => <li data-dropdown-item>{children}</li>,
  DropdownMenuSeparator: () => <hr data-dropdown-separator />,
}));
vi.mock("@/components/ui/dialog", () => {
  const Pass = ({ children }: { children?: ReactNode }) => <>{children}</>;
  return {
    Dialog: ({ children }: { children?: ReactNode }) => <div data-dialog>{children}</div>,
    DialogContent: ({ children }: { children?: ReactNode }) => <section data-dialog-content>{children}</section>,
    DialogHeader: Pass,
    DialogTitle: ({ children }: { children?: ReactNode }) => <h2>{children}</h2>,
    DialogDescription: ({ children }: { children?: ReactNode }) => <p>{children}</p>,
    DialogFooter: ({ children }: { children?: ReactNode }) => <footer>{children}</footer>,
  };
});

const {
  ResponsiveMenu,
  ResponsiveMenuContent,
  ResponsiveMenuItem,
  ResponsiveMenuSeparator,
  ResponsiveMenuTrigger,
} = await import("./responsive-menu");
const { ResponsiveDialog } = await import("./responsive-dialog");

function menu(onCloseAutoFocus = () => {}) {
  return renderToStaticMarkup(
    <ResponsiveMenu>
      <ResponsiveMenuTrigger asChild>
        <button>More</button>
      </ResponsiveMenuTrigger>
      <ResponsiveMenuContent
        title="More for Rain & Release"
        header={<p>Rain &amp; Release · 10 min</p>}
        align="end"
        onCloseAutoFocus={onCloseAutoFocus}
      >
        <ResponsiveMenuItem>Share</ResponsiveMenuItem>
        <ResponsiveMenuSeparator />
        <ResponsiveMenuItem variant="destructive">Delete</ResponsiveMenuItem>
      </ResponsiveMenuContent>
    </ResponsiveMenu>,
  );
}

beforeEach(() => {
  seen.sheet = {};
  seen.dropdown = {};
});

describe("ResponsiveMenu", () => {
  it("on a phone, is a bottom sheet whose header names the item", () => {
    desktop.value = false;
    const html = menu();
    expect(html).toContain("data-bottom-sheet");
    expect(html).toContain("data-sheet-content");
    expect(html).toContain("Rain &amp; Release · 10 min");
    expect(html.match(/data-sheet-item/g)).toHaveLength(2);
    expect(html).toContain("data-sheet-separator");
    expect(html).not.toContain("data-dropdown");
  });

  it("on a phone, hands onCloseAutoFocus to the sheet, so one layer can open another", () => {
    desktop.value = false;
    const spy = vi.fn();
    menu(spy);
    expect(seen.sheet.onCloseAutoFocus).toBe(spy);
    expect(seen.sheet.title).toBe("More for Rain & Release");
  });

  it("on desktop, is the dropdown, without the sheet's header", () => {
    desktop.value = true;
    const spy = vi.fn();
    const html = menu(spy);
    expect(html).toContain("data-dropdown-content");
    expect(html.match(/data-dropdown-item/g)).toHaveLength(2);
    expect(html).toContain("data-dropdown-separator");
    expect(html).not.toContain("data-bottom-sheet");
    expect(html).not.toContain("10 min");
    expect(seen.dropdown.onCloseAutoFocus).toBe(spy);
    expect(seen.dropdown.align).toBe("end");
  });
});

describe("ResponsiveDialog", () => {
  function dialog() {
    return renderToStaticMarkup(
      <ResponsiveDialog
        open
        onOpenChange={() => {}}
        title="Delete this chat?"
        description="This can't be undone."
        footer={<button>Delete</button>}
      >
        <p>body</p>
      </ResponsiveDialog>,
    );
  }

  it("on a phone, is a bottom sheet with the title, body and actions", () => {
    desktop.value = false;
    const html = dialog();
    expect(html).toContain("data-sheet-content");
    expect(html).toContain("<h2>Delete this chat?</h2>");
    expect(html).toContain("This can&#x27;t be undone.");
    expect(html).toContain("<p>body</p>");
    expect(html).toContain("<button>Delete</button>");
    expect(html).not.toContain("data-dialog");
  });

  it("on desktop, is the centred dialog", () => {
    desktop.value = true;
    const html = dialog();
    expect(html).toContain("data-dialog-content");
    expect(html).toContain("<footer><button>Delete</button></footer>");
    expect(html).not.toContain("data-bottom-sheet");
  });
});
