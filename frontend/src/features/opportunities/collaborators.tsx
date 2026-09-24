"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, Badge, Card } from "@/components/ui/display";
import { EmptyState, ErrorState, SkeletonList } from "@/components/ui/feedback";
import { Field, Input, Select } from "@/components/ui/field";
import { Modal } from "@/components/ui/overlays";
import { toast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/http";
import { opportunitiesApi, type OpportunityMemberRole } from "@/lib/api/opportunities";
import { queryKeys } from "@/lib/api/query-keys";

/** Per-opportunity collaborators (external designers, ateliers…). */
export function Collaborators({ opportunityId, canManage }: { opportunityId: string; canManage: boolean }) {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<OpportunityMemberRole>("VIEWER");
  const members = useQuery({
    queryKey: queryKeys.opportunities.members(opportunityId),
    queryFn: () => opportunitiesApi.members.list(opportunityId),
  });
  const invalidate = () => client.invalidateQueries({ queryKey: queryKeys.opportunities.members(opportunityId) });

  const add = useMutation({
    mutationFn: () => opportunitiesApi.members.add(opportunityId, { email: email.trim(), role }),
    onSuccess: () => {
      toast.success("Collaborator added");
      setOpen(false);
      setEmail("");
      void invalidate();
    },
  });
  const remove = useMutation({
    mutationFn: (userId: string) => opportunitiesApi.members.remove(opportunityId, userId),
    onSuccess: () => void invalidate(),
    onError: (error) => toast.error("Couldn't remove", error instanceof ApiError ? error.message : undefined),
  });

  const addError = add.error instanceof ApiError
    ? add.error.isNotFound
      ? "No CollabOS account uses that email."
      : add.error.message
    : undefined;

  return (
    <div>
      {members.isLoading ? (
        <SkeletonList count={2} />
      ) : members.isError ? (
        <ErrorState title="Couldn't load collaborators" onRetry={() => members.refetch()} />
      ) : members.data && members.data.length > 0 ? (
        <Card className="divide-y divide-border">
          {members.data.map((member) => (
            <div key={member.userId} className="flex items-center gap-3 px-4 py-3">
              <Avatar name={member.displayName ?? member.email} shape="circle" size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-body font-semibold text-fg">{member.displayName ?? member.email}</p>
                {member.displayName && <p className="truncate text-caption text-muted">{member.email}</p>}
              </div>
              <Badge tone={member.role === "EDITOR" ? "accent" : "neutral"}>{member.role}</Badge>
              {canManage && (
                <button
                  type="button"
                  aria-label={`Remove ${member.email}`}
                  onClick={() => remove.mutate(member.userId)}
                  className="rounded-md p-1.5 text-faint hover:bg-surface-2 hover:text-danger"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
          ))}
        </Card>
      ) : (
        <EmptyState title="No external collaborators" description="Your brand team already has access." />
      )}
      {canManage && (
        <Button variant="secondary" size="sm" className="mt-3" onClick={() => setOpen(true)}>
          <UserPlus className="size-4" aria-hidden /> Add collaborator
        </Button>
      )}
      <Modal
        open={open}
        onOpenChange={(value) => {
          setOpen(value);
          add.reset();
        }}
        title="Add a collaborator"
        description="Give someone outside your brand team access to this Opportunity only."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button loading={add.isPending} disabled={!email.trim()} onClick={() => add.mutate()}>
              Add
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Email" error={addError}>
            {({ id, describedBy, invalid }) => (
              <Input id={id} type="email" value={email} placeholder="designer@studio.com" aria-describedby={describedBy} aria-invalid={invalid || undefined} onChange={(event) => setEmail(event.target.value)} />
            )}
          </Field>
          <Field label="Access">
            {({ id }) => (
              <Select id={id} value={role} onChange={(event) => setRole(event.target.value as OpportunityMemberRole)}>
                <option value="VIEWER">Viewer — can view drafts and versions</option>
                <option value="EDITOR">Editor — can edit the draft</option>
              </Select>
            )}
          </Field>
        </div>
      </Modal>
    </div>
  );
}
