import type { Metadata } from "next";
import { ProductScreen } from "@/features/products/product-screens";

export const metadata: Metadata = { title: "Product" };

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProductScreen key={id} productId={id} />;
}
