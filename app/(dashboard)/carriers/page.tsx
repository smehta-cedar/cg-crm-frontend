import type { Metadata } from "next";
import { NoAccess } from "@/components/no-access";
import { canModule, canViewModule } from "@/lib/access";
import { getCarriers } from "@/lib/carriers";
import { CarriersView } from "./carriers-view";

export const metadata: Metadata = {
  title: "Carriers",
};

export default async function CarriersPage() {
  if (!(await canViewModule("carriers.list"))) return <NoAccess title="Carriers" />;
  const [carriers, canCreate, canUpdate] = await Promise.all([
    getCarriers(),
    canModule("carriers", "create"),
    canModule("carriers", "update"),
  ]);

  return <CarriersView carriers={carriers} canCreate={canCreate} canUpdate={canUpdate} />;
}
