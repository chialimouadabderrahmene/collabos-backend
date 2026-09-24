"use client";

import { Plus, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { OpportunityCard } from "@/components/domain/opportunity-card";
import { PageContainer, PageHeader } from "@/components/navigation/page";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/display";
import { EmptyState, ErrorState, Pagination, SkeletonList } from "@/components/ui/feedback";
import { SearchInput } from "@/components/ui/field";
import { useActiveBrand } from "@/features/brands/workspace";
import type { OpportunityStatus } from "@/lib/api/opportunities";
import { useDebounced } from "@/lib/utils/use-debounced";
import { useOpportunities } from "./hooks";

const FILTERS: Array<{ value: OpportunityStatus | "ALL"; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "DRAFT", label: "Drafts" },
  { value: "PUBLISHED", label: "Published" },
  { value: "ARCHIVED", label: "Archived" },
];

export function OpportunitiesList() {
  const { brand } = useActiveBrand();
  const [status, setStatus] = useState<OpportunityStatus | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const search = useDebounced(searchInput.trim());
  const query = useOpportunities({
    brandId: brand?.id,
    status: status === "ALL" ? undefined : status,
    search: search || undefined,
    page,
    limit: 12,
  });

  return (
    <PageContainer size="lg">
      <PageHeader
        title="Opportunities"
        subtitle={brand ? `Editorial opportunities for ${brand.name}` : undefined}
        actions={
          <Button asChild size="sm">
            <Link href="/opportunities/new">
              <Plus className="size-4" aria-hidden /> New
            </Link>
          </Button>
        }
      />
      <div className="mb-4">
        <label htmlFor="opportunity-search" className="sr-only">
          Search opportunities
        </label>
        <SearchInput
          id="opportunity-search"
          value={searchInput}
          onChange={(event) => {
            setSearchInput(event.target.value);
            setPage(1);
          }}
          placeholder="Search by title…"
        />
      </div>
      <div className="mb-5 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filter by status">
        {FILTERS.map((filter) => (
          <Chip
            key={filter.value}
            selected={status === filter.value}
            onClick={() => {
              setStatus(filter.value);
              setPage(1);
            }}
          >
            {filter.label}
          </Chip>
        ))}
      </div>

      {query.isLoading ? (
        <SkeletonList count={4} />
      ) : query.isError ? (
        <ErrorState title="Couldn't load opportunities" onRetry={() => query.refetch()} />
      ) : query.data && query.data.data.length > 0 ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {query.data.data.map((opportunity) => (
              <OpportunityCard key={opportunity.id} opportunity={opportunity} />
            ))}
          </div>
          <Pagination
            className="mt-6"
            page={query.data.page}
            total={query.data.total}
            limit={query.data.limit}
            onPageChange={setPage}
          />
        </>
      ) : (
        <EmptyState
          icon={<Sparkles className="size-5" />}
          title={search || status !== "ALL" ? "Nothing matches" : "No Opportunities yet"}
          description={
            search || status !== "ALL"
              ? "Try another search or filter."
              : "Create an editorial Opportunity from your ideas and references."
          }
          action={
            <Button asChild>
              <Link href="/opportunities/new">Create Opportunity</Link>
            </Button>
          }
        />
      )}
    </PageContainer>
  );
}
