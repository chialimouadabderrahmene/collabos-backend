import type { Metadata } from "next";
import { ProductsList } from "@/features/products/product-screens";

export const metadata: Metadata = { title: "Products" };

export default function ProductsPage() {
  return <ProductsList />;
}
