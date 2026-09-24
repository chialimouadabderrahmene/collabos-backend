"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  opportunitiesApi,
  type CreateOpportunityInput,
  type ListOpportunitiesQuery,
  type OpportunityStatus,
  type UpdateOpportunityInput,
} from "@/lib/api/opportunities";
import { queryKeys } from "@/lib/api/query-keys";

export function useOpportunities(query: ListOpportunitiesQuery, enabled = true) {
  return useQuery({
    queryKey: queryKeys.opportunities.list(query),
    queryFn: () => opportunitiesApi.list(query),
    enabled,
  });
}

/** Total count for a status, using `limit: 1` so only the total is fetched. */
export function useOpportunityCount(brandId: string | undefined, status?: OpportunityStatus) {
  const query: ListOpportunitiesQuery = { brandId, status, limit: 1 };
  return useQuery({
    queryKey: queryKeys.opportunities.list(query),
    queryFn: () => opportunitiesApi.list(query),
    enabled: Boolean(brandId),
    select: (page) => page.total,
  });
}

export function useOpportunity(id: string) {
  return useQuery({
    queryKey: queryKeys.opportunities.detail(id),
    queryFn: () => opportunitiesApi.get(id),
  });
}

export function useCreateOpportunity() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateOpportunityInput) => opportunitiesApi.create(input),
    onSuccess: (opportunity) => {
      client.setQueryData(queryKeys.opportunities.detail(opportunity.id), opportunity);
      void client.invalidateQueries({ queryKey: queryKeys.opportunities.all });
    },
  });
}

export function useUpdateOpportunity(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateOpportunityInput) => opportunitiesApi.update(id, input),
    onSuccess: (opportunity) => {
      client.setQueryData(queryKeys.opportunities.detail(id), opportunity);
      void client.invalidateQueries({ queryKey: queryKeys.opportunities.all });
    },
  });
}

export function useArchiveOpportunity(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => opportunitiesApi.archive(id),
    onSuccess: (opportunity) => {
      client.setQueryData(queryKeys.opportunities.detail(id), opportunity);
      void client.invalidateQueries({ queryKey: queryKeys.opportunities.all });
    },
  });
}
