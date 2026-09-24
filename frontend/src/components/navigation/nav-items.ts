import {
  BarChart3,
  Compass,
  FileSignature,
  Handshake,
  Home,
  type LucideIcon,
  MessageCircle,
  Package,
  Plus,
  Rocket,
  ShoppingBag,
  Sparkles,
  User,
  Wallet,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Extra path prefixes that should mark this item active. */
  match?: string[];
}

/** Primary navigation — the five destinations from the design references. */
export const PRIMARY_NAV: NavItem[] = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/create", label: "Create", icon: Plus, match: ["/opportunities/new"] },
  { href: "/messages", label: "Messages", icon: MessageCircle },
  { href: "/profile", label: "Profile", icon: User, match: ["/settings", "/brand"] },
];

/** Secondary workspace areas: reachable from the desktop rail's "Workspace"
 * group and from Home/Profile on mobile — never crowding the primary bar. */
export const WORKSPACE_NAV: NavItem[] = [
  { href: "/opportunities", label: "Opportunities", icon: Sparkles },
  { href: "/deals", label: "Deals", icon: Handshake, match: ["/proposals"] },
  { href: "/contracts", label: "Contracts", icon: FileSignature },
  { href: "/drops", label: "Drops", icon: Rocket },
  { href: "/products", label: "Products", icon: Package, match: ["/inventory"] },
  { href: "/orders", label: "Orders", icon: ShoppingBag, match: ["/cart", "/checkout"] },
  { href: "/sales", label: "Sales", icon: BarChart3, match: ["/analytics"] },
  { href: "/payouts", label: "Payouts", icon: Wallet },
];

export function isActive(pathname: string, item: NavItem): boolean {
  const prefixes = [item.href, ...(item.match ?? [])];
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
