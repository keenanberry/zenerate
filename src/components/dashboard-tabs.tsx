"use client";

import { useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ViewToggle } from "@/components/view-toggle";
import { ViewProvider, useView } from "@/components/view-context";

const VALID_TABS = ["meditations", "favorites", "collections"] as const;
type Tab = (typeof VALID_TABS)[number];

interface DashboardTabsProps {
  defaultTab?: string;
  meditationsContent: React.ReactNode;
  favoritesContent: React.ReactNode;
  collectionsContent: React.ReactNode;
}

function TabsInner({
  defaultTab,
  meditationsContent,
  favoritesContent,
  collectionsContent,
}: DashboardTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { view, setView } = useView();

  const rawTab = searchParams.get("tab") ?? defaultTab ?? "meditations";
  const activeTab: Tab = VALID_TABS.includes(rawTab as Tab)
    ? (rawTab as Tab)
    : "meditations";

  const setActiveTab = useCallback(
    (tab: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (tab === "meditations") {
        params.delete("tab");
      } else {
        params.set("tab", tab);
      }
      const qs = params.toString();
      router.replace(`/dashboard${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [router, searchParams],
  );

  const showToggle = activeTab !== "collections";

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <div className="flex items-center justify-between gap-3">
        {/* Text tabs at every width: three unlabelled glyphs said nothing on a phone (task 48). */}
        <TabsList variant="line" className="h-auto gap-5 p-0">
          <TabsTrigger value="meditations" className="flex-none px-0">
            Meditations
          </TabsTrigger>
          <TabsTrigger value="favorites" className="flex-none px-0">
            Favorites
          </TabsTrigger>
          <TabsTrigger value="collections" className="flex-none px-0">
            Collections
          </TabsTrigger>
        </TabsList>

        {showToggle && <ViewToggle view={view} onViewChange={setView} />}
      </div>

      <TabsContent value="meditations" className="mt-8">
        {meditationsContent}
      </TabsContent>

      <TabsContent value="favorites" className="mt-8">
        {favoritesContent}
      </TabsContent>

      <TabsContent value="collections" className="mt-8">
        {collectionsContent}
      </TabsContent>
    </Tabs>
  );
}

export function DashboardTabs(props: DashboardTabsProps) {
  return (
    <ViewProvider storageKey="zenerate:view:library">
      <TabsInner {...props} />
    </ViewProvider>
  );
}
