import type { ReactNode } from "react";

/** Full-screen, chrome-free workspace for the Studio and previews. */
export default function StudioLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-dvh bg-bg">{children}</div>;
}
