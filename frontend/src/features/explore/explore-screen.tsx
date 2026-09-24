"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { FileText, Search, Send } from "lucide-react";
import { useState } from "react";
import { BrandCard } from "@/components/domain/brand-card";
import { BriefCard } from "@/components/domain/brief-card";
import { PageContainer, PageHeader } from "@/components/navigation/page";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/display";
import { EmptyState, ErrorState, SkeletonList } from "@/components/ui/feedback";
import { SearchInput } from "@/components/ui/field";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useStartBrandConversation } from "@/features/messages/use-start-conversation";
import { brandsApi } from "@/lib/api/brands";
import { briefsApi } from "@/lib/api/briefs";
import { queryKeys } from "@/lib/api/query-keys";
import { cn } from "@/lib/utils/cn";
import { useDebounced } from "@/lib/utils/use-debounced";

const PAGE_SIZE = 12;
type Mode = "brands" | "briefs";

function ModeCard({
  active,
  icon,
  title,
  description,
  onSelect,
}: {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  description: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cn(
        "flex flex-col items-start rounded-lg border p-3.5 text-left transition-colors",
        active
          ? "border-accent-line bg-accent-tint"
          : "border-border bg-surface hover:border-border-strong",
      )}
    >
      <span className={cn("mb-2", active ? "text-accent" : "text-muted")}>{icon}</span>
      <span className="text-body font-semibold text-fg">{title}</span>
      <span className="mt-0.5 text-caption text-muted">{description}</span>
    </button>
  );
}

function BrandResults({ search, category }: { search: string; category: string }) {
  const startConversation = useStartBrandConversation();
  const query = useInfiniteQuery({
    queryKey: queryKeys.brands.list({ search, category }),
    queryFn: ({ pageParam, signal }) =>
      brandsApi.list({ search, category: category || undefined, page: pageParam, limit: PAGE_SIZE }, signal),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.page * last.limit < last.total ? last.page + 1 : undefined,
  });

  if (query.isLoading) {
    return <SkeletonList count={4} />;
  }
  if (query.isError) {
    return <ErrorState title="Couldn't load brands" onRetry={() => query.refetch()} />;
  }
  const brands = query.data?.pages.flatMap((page) => page.data) ?? [];
  if (brands.length === 0) {
    return (
      <EmptyState
        icon={<Search className="size-5" />}
        title="No brands found"
        description="Try a different search or category."
      />
    );
  }
  return (
    <>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {brands.map((brand) => (
          <BrandCard
            key={brand.id}
            brand={brand}
            messaging={startConversation.isPending && startConversation.variables?.id === brand.id}
            onMessage={(target) => startConversation.mutate(target)}
          />
        ))}
      </div>
      {query.hasNextPage && (
        <div className="mt-6 flex justify-center">
          <Button
            variant="secondary"
            loading={query.isFetchingNextPage}
            onClick={() => query.fetchNextPage()}
          >
            Load more brands
          </Button>
        </div>
      )}
    </>
  );
}

function BriefResults({ search }: { search: string }) {
  const query = useInfiniteQuery({
    queryKey: ["briefs", "list", { search }],
    queryFn: ({ pageParam }) =>
      briefsApi.list({ search, status: "OPEN", page: pageParam, limit: PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.page * last.limit < last.total ? last.page + 1 : undefined,
  });

  if (query.isLoading) {
    return <SkeletonList count={4} />;
  }
  if (query.isError) {
    return <ErrorState title="Couldn't load briefs" onRetry={() => query.refetch()} />;
  }
  const briefs = query.data?.pages.flatMap((page) => page.data) ?? [];
  if (briefs.length === 0) {
    return (
      <EmptyState
        icon={<FileText className="size-5" />}
        title="No open briefs"
        description="New collaboration briefs from brands will appear here."
      />
    );
  }
  return (
    <>
      <div className="grid gap-3 md:grid-cols-2">
        {briefs.map((brief) => (
          <BriefCard key={brief.id} brief={brief} />
        ))}
      </div>
      {query.hasNextPage && (
        <div className="mt-6 flex justify-center">
          <Button
            variant="secondary"
            loading={query.isFetchingNextPage}
            onClick={() => query.fetchNextPage()}
          >
            Load more briefs
          </Button>
        </div>
      )}
    </>
  );
}

export function ExploreScreen() {
  const [mode, setMode] = useState<Mode>("brands");
  const [searchInput, setSearchInput] = useState("");
  const [category, setCategory] = useState("");
  const search = useDebounced(searchInput.trim());
  const categories = useQuery({
    queryKey: queryKeys.brands.categories,
    queryFn: brandsApi.categories,
    staleTime: 10 * 60_000,
  });

  return (
    <PageContainer size="xl">
      <PageHeader title="Explore" subtitle="Discover fashion brands and open collaborations." />

      <div className="mb-4">
        <label htmlFor="explore-search" className="sr-only">
          Search
        </label>
        <SearchInput
          id="explore-search"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder={mode === "brands" ? "Search brands…" : "Search briefs…"}
        />
      </div>

      {mode === "brands" && (
        <div
          className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
          role="group"
          aria-label="Filter by category"
        >
          <Chip selected={category === ""} onClick={() => setCategory("")}>
            All
          </Chip>
          {categories.data?.map((item) => (
            <Chip
              key={item.id}
              selected={category === item.slug}
              onClick={() => setCategory(item.slug)}
            >
              {item.name}
            </Chip>
          ))}
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3">
        <ModeCard
          active={mode === "briefs"}
          onSelect={() => setMode("briefs")}
          icon={<FileText className="size-4.5" aria-hidden />}
          title="Apply to a Brief"
          description="Browse open briefs from brands."
        />
        <ModeCard
          active={mode === "brands"}
          onSelect={() => setMode("brands")}
          icon={<Send className="size-4.5" aria-hidden />}
          title="Reach Out Directly"
          description="Pitch a brand you love."
        />
      </div>

      <Tabs value={mode} onValueChange={(value) => setMode(value as Mode)}>
        <TabsList variant="segmented" className="mb-5">
          <TabsTrigger value="brands">Brands</TabsTrigger>
          <TabsTrigger value="briefs">Open Briefs</TabsTrigger>
        </TabsList>
        <TabsContent value="brands">
          <BrandResults search={search} category={category} />
        </TabsContent>
        <TabsContent value="briefs">
          <BriefResults search={search} />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
