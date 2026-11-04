import type { NavItem } from "@/components/sidebar";
import { canView, type SessionUser } from "@/lib/auth-user";
import type { ModuleOption } from "@/lib/roles";
import { STATUS_MODULES } from "@/lib/status-sections";

/*
 * The dashboard rail, and which links a user's roles show. This list is also
 * what a role can be granted: every link names its permission code, and the
 * Roles page has one row per code (permissionLinks), so adding or removing a
 * link here is all it takes. The API keeps no list of its own.
 *
 * A code is "section" for a link on its own ("tasks") or "section.link" for
 * one under a section ("sold.form"); a section's own list page uses
 * `listModule`. The link's view flag shows it, and its page checks the same
 * flag (lib/access.ts), so a typed URL gets "No access" instead of the API's
 * 403. The link's API checks the same code (module_permission in the
 * backend), so renaming a code means renaming it there too.
 *
 * `ownable` marks a link whose records belong to someone: its Roles row gets
 * View all, and without it a role reaches only its own records there (the
 * API reads through own_only). Leave it off a shared page.
 */

const NAV_ITEMS: NavItem[] = [
  { href: "/overview", label: "Overview", icon: "overview", module: "dashboard" },
  {
    href: "/agents",
    label: "Agents",
    listLabel: "Agent list",
    listIcon: "list",
    icon: "agents",
    listModule: "agents.list",
    ownable: true,
    searchable: true,
    children: [
      // Opens the first agent; stays highlighted on every /agents/<id>, but
      // not on Add agent or Edit agent, which belong to the section.
      {
        href: "/agents/profile",
        label: "Agent profile",
        icon: "profile",
        module: "agents.profile",
        ownable: true,
        activePrefix: "/agents/",
        activeExcept: ["/agents/new", "/edit"],
      },
    ],
  },
  {
    href: "/carriers",
    label: "Carriers",
    listLabel: "Carrier list",
    listIcon: "list",
    icon: "carriers",
    listModule: "carriers.list",
    searchable: true,
    children: [
      // Opens the first carrier; stays highlighted on every /carriers/<id>,
      // but not on Add carrier or Edit carrier, which belong to the section.
      {
        href: "/carriers/profile",
        label: "Carrier profile",
        icon: "profile",
        module: "carriers.profile",
        activePrefix: "/carriers/",
        activeExcept: ["/carriers/new", "/edit"],
      },
    ],
  },
  { href: "/passwords", label: "Passwords", icon: "passwords", module: "passwords", ownable: true, searchable: true },
  {
    href: "/contracts",
    label: "Contracts",
    listLabel: "By state",
    listIcon: "map",
    icon: "contracts",
    listModule: "contracts.by_state",
    ownable: true,
    searchable: true,
    // Contracts itself is the by-state view; by-carriers is the one sub-link.
    children: [
      { href: "/contracts/by-carriers", label: "By carriers", icon: "carriers", module: "contracts.by_carriers", ownable: true },
    ],
  },
  // Sales: the list (one row per product), the form agents submit, and the
  // leaderboard. List is the section href so navbar search scopes the product table.
  {
    href: "/sold/list",
    label: "Sold",
    listLabel: "List",
    listIcon: "list",
    icon: "sold",
    listModule: "sold.list",
    ownable: true,
    searchable: true,
    children: [
      // /sold is the parent of its siblings, so it must not light up on them.
      { href: "/sold", label: "Sold-form", icon: "sold", module: "sold.form", activeExcept: ["/sold/list", "/sold/leaderboard"] },
      { href: "/sold/leaderboard", label: "Leaderboard", icon: "leaderboard", module: "sold.leaderboard" },
    ],
  },
  // Appointment-setter click tracker: the Click panel is where the SDR role
  // logs calls; History is the daily/month view.
  {
    href: "/tracker",
    label: "Tracker",
    listLabel: "Click panel",
    listIcon: "tracker",
    icon: "tracker",
    listModule: "tracker.clicks",
    children: [{ href: "/tracker/history", label: "History", icon: "list", module: "tracker.history", ownable: true }],
  },
  // Requests and the calendar they land on.
  { href: "/hr", label: "Calendar", icon: "hr", module: "requests", ownable: true },
  { href: "/tasks", label: "Tasks", icon: "tasks", module: "tasks", ownable: true },
  // What the shop sells, and the shop itself; orders land on HR.
  {
    href: "/storefront",
    label: "Storefront",
    listLabel: "Products",
    listIcon: "tag",
    icon: "storefront",
    listModule: "storefront.products",
    children: [{ href: "/storefront/shop", label: "Shop", icon: "cart", module: "storefront.shop" }],
  },
  { href: "/users", label: "Users", icon: "users", module: "users", searchable: true },
];

/** Shown after Storefront: records by status, across modules (lib/status-sections.ts). */
const STATUS_ITEMS: NavItem[] = [
  { href: "/pending", label: "Pending", icon: "pending", module: STATUS_MODULES },
  { href: "/archive", label: "Archive", icon: "archive", module: STATUS_MODULES },
];

/** Shown after Users to superusers only: the roles page manages what everyone else may do. */
const ROLES_ITEM: NavItem = { href: "/roles", label: "Roles", icon: "roles", searchable: true };

/** Pinned to the bottom of the rail: the one org record for this shop. */
const FOOTER_ITEMS: NavItem[] = [{ href: "/agency", label: "Agency", icon: "agency", module: "agencies" }];

/** Whether the role can see a link; one without a code (Roles) is added only for those who can. */
function allowed(user: SessionUser, module: NavItem["module"]) {
  if (module == null) return true;
  return (typeof module === "string" ? [module] : module).some((code) => canView(user, code));
}

/**
 * The links the role can see. A section whose list page is off opens on its
 * first sub-link instead, and goes when none is left.
 */
function visible(items: NavItem[], user: SessionUser): NavItem[] {
  return items.flatMap((item): NavItem[] => {
    if (!item.children) return allowed(user, item.module) ? [item] : [];
    const children = item.children.filter((child) => allowed(user, child.module));
    if (allowed(user, item.listModule ?? item.module)) return [{ ...item, children }];
    const [first] = children;
    if (!first) return [];
    // Search sends the query to the list page, so it goes with it.
    return [{ ...item, href: first.href, listLabel: undefined, listIcon: undefined, searchable: false, children }];
  });
}

export function navItemsFor(user: SessionUser): NavItem[] {
  const items = [...NAV_ITEMS];
  items.splice(items.findIndex((item) => item.href === "/users"), 0, ...STATUS_ITEMS);
  return visible(user.isSuperuser ? [...items, ROLES_ITEM] : items, user);
}

export function footerItemsFor(user: SessionUser): NavItem[] {
  return visible(FOOTER_ITEMS, user);
}

/** Where to send a user whose role can't see the Overview: the first link they can. */
export function homeFor(user: SessionUser): string | null {
  return navItemsFor(user)[0]?.href ?? null;
}

/**
 * Every link that names a code of its own, in rail order: the Roles page's
 * rows. Pending and Archive borrow other links' codes and Roles has none, so
 * they are not rows.
 */
export function permissionLinks(): ModuleOption[] {
  const links = new Map<string, ModuleOption>();
  const add = (code: NavItem["module"], label: string, ownable = false) => {
    if (typeof code === "string" && !links.has(code)) links.set(code, { code, label, ownable });
  };
  for (const item of [...NAV_ITEMS, ...FOOTER_ITEMS]) {
    if (!item.children) {
      add(item.module, item.label, item.ownable);
      continue;
    }
    add(item.listModule, `${item.label} / ${item.listLabel ?? item.label}`, item.ownable);
    for (const child of item.children) add(child.module, `${item.label} / ${child.label}`, child.ownable);
  }
  return [...links.values()];
}
