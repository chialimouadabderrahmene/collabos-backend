"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Building2, ChevronRight, ImagePlus, LogOut, Settings, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { Breadcrumbs, PageContainer, PageHeader } from "@/components/navigation/page";
import { WORKSPACE_NAV } from "@/components/navigation/nav-items";
import { Button } from "@/components/ui/button";
import { Avatar, Badge, Card, SectionHeader } from "@/components/ui/display";
import { EmptyState, ErrorState, LoadingState, Pagination, SkeletonList } from "@/components/ui/feedback";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { useLogout, useSession } from "@/features/auth/hooks";
import { ROLE_COPY } from "@/features/brands/team-screen";
import { useActiveBrand } from "@/features/brands/workspace";
import { authApi } from "@/lib/api/auth";
import { brandsApi, type Brand } from "@/lib/api/brands";
import { ApiError } from "@/lib/api/http";
import { notificationsApi } from "@/lib/api/notifications";
import { queryKeys } from "@/lib/api/query-keys";
import {
  AVATAR_TYPES,
  PROFILE_LIMITS,
  usersApi,
  type DigestFrequency,
  type MeasurementUnit,
  type NotificationPreferences,
  type PrivacySettings,
  type ProfileVisibility,
  type UserProfile,
} from "@/lib/api/users";
import { cn } from "@/lib/utils/cn";
import { formatRelative } from "@/lib/utils/format";
import { brandIdentitySchema, brandStrategySchema } from "@/lib/validation/brand";

const apiMessage = (error: unknown) => (error instanceof ApiError ? error.message : undefined);

function displayNameOf(profile: UserProfile | undefined, fallback = "Your profile"): string {
  if (!profile) return fallback;
  return (
    profile.displayName ||
    [profile.firstName, profile.lastName].filter(Boolean).join(" ") ||
    profile.email
  );
}

function LinkRow({ href, icon, label, hint }: { href: string; icon: React.ReactNode; label: string; hint?: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-surface-2/60">
      <span className="text-muted">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-body text-fg">{label}</span>
        {hint && <span className="block truncate text-caption text-muted">{hint}</span>}
      </span>
      <ChevronRight className="size-4 text-faint" aria-hidden />
    </Link>
  );
}

/* ------------------------------------------------------------- profile */

export function ProfileScreen() {
  const profile = useQuery({ queryKey: queryKeys.profile, queryFn: usersApi.me });
  const { brand } = useActiveBrand();
  const logout = useLogout();
  const resend = useMutation({
    mutationFn: () => authApi.forgotPassword(profile.data!.email),
  });

  if (profile.isLoading) return <LoadingState />;
  if (profile.isError || !profile.data) {
    return (
      <PageContainer>
        <ErrorState title="Couldn't load your profile" onRetry={() => profile.refetch()} />
      </PageContainer>
    );
  }
  const data = profile.data;

  return (
    <PageContainer>
      <header className="mb-8 flex items-center gap-4">
        <Avatar name={displayNameOf(data)} src={data.avatarUrl} shape="circle" size="lg" />
        <div className="min-w-0">
          <h1 className="truncate font-display text-title text-fg">{displayNameOf(data)}</h1>
          <p className="truncate text-body text-muted">{data.email}</p>
          <div className="mt-1.5 flex gap-2">
            {data.isEmailVerified ? <Badge tone="accent">Verified</Badge> : <Badge tone="warning">Email not verified</Badge>}
          </div>
        </div>
      </header>

      {data.bio && <p className="mb-8 text-body whitespace-pre-wrap text-fg-2">{data.bio}</p>}

      {brand && (
        <section className="mb-8">
          <SectionHeader title="Brand" />
          <Card className="divide-y divide-border">
            <div className="flex items-center gap-3 px-4 py-3.5">
              <Avatar name={brand.name} src={brand.logoUrl} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-body font-semibold text-fg">{brand.name}</p>
                <p className="text-caption text-muted">{ROLE_COPY[brand.role].label}</p>
              </div>
              <Link href={`/explore/brands/${brand.id}`} className="text-caption font-semibold text-accent">
                View
              </Link>
            </div>
            <LinkRow href="/brand" icon={<Building2 className="size-4" aria-hidden />} label="Brand settings" hint="Identity, logo and cover" />
            <LinkRow href="/brand/team" icon={<Users className="size-4" aria-hidden />} label="Team" hint="Members and roles" />
          </Card>
        </section>
      )}

      {/* The mobile tab bar has five slots; workspace areas live here. */}
      <section className="mb-8 lg:hidden">
        <SectionHeader title="Workspace" />
        <Card className="divide-y divide-border">
          {WORKSPACE_NAV.map((item) => {
            const Icon = item.icon;
            return <LinkRow key={item.href} href={item.href} icon={<Icon className="size-4" aria-hidden />} label={item.label} />;
          })}
        </Card>
      </section>

      <section className="mb-8">
        <SectionHeader title="Account" />
        <Card className="divide-y divide-border">
          <LinkRow href="/settings" icon={<Settings className="size-4" aria-hidden />} label="Settings" hint="Profile, notifications, privacy" />
          <LinkRow href="/activity" icon={<Bell className="size-4" aria-hidden />} label="Activity" hint="Notifications" />
          <button
            type="button"
            onClick={() => resend.mutate()}
            disabled={resend.isPending || resend.isSuccess}
            className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-2/60 disabled:opacity-60"
          >
            <ShieldCheck className="size-4 text-muted" aria-hidden />
            <span className="flex-1 text-body text-fg">{resend.isSuccess ? "Reset link sent — check your email" : "Email me a password reset link"}</span>
          </button>
        </Card>
      </section>

      <Button variant="secondary" fullWidth loading={logout.isPending} onClick={() => logout.mutate()}>
        <LogOut className="size-4" aria-hidden /> Sign out
      </Button>
    </PageContainer>
  );
}

/* ------------------------------------------------------------ settings */

function ProfileForm({ profile }: { profile: UserProfile }) {
  const client = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [values, setValues] = useState({
    firstName: profile.firstName ?? "",
    lastName: profile.lastName ?? "",
    displayName: profile.displayName ?? "",
    bio: profile.bio ?? "",
  });
  const set = (key: keyof typeof values) => (event: { target: { value: string } }) =>
    setValues((current) => ({ ...current, [key]: event.target.value }));
  const save = useMutation({
    mutationFn: () => usersApi.updateProfile(values),
    onSuccess: (updated) => {
      client.setQueryData(queryKeys.profile, updated);
      toast.success("Profile saved");
    },
    onError: (error) => toast.error("Couldn't save", apiMessage(error)),
  });
  const avatar = useMutation({
    mutationFn: (file: File | null) => (file ? usersApi.uploadAvatar(file) : usersApi.removeAvatar()),
    onSuccess: ({ avatarUrl }) => {
      client.setQueryData<UserProfile>(queryKeys.profile, (current) => current && { ...current, avatarUrl });
      toast.success(avatarUrl ? "Photo updated" : "Photo removed");
    },
    onError: (error) => toast.error("Couldn't update photo", apiMessage(error)),
  });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-4">
        <Avatar name={displayNameOf(profile)} src={profile.avatarUrl} shape="circle" size="lg" />
        <input
          ref={input}
          type="file"
          accept={AVATAR_TYPES.join(",")}
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            if (!AVATAR_TYPES.includes(file.type)) {
              toast.error("Unsupported image", "Use JPEG, PNG or WEBP.");
              return;
            }
            avatar.mutate(file);
          }}
        />
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" loading={avatar.isPending} onClick={() => input.current?.click()}>
            <ImagePlus className="size-4" aria-hidden /> Change photo
          </Button>
          {profile.avatarUrl && (
            <Button size="sm" variant="ghost" onClick={() => avatar.mutate(null)}>
              Remove
            </Button>
          )}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name" optional>
          {({ id }) => <Input id={id} autoComplete="given-name" maxLength={PROFILE_LIMITS.firstName} value={values.firstName} onChange={set("firstName")} />}
        </Field>
        <Field label="Last name" optional>
          {({ id }) => <Input id={id} autoComplete="family-name" maxLength={PROFILE_LIMITS.lastName} value={values.lastName} onChange={set("lastName")} />}
        </Field>
      </div>
      <Field label="Display name" optional hint="Shown to collaborators.">
        {({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} maxLength={PROFILE_LIMITS.displayName} value={values.displayName} onChange={set("displayName")} />}
      </Field>
      <Field label="Bio" optional hint={`${values.bio.length} / ${PROFILE_LIMITS.bio}`}>
        {({ id, describedBy }) => (
          <Textarea id={id} rows={4} aria-describedby={describedBy} maxLength={PROFILE_LIMITS.bio} value={values.bio} onChange={set("bio")} />
        )}
      </Field>
      <Button className="self-start" loading={save.isPending} onClick={() => save.mutate()}>
        Save profile
      </Button>
    </div>
  );
}

function ToggleList<T extends object>({
  queryKey,
  load,
  update,
  items,
}: {
  queryKey: readonly unknown[];
  load: () => Promise<T>;
  update: (input: Partial<T>) => Promise<T>;
  items: Array<{ key: keyof T & string; label: string; description?: string }>;
}) {
  const client = useQueryClient();
  const query = useQuery({ queryKey, queryFn: load });
  const mutation = useMutation({
    mutationFn: update,
    // Optimistic toggle, rolled back if the backend refuses.
    onMutate: async (input) => {
      await client.cancelQueries({ queryKey });
      const previous = client.getQueryData<T>(queryKey);
      client.setQueryData<T>(queryKey, (current) => current && { ...current, ...input });
      return { previous };
    },
    onError: (error, _input, context) => {
      client.setQueryData(queryKey, context?.previous);
      toast.error("Couldn't save", apiMessage(error));
    },
    onSuccess: (updated) => client.setQueryData(queryKey, updated),
  });
  if (query.isLoading) return <SkeletonList count={3} />;
  if (query.isError || !query.data) return <ErrorState title="Couldn't load settings" onRetry={() => query.refetch()} />;
  const data = query.data;
  return (
    <Card className="flex flex-col gap-5 p-5">
      {items.map((item) => (
        <Checkbox
          key={item.key}
          label={item.label}
          description={item.description}
          checked={Boolean(data[item.key])}
          onChange={(event) => mutation.mutate({ [item.key]: event.target.checked } as Partial<T>)}
        />
      ))}
    </Card>
  );
}

function PrivacyForm() {
  const client = useQueryClient();
  const privacy = useQuery({ queryKey: queryKeys.userPrivacy, queryFn: usersApi.privacy });
  const update = useMutation({
    mutationFn: (input: Partial<PrivacySettings>) => usersApi.updatePrivacy(input),
    onSuccess: (updated) => client.setQueryData(queryKeys.userPrivacy, updated),
    onError: (error) => toast.error("Couldn't save", apiMessage(error)),
  });
  if (privacy.isLoading) return <SkeletonList count={3} />;
  if (!privacy.data) return <ErrorState title="Couldn't load privacy settings" onRetry={() => privacy.refetch()} />;
  return (
    <Card className="flex flex-col gap-5 p-5">
      <Field label="Profile visibility">
        {({ id }) => (
          <Select id={id} value={privacy.data.profileVisibility} onChange={(event) => update.mutate({ profileVisibility: event.target.value as ProfileVisibility })}>
            <option value="PUBLIC">Public — visible to CollabOS members</option>
            <option value="PRIVATE">Private — only collaborators</option>
          </Select>
        )}
      </Field>
      <Checkbox label="Show my email on my profile" checked={privacy.data.showEmail} onChange={(event) => update.mutate({ showEmail: event.target.checked })} />
      <Checkbox
        label="Allow search engines to index my profile"
        checked={privacy.data.allowSearchIndexing}
        onChange={(event) => update.mutate({ allowSearchIndexing: event.target.checked })}
      />
    </Card>
  );
}

function PreferencesForm() {
  const client = useQueryClient();
  const preferences = useQuery({ queryKey: queryKeys.userPreferences, queryFn: usersApi.preferences });
  const settings = useQuery({ queryKey: queryKeys.userSettings, queryFn: usersApi.settings });
  const updatePreferences = useMutation({
    mutationFn: usersApi.updatePreferences,
    onSuccess: (updated) => client.setQueryData(queryKeys.userPreferences, updated),
    onError: (error) => toast.error("Couldn't save", apiMessage(error)),
  });
  const updateSettings = useMutation({
    mutationFn: usersApi.updateSettings,
    onSuccess: (updated) => client.setQueryData(queryKeys.userSettings, updated),
    onError: (error) => toast.error("Couldn't save", apiMessage(error)),
  });
  const [zones] = useState<string[]>(() =>
    typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [],
  );
  if (preferences.isLoading || settings.isLoading) return <SkeletonList count={3} />;
  if (!preferences.data || !settings.data) {
    return <ErrorState title="Couldn't load preferences" onRetry={() => { void preferences.refetch(); void settings.refetch(); }} />;
  }
  return (
    <Card className="flex flex-col gap-5 p-5">
      <Field label="Email digest">
        {({ id }) => (
          <Select id={id} value={preferences.data.digestFrequency} onChange={(event) => updatePreferences.mutate({ digestFrequency: event.target.value as DigestFrequency })}>
            <option value="DAILY">Daily</option>
            <option value="WEEKLY">Weekly</option>
            <option value="MONTHLY">Monthly</option>
            <option value="NEVER">Never</option>
          </Select>
        )}
      </Field>
      <Field label="Measurements">
        {({ id }) => (
          <Select id={id} value={preferences.data.measurementUnit} onChange={(event) => updatePreferences.mutate({ measurementUnit: event.target.value as MeasurementUnit })}>
            <option value="METRIC">Metric (cm, kg)</option>
            <option value="IMPERIAL">Imperial (in, lb)</option>
          </Select>
        )}
      </Field>
      <Field label="Time zone">
        {({ id }) => (
          <Select id={id} value={settings.data.timezone} onChange={(event) => updateSettings.mutate({ timezone: event.target.value })}>
            {[...new Set([settings.data.timezone, ...zones])].map((zone) => (
              <option key={zone} value={zone}>
                {zone.replace(/_/g, " ")}
              </option>
            ))}
          </Select>
        )}
      </Field>
    </Card>
  );
}

export function SettingsScreen() {
  const profile = useQuery({ queryKey: queryKeys.profile, queryFn: usersApi.me });
  return (
    <PageContainer>
      <Breadcrumbs items={[{ label: "Profile", href: "/profile" }, { label: "Settings" }]} />
      <PageHeader title="Settings" />
      <Tabs defaultValue="profile">
        <TabsList className="mb-6 overflow-x-auto">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="privacy">Privacy</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
        </TabsList>
        <TabsContent value="profile">
          {profile.isLoading ? (
            <SkeletonList count={3} />
          ) : profile.data ? (
            <ProfileForm key={profile.data.id} profile={profile.data} />
          ) : (
            <ErrorState title="Couldn't load your profile" onRetry={() => profile.refetch()} />
          )}
        </TabsContent>
        <TabsContent value="notifications">
          <ToggleList<NotificationPreferences>
            queryKey={queryKeys.userNotifications}
            load={usersApi.notifications}
            update={usersApi.updateNotifications}
            items={[
              { key: "emailNotifications", label: "Email notifications", description: "Proposals, deals, contracts and orders." },
              { key: "pushNotifications", label: "Push notifications" },
              { key: "smsNotifications", label: "SMS notifications" },
              { key: "marketingEmails", label: "Product news from CollabOS" },
            ]}
          />
        </TabsContent>
        <TabsContent value="privacy">
          <PrivacyForm />
        </TabsContent>
        <TabsContent value="preferences">
          <PreferencesForm />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}

/* ------------------------------------------------------ brand settings */

function BrandImages({ brand }: { brand: Brand }) {
  const client = useQueryClient();
  const logoInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);
  const refresh = () => {
    void client.invalidateQueries({ queryKey: queryKeys.brands.mine });
    void client.invalidateQueries({ queryKey: queryKeys.brands.detail(brand.id) });
  };
  const upload = useMutation({
    mutationFn: async ({ kind, file }: { kind: "logo" | "cover"; file: File }) => {
      await (kind === "logo" ? brandsApi.uploadLogo(brand.id, file) : brandsApi.uploadCover(brand.id, file));
    },
    onSuccess: () => {
      toast.success("Image updated");
      refresh();
    },
    onError: (error) => toast.error("Upload failed", apiMessage(error)),
  });
  const picker = (kind: "logo" | "cover", ref: React.RefObject<HTMLInputElement | null>) => (
    <input
      ref={ref}
      type="file"
      accept={AVATAR_TYPES.join(",")}
      className="sr-only"
      tabIndex={-1}
      aria-hidden
      onChange={(event) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        if (!AVATAR_TYPES.includes(file.type)) {
          toast.error("Unsupported image", "Use JPEG, PNG or WEBP.");
          return;
        }
        upload.mutate({ kind, file });
      }}
    />
  );
  return (
    <Card className="overflow-hidden">
      <div className={cn("relative h-32 bg-surface-2", brand.coverUrl && "bg-cover bg-center")} style={brand.coverUrl ? { backgroundImage: `url(${JSON.stringify(brand.coverUrl)})` } : undefined}>
        <Button size="sm" variant="secondary" className="absolute right-3 bottom-3" loading={upload.isPending && upload.variables?.kind === "cover"} onClick={() => coverInput.current?.click()}>
          Change cover
        </Button>
      </div>
      <div className="flex items-center gap-4 p-4">
        <Avatar name={brand.name} src={brand.logoUrl} size="lg" />
        <Button size="sm" variant="secondary" loading={upload.isPending && upload.variables?.kind === "logo"} onClick={() => logoInput.current?.click()}>
          <ImagePlus className="size-4" aria-hidden /> Change logo
        </Button>
      </div>
      {picker("logo", logoInput)}
      {picker("cover", coverInput)}
    </Card>
  );
}

function BrandForm({ brand }: { brand: Brand }) {
  const client = useQueryClient();
  const profile = brand.profile;
  const [values, setValues] = useState({
    name: brand.name,
    description: profile?.description ?? "",
    websiteUrl: profile?.websiteUrl ?? "",
    instagramHandle: profile?.instagramHandle ?? "",
    contactEmail: profile?.contactEmail ?? "",
    foundedYear: profile?.foundedYear ? String(profile.foundedYear) : "",
    location: profile?.location ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (key: keyof typeof values) => (event: { target: { value: string } }) =>
    setValues((current) => ({ ...current, [key]: event.target.value }));

  const save = useMutation({
    mutationFn: async () => {
      const identity = brandIdentitySchema.safeParse({
        name: values.name,
        instagramHandle: values.instagramHandle,
        websiteUrl: values.websiteUrl,
      });
      const strategy = brandStrategySchema.safeParse({
        description: values.description,
        foundedYear: values.foundedYear,
        contactEmail: values.contactEmail,
      });
      const issues = [...(identity.error?.issues ?? []), ...(strategy.error?.issues ?? [])];
      if (issues.length || !identity.success || !strategy.success) {
        setErrors(Object.fromEntries(issues.map((issue) => [String(issue.path[0]), issue.message])));
        throw new Error("validation");
      }
      setErrors({});
      if (identity.data.name !== brand.name) await brandsApi.update(brand.id, { name: identity.data.name });
      return brandsApi.updateProfile(brand.id, {
        description: strategy.data.description,
        websiteUrl: identity.data.websiteUrl,
        instagramHandle: identity.data.instagramHandle,
        contactEmail: strategy.data.contactEmail || undefined,
        foundedYear: strategy.data.foundedYear ? Number(strategy.data.foundedYear) : undefined,
        location: values.location.trim() || undefined,
      });
    },
    onSuccess: () => {
      toast.success("Brand saved");
      void client.invalidateQueries({ queryKey: queryKeys.brands.mine });
      void client.invalidateQueries({ queryKey: queryKeys.brands.detail(brand.id) });
    },
    onError: (error) => {
      if (error instanceof Error && error.message === "validation") return;
      toast.error("Couldn't save the brand", apiMessage(error));
    },
  });

  return (
    <Card className="flex flex-col gap-4 p-5">
      <Field label="Brand name" error={errors.name}>
        {({ id, describedBy, invalid }) => <Input id={id} maxLength={80} aria-describedby={describedBy} aria-invalid={invalid || undefined} value={values.name} onChange={set("name")} />}
      </Field>
      <Field label="About" optional error={errors.description}>
        {({ id }) => <Textarea id={id} rows={5} maxLength={1000} value={values.description} onChange={set("description")} />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Website" optional error={errors.websiteUrl}>
          {({ id, describedBy, invalid }) => <Input id={id} inputMode="url" placeholder="voidstudio.com" aria-describedby={describedBy} aria-invalid={invalid || undefined} value={values.websiteUrl} onChange={set("websiteUrl")} />}
        </Field>
        <Field label="Instagram" optional error={errors.instagramHandle}>
          {({ id, describedBy, invalid }) => <Input id={id} placeholder="@voidstudio" aria-describedby={describedBy} aria-invalid={invalid || undefined} value={values.instagramHandle} onChange={set("instagramHandle")} />}
        </Field>
        <Field label="Contact email" optional error={errors.contactEmail}>
          {({ id, describedBy, invalid }) => <Input id={id} type="email" aria-describedby={describedBy} aria-invalid={invalid || undefined} value={values.contactEmail} onChange={set("contactEmail")} />}
        </Field>
        <Field label="Founded" optional error={errors.foundedYear}>
          {({ id, describedBy, invalid }) => <Input id={id} inputMode="numeric" placeholder="2019" aria-describedby={describedBy} aria-invalid={invalid || undefined} value={values.foundedYear} onChange={set("foundedYear")} />}
        </Field>
      </div>
      <Field label="Location" optional>
        {({ id }) => <Input id={id} maxLength={120} placeholder="Milan, Italy" value={values.location} onChange={set("location")} />}
      </Field>
      <Button className="self-start" loading={save.isPending} onClick={() => save.mutate()}>
        Save brand
      </Button>
    </Card>
  );
}

export function BrandSettingsScreen() {
  const session = useSession();
  const { brand: active, isLoading } = useActiveBrand();
  const brand = useQuery({
    queryKey: queryKeys.brands.detail(active?.id ?? ""),
    queryFn: () => brandsApi.get(active!.id),
    enabled: !!active,
  });
  if (isLoading || brand.isLoading || session.isLoading) return <LoadingState />;
  if (!active || !brand.data) {
    return (
      <PageContainer>
        <EmptyState title="No brand workspace" description="Create a brand to manage its identity." />
      </PageContainer>
    );
  }
  const isOwner = brand.data.ownerId === session.data?.id;
  return (
    <PageContainer>
      <Breadcrumbs items={[{ label: "Profile", href: "/profile" }, { label: "Brand" }]} />
      <PageHeader title="Brand settings" subtitle={brand.data.name} />
      {isOwner ? (
        <div className="flex flex-col gap-6">
          <BrandImages brand={brand.data} />
          <BrandForm key={brand.data.id} brand={brand.data} />
        </div>
      ) : (
        <EmptyState
          title="Only the brand owner can edit its identity"
          description={`You're ${ROLE_COPY[active.role].label.toLowerCase()} of ${brand.data.name}.`}
          action={
            <Link href={`/explore/brands/${brand.data.id}`} className="text-body font-semibold text-accent">
              View brand profile
            </Link>
          }
        />
      )}
    </PageContainer>
  );
}

/* ------------------------------------------------------------ activity */

export function ActivityScreen() {
  const client = useQueryClient();
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const query = useQuery({
    queryKey: queryKeys.notifications({ page, unreadOnly }),
    queryFn: () => notificationsApi.list({ page, limit: 20, unreadOnly: unreadOnly || undefined }),
  });
  const refresh = () => client.invalidateQueries({ queryKey: ["notifications"] });
  const markRead = useMutation({ mutationFn: notificationsApi.markRead, onSuccess: () => void refresh() });
  const markAll = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => {
      toast.success("All caught up");
      void refresh();
    },
    onError: (error) => toast.error("Couldn't update", apiMessage(error)),
  });
  const unread = query.data?.data.some((item) => !item.isRead);

  return (
    <PageContainer>
      <PageHeader
        title="Activity"
        actions={
          <Button size="sm" variant="secondary" disabled={!unread} loading={markAll.isPending} onClick={() => markAll.mutate()}>
            Mark all read
          </Button>
        }
      />
      <div className="mb-4">
        <Checkbox label="Unread only" checked={unreadOnly} onChange={(event) => { setUnreadOnly(event.target.checked); setPage(1); }} />
      </div>
      {query.isLoading ? (
        <SkeletonList count={5} />
      ) : query.isError ? (
        <ErrorState title="Couldn't load activity" onRetry={() => query.refetch()} />
      ) : !query.data?.data.length ? (
        <EmptyState icon={<Bell className="size-5" aria-hidden />} title={unreadOnly ? "No unread notifications" : "No activity yet"} />
      ) : (
        <>
          <Card className="divide-y divide-border">
            {query.data.data.map((item) => (
              <div key={item.id} className={cn("flex gap-3 px-4 py-3.5", !item.isRead && "bg-accent-tint/30")}>
                <span aria-hidden className={cn("mt-2 size-2 shrink-0 rounded-full", item.isRead ? "bg-transparent" : "bg-accent")} />
                <div className="min-w-0 flex-1">
                  <p className="text-body font-semibold text-fg">{item.title}</p>
                  <p className="text-caption text-fg-2">{item.message}</p>
                  <p className="mt-1 text-caption text-faint">{formatRelative(item.createdAt)}</p>
                </div>
                {!item.isRead && (
                  <button type="button" onClick={() => markRead.mutate(item.id)} className="self-start text-caption font-semibold text-muted hover:text-fg">
                    Mark read<span className="sr-only">: {item.title}</span>
                  </button>
                )}
              </div>
            ))}
          </Card>
          <Pagination page={page} limit={20} total={query.data.total} onPageChange={setPage} className="mt-4" />
        </>
      )}
    </PageContainer>
  );
}
