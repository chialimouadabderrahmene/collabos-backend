import type { BadgeTone } from "@/components/ui/display";
import type { ApplicationStatus } from "@/lib/api/applications";
import type { ContractStatus } from "@/lib/api/contracts";
import type { DealHealth, DealStatus, ProposalStatus } from "@/lib/api/deals";

type StatusCopy = { label: string; tone: BadgeTone };

export const DEAL_STATUS: Record<DealStatus, StatusCopy> = {
  NEGOTIATING: { label: "Negotiating", tone: "warning" },
  ACTIVE: { label: "Active deal", tone: "accent" },
  COMPLETED: { label: "Completed", tone: "success" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
};

export const DEAL_HEALTH: Record<DealHealth, StatusCopy> = {
  ON_TRACK: { label: "On track", tone: "success" },
  AT_RISK: { label: "At risk", tone: "warning" },
  OVERDUE: { label: "Overdue", tone: "danger" },
  COMPLETED: { label: "Completed", tone: "success" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
};

export const PROPOSAL_STATUS: Record<ProposalStatus, StatusCopy> = {
  PENDING: { label: "Pending", tone: "warning" },
  ACCEPTED: { label: "Accepted", tone: "accent" },
  REJECTED: { label: "Declined", tone: "danger" },
  SUPERSEDED: { label: "Superseded", tone: "neutral" },
};

export const APPLICATION_STATUS: Record<ApplicationStatus, StatusCopy> = {
  PENDING: { label: "Pending", tone: "warning" },
  ACCEPTED: { label: "Accepted", tone: "accent" },
  REJECTED: { label: "Declined", tone: "danger" },
  WITHDRAWN: { label: "Withdrawn", tone: "neutral" },
};

export const CONTRACT_STATUS: Record<ContractStatus, StatusCopy> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  AWAITING_SIGNATURE: { label: "Awaiting signature", tone: "warning" },
  PARTIALLY_SIGNED: { label: "Partially signed", tone: "info" },
  EXECUTED: { label: "Executed", tone: "accent" },
  VOIDED: { label: "Voided", tone: "danger" },
};

/** Which side of a deal the viewer is on (UX only; the backend decides). */
export function partyOf(deal: { creatorId: string }, userId: string | undefined): "CREATOR" | "BRAND" {
  return deal.creatorId === userId ? "CREATOR" : "BRAND";
}
