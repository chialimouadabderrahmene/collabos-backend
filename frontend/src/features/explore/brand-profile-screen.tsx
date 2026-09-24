"use client";

import { useQuery } from "@tanstack/react-query";
import { AtSign, BadgeCheck, Globe, Mail, MapPin, Sparkles } from "lucide-react";
import Link from "next/link";
import { BriefCard } from "@/components/domain/brief-card";
import { BackLink, PageContainer } from "@/components/navigation/page";
import { Button } from "@/components/ui/button";
import { Avatar, Badge, Card, Eyebrow, Progress, SectionHeader, Stat, Tag } from "@/components/ui/display";
import { EmptyState, ErrorState, Skeleton, SkeletonList } from "@/components/ui/feedback";
import { useStartBrandConversation } from "@/features/messages/use-start-conversation";
import { BrandShop } from "@/features/products/product-screens";
import { insightsApi } from "@/lib/api/ai";
import { brandsApi, type Brand } from "@/lib/api/brands";
import { briefsApi } from "@/lib/api/briefs";
import { ApiError } from "@/lib/api/http";
import { queryKeys } from "@/lib/api/query-keys";
import { formatCompact } from "@/lib/utils/format";

function WhyYouMatch({ brandId }: { brandId: string }) {
  const match = useQuery({
    queryKey: ["ai", "brand-match", brandId],
    queryFn: () => insightsApi.brandMatch(brandId),
    retry: false,
  });
  // The insight is optional: hide it on any error (e.g. not applicable).
  if (match.isLoading) {
    return <Skeleton className="mb-6 h-28 w-full rounded-lg" />;
  }
  if (!match.data) {
    return null;
  }
  return (
    <Card highlight className="mb-6 p-4">
      <div className="flex items-center justify-between">
        <Eyebrow tone="accent">Why you match</Eyebrow>
        {match.data.generatedByAi && (
          <span className="inline-flex items-center gap-1 text-[0.6875rem] text-accent">
            <Sparkles className="size-3" aria-hidden /> AI insight
          </span>
        )}
      </div>
      <p className="mt-2 text-body text-fg-2">{match.data.narrative}</p>
      <Progress className="mt-3" value={match.data.score} label="Match score" />
      {match.data.overlapCategories.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Shared categories">
          {match.data.overlapCategories.map((name) => (
            <li key={name}>
              <Tag className="border-accent-line text-accent">{name}</Tag>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function ProfileLinks({ brand }: { brand: Brand }) {
  const profile = brand.profile;
  if (!profile) {
    return null;
  }
  const links = [
    profile.websiteUrl && { href: profile.websiteUrl, label: profile.websiteUrl.replace(/^https?:\/\//, ""), icon: Globe },
    profile.instagramHandle && {
      href: `https://instagram.com/${profile.instagramHandle.replace(/^@/, "")}`,
      label: `@${profile.instagramHandle.replace(/^@/, "")}`,
      icon: AtSign,
    },
    profile.contactEmail && { href: `mailto:${profile.contactEmail}`, label: profile.contactEmail, icon: Mail },
  ].filter(Boolean) as Array<{ href: string; label: string; icon: typeof Globe }>;
  if (links.length === 0) {
    return null;
  }
  return (
    <ul className="mt-4 flex flex-col gap-2">
      {links.map(({ href, label, icon: Icon }) => (
        <li key={href}>
          <a
            href={href}
            target={href.startsWith("mailto:") ? undefined : "_blank"}
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-caption text-fg-2 hover:text-accent"
          >
            <Icon className="size-3.5 text-muted" aria-hidden />
            {label}
          </a>
        </li>
      ))}
    </ul>
  );
}

export function BrandProfileScreen({ brandId }: { brandId: string }) {
  const startConversation = useStartBrandConversation();
  const brand = useQuery({
    queryKey: queryKeys.brands.detail(brandId),
    queryFn: () => brandsApi.get(brandId),
  });
  const briefs = useQuery({
    queryKey: ["briefs", "list", { brandId, status: "OPEN" }],
    queryFn: () => briefsApi.list({ brandId, status: "OPEN", limit: 5 }),
    enabled: brand.isSuccess,
  });

  if (brand.isLoading) {
    return (
      <PageContainer>
        <Skeleton className="mb-4 h-4 w-16" />
        <div className="flex items-center gap-4">
          <Skeleton className="size-20 rounded-lg" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        </div>
        <SkeletonList className="mt-8" count={2} />
      </PageContainer>
    );
  }

  if (brand.isError || !brand.data) {
    const notFound = brand.error instanceof ApiError && brand.error.isNotFound;
    return (
      <PageContainer>
        <BackLink href="/explore" />
        <ErrorState
          title={notFound ? "Brand not found" : "Couldn't load this brand"}
          description={notFound ? "It may have been removed or deactivated." : undefined}
          onRetry={notFound ? undefined : () => brand.refetch()}
        />
      </PageContainer>
    );
  }

  const data = brand.data;
  const openBriefs = briefs.data?.data ?? [];

  return (
    <PageContainer size="md" className="pb-40 lg:pb-16">
      <BackLink href="/explore" />

      <header className="mb-6 flex items-start gap-4">
        <Avatar name={data.name} src={data.logoUrl} size="xl" />
        <div className="min-w-0 flex-1 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-title">{data.name}</h1>
            {data.isVerified && (
              <Badge tone="info">
                <BadgeCheck className="size-3" aria-hidden /> Verified
              </Badge>
            )}
          </div>
          {data.profile?.location && (
            <p className="mt-1.5 inline-flex items-center gap-1 text-caption text-muted">
              <MapPin className="size-3.5" aria-hidden /> {data.profile.location}
            </p>
          )}
          {data.categories.length > 0 && (
            <ul className="mt-2.5 flex flex-wrap gap-1.5" aria-label="Categories">
              {data.categories.map((category) => (
                <li key={category.id}>
                  <Tag>{category.name}</Tag>
                </li>
              ))}
            </ul>
          )}
        </div>
      </header>

      <WhyYouMatch brandId={brandId} />

      <div className="mb-6 grid grid-cols-3 gap-3">
        <Stat value={formatCompact(data.followersCount)} label="Followers" />
        <Stat value={briefs.data?.total ?? "–"} label="Open briefs" accent />
        <Stat value={data.profile?.foundedYear ?? "–"} label="Founded" />
      </div>

      <section className="mb-8" aria-labelledby="about">
        <SectionHeader title={<span id="about">About</span>} />
        {data.profile?.description ? (
          <p className="text-body leading-relaxed text-fg-2">{data.profile.description}</p>
        ) : (
          <p className="text-body text-faint">This brand hasn&apos;t added a description yet.</p>
        )}
        <ProfileLinks brand={data} />
      </section>

      <section aria-labelledby="open-briefs">
        <SectionHeader title={<span id="open-briefs">Open Briefs</span>} />
        {briefs.isLoading ? (
          <SkeletonList count={2} />
        ) : openBriefs.length > 0 ? (
          <div className="flex flex-col gap-3">
            {openBriefs.map((item) => (
              <BriefCard key={item.id} brief={item} />
            ))}
          </div>
        ) : (
          <EmptyState title="No open briefs" description="Reach out directly to start a collaboration." />
        )}
      </section>

      <BrandShop brandId={data.id} />

      <div className="safe-bottom fixed inset-x-0 bottom-16 z-30 border-t border-border bg-bg/95 px-4 pt-3 pb-3 backdrop-blur-md lg:static lg:mt-8 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
        <div className="mx-auto flex max-w-3xl flex-col gap-2">
          {/* No direct brand-proposal endpoint exists: proposals are sent on a
              brief; without one, the pitch starts as a conversation. */}
          {openBriefs[0] ? (
            <Button asChild size="lg" fullWidth>
              <Link href={`/briefs/${openBriefs[0].id}`}>Propose Collaboration</Link>
            </Button>
          ) : (
            <Button size="lg" fullWidth loading={startConversation.isPending} onClick={() => startConversation.mutate(data)}>
              Propose Collaboration
            </Button>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="secondary"
              loading={startConversation.isPending}
              onClick={() => startConversation.mutate(data)}
            >
              Message
            </Button>
            <Button asChild variant="outline" disabled={openBriefs.length === 0}>
              <Link
                href={openBriefs[0] ? `/briefs/${openBriefs[0].id}` : "#open-briefs"}
                aria-disabled={openBriefs.length === 0}
              >
                View Open Brief
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
