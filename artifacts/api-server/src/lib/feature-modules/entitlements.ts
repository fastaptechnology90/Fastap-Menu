import { eq } from "drizzle-orm";
import { db, platformPlansTable, restaurantsTable } from "@workspace/db";
import {
  FEATURE_MODULES,
  FEATURE_MODULE_BY_NUMBER,
  RESTAURANT_PANEL_PATHS,
  PLAN_RANK,
  planIncludesModule,
  type FeatureModule,
} from "./catalog.js";
import { getSettingsSection, setSettingsSection } from "../restaurant-settings.js";

export type FeatureEntitlementStore = {
  /** Super-admin overrides: true = force on, false = force off, undefined = inherit plan. */
  adminOverrides?: Record<string, boolean>;
  /** Restaurant toggles: false = disable locally (cannot enable beyond admin/plan). */
  restaurantToggles?: Record<string, boolean>;
};

export interface ResolvedFeatureModule extends FeatureModule {
  enabled: boolean;
  source: "plan" | "admin" | "restaurant" | "linked";
  /** True when disabled because a linked prerequisite is off. */
  blockedBy?: number[];
}

function moduleKey(number: number): string {
  return `system_${number}`;
}

async function loadEntitlementStore(restaurantId: number): Promise<FeatureEntitlementStore> {
  return getSettingsSection<FeatureEntitlementStore>(restaurantId, "featureEntitlements", {});
}

async function saveEntitlementStore(
  restaurantId: number,
  store: FeatureEntitlementStore,
): Promise<void> {
  await setSettingsSection(restaurantId, "featureEntitlements", store);
}

async function getRestaurantPlan(restaurantId: number): Promise<string> {
  const [row] = await db
    .select({ plan: restaurantsTable.plan })
    .from(restaurantsTable)
    .where(eq(restaurantsTable.id, restaurantId))
    .limit(1);
  return row?.plan ?? "free";
}

function isEnabledByPlan(plan: string, mod: FeatureModule): boolean {
  return planIncludesModule(plan, mod.minPlan);
}

function resolveModuleEnabled(
  mod: FeatureModule,
  plan: string,
  store: FeatureEntitlementStore,
): { enabled: boolean; source: ResolvedFeatureModule["source"] } {
  const key = moduleKey(mod.number);
  const admin = store.adminOverrides?.[key];
  if (admin === false) return { enabled: false, source: "admin" };
  if (admin === true) return { enabled: true, source: "admin" };

  const planDefault = isEnabledByPlan(plan, mod);
  if (!planDefault) return { enabled: false, source: "plan" };

  const restaurant = store.restaurantToggles?.[key];
  if (restaurant === false) return { enabled: false, source: "restaurant" };

  return { enabled: true, source: "plan" };
}

/** Resolve effective entitlements with linked-system enforcement. */
export async function resolveFeatureEntitlements(
  restaurantId: number,
): Promise<{
  plan: string;
  modules: ResolvedFeatureModule[];
  enabledSystemNumbers: number[];
  enabledRestaurantPaths: string[];
}> {
  const plan = await getRestaurantPlan(restaurantId);
  const store = await loadEntitlementStore(restaurantId);

  const base = FEATURE_MODULES.map((mod) => {
    const { enabled, source } = resolveModuleEnabled(mod, plan, store);
    return { ...mod, enabled, source, blockedBy: [] as number[] };
  });

  const enabledMap = new Map(base.map((m) => [m.number, m.enabled]));

  // Disable modules whose hard prerequisites are off (multi-pass for chains).
  let changed = true;
  while (changed) {
    changed = false;
    for (const mod of base) {
      if (!mod.enabled || !mod.requiresSystems?.length) continue;
      const blocked = mod.requiresSystems.filter((n) => !enabledMap.get(n));
      if (blocked.length > 0) {
        mod.enabled = false;
        mod.blockedBy = blocked;
        mod.source = "linked";
        enabledMap.set(mod.number, false);
        changed = true;
      }
    }
  }

  const enabledSystemNumbers = base
    .filter((m) => m.enabled && m.number >= 2)
    .map((m) => m.number);

  const pathSet = new Set<string>();
  for (const mod of base) {
    if (!mod.enabled || !mod.restaurantPaths) continue;
    for (const p of mod.restaurantPaths) pathSet.add(p);
  }
  // Paid plans unlock the full restaurant panel sidebar (RBAC still applies per role).
  if ((PLAN_RANK[plan] ?? 0) >= PLAN_RANK.starter) {
    for (const p of RESTAURANT_PANEL_PATHS) pathSet.add(p);
  }
  // Always allow core settings paths
  pathSet.add("/restaurant/settings");

  return {
    plan,
    modules: base,
    enabledSystemNumbers,
    enabledRestaurantPaths: [...pathSet].sort(),
  };
}

export async function getEnabledSystemNumbers(restaurantId: number): Promise<number[]> {
  const { enabledSystemNumbers } = await resolveFeatureEntitlements(restaurantId);
  return enabledSystemNumbers;
}

export function isSystemEnabled(
  enabledSystems: number[],
  systemNumber: number,
): boolean {
  if (systemNumber === 1) return true;
  return enabledSystems.includes(systemNumber);
}

export async function getAdminFeatureControls(restaurantId: number) {
  const resolved = await resolveFeatureEntitlements(restaurantId);
  const store = await loadEntitlementStore(restaurantId);
  return {
    plan: resolved.plan,
    adminOverrides: store.adminOverrides ?? {},
    modules: resolved.modules.map((m) => ({
      number: m.number,
      key: m.key,
      title: m.title,
      category: m.category,
      minPlan: m.minPlan,
      linkedSystems: m.linkedSystems,
      enabled: m.enabled,
      source: m.source,
      blockedBy: m.blockedBy,
      adminOverride: store.adminOverrides?.[m.key] ?? null,
    })),
  };
}

export async function setAdminFeatureOverrides(
  restaurantId: number,
  overrides: Record<string, boolean>,
) {
  const store = await loadEntitlementStore(restaurantId);
  const plan = await getRestaurantPlan(restaurantId);
  const next = { ...(store.adminOverrides ?? {}) };

  for (const [key, value] of Object.entries(overrides)) {
    const num = parseInt(key.replace("system_", ""), 10);
    const mod = FEATURE_MODULE_BY_NUMBER.get(num);
    if (!mod) continue;
    const planDefault = isEnabledByPlan(plan, mod);
    if (value === planDefault) {
      delete next[key];
    } else {
      next[key] = value;
    }
  }

  store.adminOverrides = Object.keys(next).length > 0 ? next : undefined;
  await saveEntitlementStore(restaurantId, store);
  return getAdminFeatureControls(restaurantId);
}

export async function getRestaurantFeatureControls(restaurantId: number) {
  const resolved = await resolveFeatureEntitlements(restaurantId);
  const plan = await getRestaurantPlan(restaurantId);
  const store = await loadEntitlementStore(restaurantId);
  return {
    plan: resolved.plan,
    restaurantToggles: store.restaurantToggles ?? {},
    enabledRestaurantPaths: resolved.enabledRestaurantPaths,
    modules: resolved.modules.map((m) => {
      const planLevel = resolveModuleEnabled(m, plan, {
        ...store,
        restaurantToggles: {},
      });
      return {
        number: m.number,
        key: m.key,
        title: m.title,
        category: m.category,
        linkedSystems: m.linkedSystems,
        enabled: m.enabled,
        source: m.source,
        blockedBy: m.blockedBy,
        canToggle:
          planLevel.enabled || store.adminOverrides?.[m.key] === true,
        restaurantToggle: store.restaurantToggles?.[m.key] ?? null,
        restaurantPaths: m.restaurantPaths ?? [],
      };
    }),
  };
}

export async function setRestaurantFeatureToggles(
  restaurantId: number,
  toggles: Record<string, boolean>,
) {
  const store = await loadEntitlementStore(restaurantId);
  const plan = await getRestaurantPlan(restaurantId);
  const merged = { ...(store.restaurantToggles ?? {}) };

  for (const [key, value] of Object.entries(toggles)) {
    const num = parseInt(key.replace("system_", ""), 10);
    const mod = FEATURE_MODULE_BY_NUMBER.get(num);
    if (!mod) continue;
    // Restaurants may only disable modules allowed by plan/admin — not force-enable.
    if (value === true) {
      delete merged[key];
      continue;
    }
    const { enabled } = resolveModuleEnabled(mod, plan, store);
    if (enabled || store.adminOverrides?.[key] === true) {
      merged[key] = false;
    }
  }

  store.restaurantToggles = merged;
  await saveEntitlementStore(restaurantId, store);
  return getRestaurantFeatureControls(restaurantId);
}

/** Sync plan feature toggles from platform_plans when plan changes. */
export async function syncPlanKitchenEntitlements(restaurantId: number, planId: string) {
  const [planRow] = await db
    .select()
    .from(platformPlansTable)
    .where(eq(platformPlansTable.id, planId))
    .limit(1);
  if (!planRow?.featureToggles) return;
  const toggles = planRow.featureToggles as Record<string, boolean>;
  if (toggles.kitchenApp === false) {
    const store = await loadEntitlementStore(restaurantId);
    store.adminOverrides = {
      ...(store.adminOverrides ?? {}),
      ...Object.fromEntries(
        FEATURE_MODULES.filter((m) => m.number >= 2).map((m) => [m.key, false]),
      ),
    };
    await saveEntitlementStore(restaurantId, store);
  }
}

export function filterPermissionsByEntitlements(
  permissions: string[],
  enabledSystems: number[],
): string[] {
  const enabled = new Set(enabledSystems);
  return permissions.filter((perm) => {
    const match = perm.match(/^system\.(\d+)\.view$/);
    if (!match) return true;
    const num = parseInt(match[1], 10);
    if (num === 1) return true;
    return enabled.has(num);
  });
}

export function mobileFeaturesPayload(
  restaurantId: number,
  enabledSystems: number[],
  plan: string,
) {
  return {
    restaurantId,
    plan,
    enabledSystems,
    modules: FEATURE_MODULES.filter((m) => enabledSystems.includes(m.number)).map((m) => ({
      number: m.number,
      key: m.key,
      title: m.title,
      category: m.category,
      linkedSystems: m.linkedSystems.filter((n) => enabledSystems.includes(n)),
      apiPath: m.apiPath ?? null,
    })),
    workflowLinks: FEATURE_MODULES.filter((m) => enabledSystems.includes(m.number))
      .flatMap((m) =>
        m.linkedSystems
          .filter((n) => enabledSystems.includes(n))
          .map((n) => ({
            from: m.number,
            to: n,
            label: FEATURE_MODULE_BY_NUMBER.get(n)?.title ?? `System ${n}`,
          })),
      ),
  };
}
