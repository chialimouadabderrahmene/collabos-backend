import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Contract, ContractVersion } from "@/lib/api/contracts";
import type { Deal, Proposal } from "@/lib/api/deals";
import type { PublicDropResult } from "@/lib/api/drops.server";
import type { Order } from "@/lib/api/orders";
import { renderWithClient } from "@/test/render";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/features/auth/hooks", () => ({
  useSession: () => ({ data: { id: "creator-1", email: "c@x.co" }, isLoading: false }),
  useLogout: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@/lib/api/deals", () => ({
  dealsApi: {
    get: vi.fn(),
    proposals: { list: vi.fn(), accept: vi.fn(), reject: vi.fn(), create: vi.fn() },
    milestones: { list: vi.fn().mockResolvedValue([]) },
    responsibilities: { list: vi.fn().mockResolvedValue([]) },
  },
}));
vi.mock("@/lib/api/brands", () => ({
  brandsApi: { get: vi.fn().mockResolvedValue({ id: "b1", ownerId: "owner-1", name: "Void Studio", logoUrl: null }), mine: vi.fn().mockResolvedValue([]) },
}));
vi.mock("@/lib/api/contracts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/contracts")>();
  return {
    ...actual,
    contractsApi: { ...actual.contractsApi, list: vi.fn(), get: vi.fn(), versions: vi.fn(), history: vi.fn().mockResolvedValue([]) },
  };
});
vi.mock("@/lib/api/drops.server", () => ({ fetchPublicDrop: vi.fn() }));

const { dealsApi } = await import("@/lib/api/deals");
const { contractsApi } = await import("@/lib/api/contracts");
const { fetchPublicDrop } = await import("@/lib/api/drops.server");

const deal: Deal = {
  id: "deal-1",
  applicationId: "app-1",
  briefId: "brief-1",
  brandId: "b1",
  creatorId: "creator-1",
  title: "AW27 Capsule",
  status: "NEGOTIATING",
  health: "ON_TRACK",
  totalValue: 14000,
  currency: "EUR",
  revenueSplitBrand: 60,
  revenueSplitCreator: 40,
  startDate: null,
  endDate: null,
  activatedAt: null,
  completedAt: null,
  cancelledAt: null,
  cancelReason: null,
  createdAt: "2026-09-24T00:00:00.000Z",
  updatedAt: "2026-09-24T00:00:00.000Z",
};

const proposal = (overrides: Partial<Proposal>): Proposal => ({
  id: "p",
  dealId: "deal-1",
  proposedById: "owner-1",
  status: "PENDING",
  totalValue: 14000,
  revenueSplitBrand: 60,
  revenueSplitCreator: 40,
  startDate: null,
  endDate: null,
  message: null,
  createdAt: "2026-09-24T00:00:00.000Z",
  respondedAt: null,
  ...overrides,
});

describe("deal negotiation", () => {
  it("offers accept/decline only on the other party's pending proposal", async () => {
    const { DealScreen } = await import("@/features/deals/deal-screen");
    vi.mocked(dealsApi.get).mockResolvedValue(deal);
    vi.mocked(dealsApi.proposals.list).mockResolvedValue([
      proposal({ id: "mine", proposedById: "creator-1", status: "SUPERSEDED" }),
      proposal({ id: "theirs", proposedById: "owner-1" }),
    ]);
    vi.mocked(dealsApi.proposals.accept).mockResolvedValue(proposal({ status: "ACCEPTED" }));
    const user = userEvent.setup();
    renderWithClient(<DealScreen dealId="deal-1" />);

    const accept = await screen.findAllByRole("button", { name: "Accept terms" });
    expect(accept).toHaveLength(1);
    await user.click(accept[0]);
    await waitFor(() => expect(dealsApi.proposals.accept).toHaveBeenCalledWith("deal-1", "theirs"));
  });

  it("shows a waiting state (no accept) on my own pending proposal", async () => {
    const { DealScreen } = await import("@/features/deals/deal-screen");
    vi.mocked(dealsApi.get).mockResolvedValue(deal);
    vi.mocked(dealsApi.proposals.list).mockResolvedValue([proposal({ id: "mine", proposedById: "creator-1" })]);
    renderWithClient(<DealScreen dealId="deal-1" />);
    expect(await screen.findByText("Waiting for the other party to respond.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Accept terms" })).not.toBeInTheDocument();
  });

  it("hides the deal when the backend refuses access", async () => {
    const { DealScreen } = await import("@/features/deals/deal-screen");
    const { ApiError } = await import("@/lib/api/http");
    vi.mocked(dealsApi.get).mockRejectedValue(new ApiError(403, { message: "You do not have access to this deal" }));
    renderWithClient(<DealScreen dealId="deal-1" />);
    expect(await screen.findByText("Deal not found")).toBeInTheDocument();
    expect(dealsApi.proposals.list).not.toHaveBeenCalled();
  });
});

describe("contracts", () => {
  it("renders agreement text as plain text, never HTML", async () => {
    const { ContractScreen } = await import("@/features/contracts/contract-screens");
    const contract: Contract = {
      id: "c1",
      dealId: "deal-1",
      brandId: "b1",
      creatorId: "creator-1",
      status: "AWAITING_SIGNATURE",
      currentVersionNumber: 1,
      executedAt: null,
      voidedAt: null,
      voidReason: null,
      createdAt: "2026-09-24T00:00:00.000Z",
      updatedAt: "2026-09-24T00:00:00.000Z",
    };
    const version: ContractVersion = {
      id: "v1",
      versionNumber: 1,
      content: 'Terms <img src=x onerror="alert(1)"> apply.',
      pdfAvailable: true,
      createdById: "owner-1",
      createdAt: "2026-09-24T00:00:00.000Z",
      signatures: [],
    };
    vi.mocked(contractsApi.get).mockResolvedValue(contract);
    vi.mocked(contractsApi.versions).mockResolvedValue([version]);
    vi.mocked(dealsApi.get).mockResolvedValue(deal);
    renderWithClient(<ContractScreen contractId="c1" />);

    expect(await screen.findByText('Terms <img src=x onerror="alert(1)"> apply.')).toBeInTheDocument();
    expect(document.querySelector("img[onerror]")).toBeNull();
    // Creator hasn't signed yet → can sign; PDF is a same-origin BFF link.
    expect(screen.getByRole("button", { name: "Sign" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /pdf/i })).toHaveAttribute("href", "/api/backend/contracts/c1/versions/1/pdf");
  });
});

describe("payments", () => {
  it("never starts a payment when no Stripe publishable key is configured", async () => {
    const { OrderScreen } = await import("@/features/orders/order-screens");
    const ordersModule = await import("@/lib/api/orders");
    const order: Order = {
      id: "o1",
      buyerId: "creator-1",
      brandId: "b1",
      status: "PENDING_PAYMENT",
      subtotal: 840,
      currency: "EUR",
      items: [{ id: "i1", variantId: "v1", productName: "Crew", sku: "NCC-M", unitPrice: 420, quantity: 2 }],
      cancelledAt: null,
      completedAt: null,
      cancelReason: null,
      createdAt: "2026-09-24T00:00:00.000Z",
      updatedAt: "2026-09-24T00:00:00.000Z",
    };
    const get = vi.spyOn(ordersModule.ordersApi, "get").mockResolvedValue(order);
    vi.spyOn(ordersModule.ordersApi, "shipments").mockResolvedValue([]);
    vi.spyOn(ordersModule.ordersApi, "refunds").mockResolvedValue([]);
    const payments = await import("@/lib/api/payments");
    const forOrder = vi.spyOn(payments.paymentsApi, "forOrder");
    renderWithClient(<OrderScreen orderId="o1" />);

    expect(await screen.findByText("Card payments aren't configured in this environment.")).toBeInTheDocument();
    expect(forOrder).not.toHaveBeenCalled();
    get.mockRestore();
  });
});

describe("public drop page", () => {
  async function renderDrop(result: PublicDropResult) {
    vi.mocked(fetchPublicDrop).mockResolvedValue(result);
    const { default: Page } = await import("@/app/d/[slug]/page");
    render(await Page({ params: Promise.resolve({ slug: "aw27" }) }));
  }

  it("fails closed for private or unpublished drops", async () => {
    await renderDrop({ status: "unavailable" });
    expect(screen.getByText("This drop isn't available")).toBeInTheDocument();
  });

  it("renders published content and drops unsafe CTA links", async () => {
    await renderDrop({
      status: "ok",
      data: {
        drop: {
          id: "d1",
          brandId: "b1",
          dealId: null,
          title: "AW27",
          slug: "aw27",
          description: null,
          status: "PUBLISHED",
          visibility: "UNLISTED",
          publishAt: null,
          publishedAt: "2026-09-24T00:00:00.000Z",
          archivedAt: null,
          createdAt: "2026-09-24T00:00:00.000Z",
          updatedAt: "2026-09-24T00:00:00.000Z",
        },
        page: {
          headline: "Cashmere, reconsidered",
          subheadline: null,
          heroImageUrl: null,
          bodyContent: "<b>not bold</b>",
          ctaLabel: "Shop",
          ctaUrl: "javascript:alert(1)",
        },
        seo: { metaTitle: null, metaDescription: null, ogImageUrl: null, canonicalUrl: null, keywords: [] },
        media: [],
        products: [],
        brand: { id: "b1", name: "Void Studio", logoUrl: null },
      },
    });
    expect(screen.getByRole("heading", { level: 1, name: "Cashmere, reconsidered" })).toBeInTheDocument();
    expect(screen.getByText("<b>not bold</b>")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /shop/i })).not.toBeInTheDocument();
  });

  it("marks unlisted drops noindex", async () => {
    vi.mocked(fetchPublicDrop).mockResolvedValue({
      status: "ok",
      data: {
        drop: { visibility: "UNLISTED", title: "AW27", description: null } as never,
        page: { headline: null, subheadline: null, heroImageUrl: null } as never,
        seo: { metaTitle: null, metaDescription: null, ogImageUrl: null, keywords: [] } as never,
        media: [],
        products: [],
        brand: null,
      },
    });
    const { generateMetadata } = await import("@/app/d/[slug]/page");
    const metadata = await generateMetadata({ params: Promise.resolve({ slug: "aw27" }) });
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
