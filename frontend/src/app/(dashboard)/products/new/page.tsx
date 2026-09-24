import type { Metadata } from "next";
import { NewProductForm } from "@/features/products/product-screens";

export const metadata: Metadata = { title: "New product" };

export default function NewProductPage() {
  return <NewProductForm />;
}
