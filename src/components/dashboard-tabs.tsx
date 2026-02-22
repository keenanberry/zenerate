"use client";

import { useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ViewToggle } from "@/components/view-toggle";
import { ViewProvider, useView } from "@/components/view-context";
import { Library, Heart, FolderOpen } from "lucide-react";

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
      <div className="flex items-center justify-between gap-4">
        <TabsList>
          <TabsTrigger value="meditations" className="gap-2">
            <Library className="h-4 w-4" />
            My Meditations
          </TabsTrigger>
          <TabsTrigger value="favorites" className="gap-2">
            <Heart className="h-4 w-4" />
            Favorites
          </TabsTrigger>
          <TabsTrigger value="collections" className="gap-2">
            <FolderOpen className="h-4 w-4" />
            Collections
          </TabsTrigger>
        </TabsList>

        {showToggle && <ViewToggle view={view} onViewChange={setView} />}
      </div>

      <TabsContent value="meditations" className="mt-6">
        {meditationsContent}
      </TabsContent>

      <TabsContent value="favorites" className="mt-6">
        {favoritesContent}
      </TabsContent>

      <TabsContent value="collections" className="mt-6">
        {collectionsContent}
      </TabsContent>
    </Tabs>
  );
}

export function DashboardTabs(props: DashboardTabsProps) {
  return (
    <ViewProvider>
      <TabsInner {...props} />
    </ViewProvider>
  );
}
