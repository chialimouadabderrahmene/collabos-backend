"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal, ShieldCheck, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Breadcrumbs, PageContainer, PageHeader } from "@/components/navigation/page";
import { Button } from "@/components/ui/button";
import { Avatar, Badge, Card, SectionHeader } from "@/components/ui/display";
import { EmptyState, ErrorState, SkeletonList } from "@/components/ui/feedback";
import { Field, Input, Select } from "@/components/ui/field";
import {
  ConfirmationDialog,
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
  DropdownTrigger,
  Modal,
} from "@/components/ui/overlays";
import { toast } from "@/components/ui/toast";
import { useSession } from "@/features/auth/hooks";
import { brandsApi, type BrandMember, type BrandMemberRole } from "@/lib/api/brands";
import { ApiError } from "@/lib/api/http";
import { queryKeys } from "@/lib/api/query-keys";
import { roleAtLeast, useActiveBrand } from "./workspace";

export const ROLE_COPY: Record<BrandMemberRole, { label: string; description: string }> = {
  OWNER: { label: "Owner", description: "Full control, including admins and billing" },
  ADMIN: { label: "Admin", description: "Manages the team, publishing and sharing" },
  EDITOR: { label: "Editor", description: "Creates and edits Opportunities and drafts" },
  VIEWER: { label: "Viewer", description: "Read-only access to drafts and versions" },
};

const ROLE_ORDER: BrandMemberRole[] = ["OWNER", "ADMIN", "EDITOR", "VIEWER"];

/**
 * Roles the current user may grant — mirrors the backend rule (ADMIN+ manages
 * members; only an OWNER can grant or change OWNER/ADMIN). UX only: every
 * change is still authorized server-side.
 */
export function assignableRoles(actor: BrandMemberRole | undefined): BrandMemberRole[] {
  if (actor === "OWNER") return ROLE_ORDER;
  if (actor === "ADMIN") return ["EDITOR", "VIEWER"];
  return [];
}

export function canManageMember(actor: BrandMemberRole | undefined, member: BrandMember): boolean {
  if (member.isBrandOwner) return false;
  return assignableRoles(actor).includes(member.role);
}

function errorMessage(error: unknown): string | undefined {
  if (!(error instanceof ApiError)) return undefined;
  if (error.isNotFound) return "No CollabOS account uses that email. Ask them to sign up first.";
  if (error.isConflict) return "They're already on this team.";
  return error.message;
}

export function TeamScreen() {
  const router = useRouter();
  const client = useQueryClient();
  const session = useSession();
  const { brand, isLoading: brandLoading } = useActiveBrand();
  const brandId = brand?.id ?? "";
  const canManage = roleAtLeast(brand?.role, "ADMIN");

  const members = useQuery({
    queryKey: queryKeys.brands.members(brandId),
    queryFn: () => brandsApi.members.list(brandId),
    enabled: !!brandId,
  });
  const invalidate = () => client.invalidateQueries({ queryKey: queryKeys.brands.members(brandId) });

  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<BrandMemberRole>("EDITOR");
  const [removing, setRemoving] = useState<BrandMember | null>(null);

  const add = useMutation({
    mutationFn: () => brandsApi.members.add(brandId, { email: email.trim(), role }),
    onSuccess: (member) => {
      toast.success(`${member.displayName ?? member.email} joined as ${ROLE_COPY[member.role].label}`);
      setInviteOpen(false);
      setEmail("");
      void invalidate();
    },
  });

  const updateRole = useMutation({
    mutationFn: ({ userId, next }: { userId: string; next: BrandMemberRole }) =>
      brandsApi.members.updateRole(brandId, userId, next),
    onSuccess: () => {
      toast.success("Role updated");
      void invalidate();
    },
    onError: (error) => toast.error("Couldn't change role", errorMessage(error)),
  });

  const remove = useMutation({
    mutationFn: (userId: string) => brandsApi.members.remove(brandId, userId),
    onSuccess: (_result, userId) => {
      setRemoving(null);
      if (userId === session.data?.id) {
        // Leaving the brand: my workspace list changed.
        toast.success(`You left ${brand?.name ?? "the brand"}`);
        void client.invalidateQueries({ queryKey: queryKeys.brands.mine });
        router.replace("/home");
        return;
      }
      toast.success("Member removed");
      void invalidate();
    },
    onError: (error) => toast.error("Couldn't remove member", errorMessage(error)),
  });

  const roles = assignableRoles(brand?.role);
  const me = session.data?.id;

  if (!brandLoading && !brand) {
    return (
      <PageContainer>
        <EmptyState
          title="No brand workspace yet"
          description="Create your brand to invite a team."
          action={
            <Button onClick={() => router.push("/onboarding")}>Set up brand</Button>
          }
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Breadcrumbs items={[{ label: "Profile", href: "/profile" }, { label: "Team" }]} />
      <PageHeader
        title="Team"
        subtitle={brand ? `Who can work on ${brand.name}` : undefined}
        actions={
          canManage && (
            <Button size="sm" onClick={() => setInviteOpen(true)}>
              <UserPlus className="size-4" aria-hidden /> Add member
            </Button>
          )
        }
      />

      {members.isLoading || brandLoading ? (
        <SkeletonList count={3} />
      ) : members.isError ? (
        <ErrorState title="Couldn't load your team" onRetry={() => members.refetch()} />
      ) : (
        <Card className="divide-y divide-border">
          {(members.data ?? []).map((member) => {
            const isMe = member.userId === me;
            const manageable = canManage && canManageMember(brand?.role, member);
            return (
              <div key={member.userId} className="flex items-center gap-3 px-4 py-3.5">
                <Avatar name={member.displayName ?? member.email} shape="circle" size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body font-semibold text-fg">
                    {member.displayName ?? member.email}
                    {isMe && <span className="ml-1.5 text-caption font-normal text-muted">(you)</span>}
                  </p>
                  {member.displayName && <p className="truncate text-caption text-muted">{member.email}</p>}
                </div>
                <Badge tone={member.role === "OWNER" || member.role === "ADMIN" ? "accent" : "neutral"}>
                  {ROLE_COPY[member.role].label}
                </Badge>
                {(manageable || (isMe && !member.isBrandOwner)) && (
                  <Dropdown>
                    <DropdownTrigger
                      aria-label={`Manage ${member.displayName ?? member.email}`}
                      className="rounded-md p-1.5 text-faint hover:bg-surface-2 hover:text-fg"
                    >
                      <MoreHorizontal className="size-4" aria-hidden />
                    </DropdownTrigger>
                    <DropdownContent align="end" className="w-56">
                      {manageable &&
                        roles
                          .filter((option) => option !== member.role)
                          .map((option) => (
                            <DropdownItem
                              key={option}
                              onSelect={() => updateRole.mutate({ userId: member.userId, next: option })}
                            >
                              Make {ROLE_COPY[option].label}
                            </DropdownItem>
                          ))}
                      {manageable && <DropdownSeparator />}
                      <DropdownItem tone="danger" onSelect={() => setRemoving(member)}>
                        {isMe ? "Leave brand" : "Remove from team"}
                      </DropdownItem>
                    </DropdownContent>
                  </Dropdown>
                )}
              </div>
            );
          })}
        </Card>
      )}

      <section className="mt-8">
        <SectionHeader title="Roles" />
        <Card className="divide-y divide-border">
          {ROLE_ORDER.map((option) => (
            <div key={option} className="flex items-start gap-3 px-4 py-3">
              <ShieldCheck
                className={option === brand?.role ? "mt-0.5 size-4 text-accent" : "mt-0.5 size-4 text-faint"}
                aria-hidden
              />
              <div>
                <p className="text-body font-semibold text-fg">
                  {ROLE_COPY[option].label}
                  {option === brand?.role && <span className="ml-1.5 text-caption font-normal text-accent">Your role</span>}
                </p>
                <p className="text-caption text-muted">{ROLE_COPY[option].description}</p>
              </div>
            </div>
          ))}
        </Card>
      </section>

      <Modal
        open={inviteOpen}
        onOpenChange={(value) => {
          setInviteOpen(value);
          add.reset();
        }}
        title="Add a team member"
        description="They need an existing CollabOS account. They'll get access to every Opportunity in this brand."
        footer={
          <>
            <Button variant="secondary" onClick={() => setInviteOpen(false)}>
              Cancel
            </Button>
            <Button loading={add.isPending} disabled={!email.trim()} onClick={() => add.mutate()}>
              Add member
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Email" error={errorMessage(add.error)}>
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                type="email"
                autoComplete="off"
                value={email}
                placeholder="name@studio.com"
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                onChange={(event) => setEmail(event.target.value)}
              />
            )}
          </Field>
          <Field label="Role">
            {({ id }) => (
              <Select id={id} value={role} onChange={(event) => setRole(event.target.value as BrandMemberRole)}>
                {roles.map((option) => (
                  <option key={option} value={option}>
                    {ROLE_COPY[option].label} — {ROLE_COPY[option].description}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
      </Modal>

      <ConfirmationDialog
        open={!!removing}
        onOpenChange={(value) => !value && setRemoving(null)}
        title={removing?.userId === me ? `Leave ${brand?.name ?? "this brand"}?` : "Remove from team?"}
        description={
          removing?.userId === me
            ? "You'll lose access to this brand's Opportunities until someone adds you back."
            : `${removing?.displayName ?? removing?.email ?? "They"} will lose access to this brand's Opportunities.`
        }
        confirmLabel={removing?.userId === me ? "Leave" : "Remove"}
        tone="danger"
        loading={remove.isPending}
        onConfirm={() => removing && remove.mutate(removing.userId)}
      />
    </PageContainer>
  );
}
