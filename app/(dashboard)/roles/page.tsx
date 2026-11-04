import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getRoles } from "@/lib/roles";
import { getSessionUser } from "@/lib/session";
import { getUsers } from "@/lib/users";
import { permissionLinks } from "../nav";
import { RolesView } from "./roles-view";

export const metadata: Metadata = {
  title: "Roles",
};

export default async function RolesPage() {
  // Superusers only: the sidebar hides the link from everyone else, and the
  // API refuses their changes, but a typed URL still lands here.
  const user = await getSessionUser();
  if (!user?.isSuperuser) redirect("/overview");

  const [roles, users] = await Promise.all([getRoles(), getUsers()]);

  // One row per sidebar link, so a new link is grantable as soon as it's in nav.ts.
  return <RolesView initialRoles={roles} modules={permissionLinks()} users={users} />;
}
