const ALL_SYSTEMS = Array.from({ length: 48 }, (_, i) => i + 2);

function systemView(n: number) {
  return `system.${n}.view`;
}

export function mapDbRoleToMobile(dbRole: string): string {
  switch (dbRole.toLowerCase()) {
    case "chef": return "headChef";
    case "kitchen": return "lineCook";
    case "manager":
    case "owner": return "kitchenManager";
    case "waiter": return "waiter";
    case "bar": return "beverageChef";
    case "housekeeping": return "housekeeping";
    default: return "lineCook";
  }
}

export function sectionForRole(mobileRole: string): string {
  switch (mobileRole) {
    case "beverageChef": return "Bar";
    case "waiter": return "Floor";
    case "housekeeping": return "Rooms";
    case "tandoorChef": return "Tandoor";
    case "chineseChef": return "Chinese";
    default: return "Main";
  }
}

export function permissionsForRole(mobileRole: string): string[] {
  const systems = defaultSystemsFor(mobileRole);
  const perms = new Set<string>(systems.map(systemView));
  for (const p of actionPermissionsFor(mobileRole)) perms.add(p);
  return [...perms].sort();
}

function defaultSystemsFor(role: string): number[] {
  switch (role) {
    case "headChef":
    case "kitchenManager":
      return ALL_SYSTEMS;
    case "sousChef":
      return [...ALL_SYSTEMS.filter(n => n <= 45), 48, 49];
    case "expeditor":
      return [2, 3, 4, 11, 12, 17, 19, 20, 21, 22, 35, 36];
    case "waiter":
      return [2, 12, 26, 27, 35, 36, 49];
    case "housekeeping":
      return [2, 12, 28, 29, 35, 36];
    case "packingStaff":
      return [3, 4, 20, 21, 22, 35];
    case "lineCook":
      return [2, 3, 4, 5, 6, 7, 9, 15, 16, 17, 33, 34, 35];
    case "tandoorChef":
    case "chineseChef":
      return [2, 3, 4, 5, 6, 7, 9, 15, 16, 35, 33, 34];
    case "beverageChef":
      return [2, 3, 5, 7, 9, 15, 23, 33, 34, 35];
    case "dessertChef":
    case "bakeryChef":
      return [2, 3, 5, 7, 9, 15, 24, 33, 34, 35];
    case "kitchenHelper":
      return [3, 5, 28, 33, 34, 35];
    default:
      return [2, 3, 4, 5, 35];
  }
}

function actionPermissionsFor(role: string): string[] {
  const kitchenOps = ["kds.view", "order.accept", "order.prepare", "order.ready"];
  switch (role) {
    case "headChef":
    case "kitchenManager":
      return [...kitchenOps, "order.reject", "order.reassign", "staff.manage", "staff.command.view", "catalog.view"];
    case "sousChef":
      return [...kitchenOps, "order.reject", "staff.command.view"];
    case "expeditor":
      return [...kitchenOps, "order.reject", "catalog.view"];
    case "waiter":
      return [
        "kds.view",
        "waiter.tasks.view",
        "waiter.delivery.confirm",
        "order.deliver",
        "roomservice.deliver",
        "catalog.view",
      ];
    case "housekeeping":
      return [
        "hygiene.view",
        "housekeeping.tasks.view",
        "housekeeping.tasks.update",
        "maintenance.report",
        "roomservice.deliver",
      ];
    default:
      return kitchenOps;
  }
}

const KITCHEN_ROLES = new Set([
  "headChef", "sousChef", "lineCook", "tandoorChef", "chineseChef",
  "beverageChef", "dessertChef", "bakeryChef", "kitchenHelper",
  "kitchenManager", "expeditor", "packingStaff",
]);

export function assertRoleAllowed(staffRole: string, requestedRole?: string) {
  if (!requestedRole || requestedRole === staffRole) return;
  if (KITCHEN_ROLES.has(requestedRole) && KITCHEN_ROLES.has(staffRole)) return;
  if (requestedRole === "waiter" && staffRole === "waiter") return;
  if (requestedRole === "housekeeping" && staffRole === "housekeeping") return;
  if (requestedRole !== staffRole) {
    throw new Error("ROLE_MISMATCH");
  }
}
