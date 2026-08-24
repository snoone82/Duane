/** One nav list shared by the desktop sidebar and the mobile drawer so the
 * two can never drift apart. */

export const NAV_ITEMS = [
  { href: "/", label: "Dashboard" },
  { href: "/clients", label: "Clients" },
  { href: "/calendar", label: "Calendar" },
  { href: "/actions", label: "Actions" },
  { href: "/sales", label: "Sales" },
  { href: "/search", label: "Search" },
];

export const ADMIN_NAV_ITEMS = [{ href: "/team", label: "Team & access" }];

export function navItemsForRole(role: string) {
  return role === "admin" ? [...NAV_ITEMS, ...ADMIN_NAV_ITEMS] : NAV_ITEMS;
}
