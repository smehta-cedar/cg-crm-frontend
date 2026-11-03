import type { Metadata } from "next";
import { NoAccess } from "@/components/no-access";
import { canModule, canViewModule } from "@/lib/access";
import { getProductNotes, getProducts } from "@/lib/storefront";
import { StorefrontView } from "./storefront-view";

export const metadata: Metadata = {
  title: "Storefront",
};

export default async function StorefrontPage() {
  if (!(await canViewModule("storefront.products"))) return <NoAccess title="Storefront" />;
  const products = await getProducts();
  // A handful of products, so one notes read each is fine.
  const notes = (await Promise.all(products.map((product) => getProductNotes(product.id)))).flat();

  const [canCreate, canUpdate] = await Promise.all([
    canModule("storefront.products", "create"),
    canModule("storefront.products", "update"),
  ]);

  return <StorefrontView initialProducts={products} notes={notes} canCreate={canCreate} canUpdate={canUpdate} />;
}
