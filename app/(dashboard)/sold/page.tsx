import type { Metadata } from "next";
import Link from "next/link";
import { GHOST_BUTTON_CLASS } from "@/components/classes";
import { NoAccess } from "@/components/no-access";
import { SaleForm } from "@/components/sold/SaleForm";
import { canModule, canViewModule } from "@/lib/access";
import { getSessionUser } from "@/lib/session";
import { getSoldOptions } from "@/lib/sold/data";

export const metadata: Metadata = {
  title: "Sold",
};

/**
 * Submit a sale. The API offers the products, carriers and lists, checks
 * every answer and files the sale under the signed-in user. Needs the
 * Sold-form add box; the list lives at /sold/list.
 */
export default async function SoldPage() {
  if (!(await canModule("sold.form", "create"))) return <NoAccess title="Sold" />;
  const [options, user, canList] = await Promise.all([getSoldOptions(), getSessionUser(), canViewModule("sold.list")]);
  return (
    <SaleForm
      me={{ email: user?.email ?? "" }}
      options={options}
      afterSubmit={
        canList ? (
          <Link href="/sold/list" className={GHOST_BUTTON_CLASS}>
            Sold list
          </Link>
        ) : null
      }
    />
  );
}
