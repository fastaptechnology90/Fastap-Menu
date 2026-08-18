#!/usr/bin/env node
/**
 * Sync feature module catalog from api-server catalog.ts to:
 * - shared/feature-modules.catalog.json
 * - kitchenapp/lib/data/generated/feature_module_catalog.g.dart
 * - kitchenapp/lib/data/enterprise_feature_catalog.dart (title lines only)
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const catalogTs = join(
  root,
  "artifacts/api-server/src/lib/feature-modules/catalog.ts",
);
const sharedJsonPath = join(root, "shared/feature-modules.catalog.json");
const generatedDartPath = join(
  root,
  "kitchenapp/lib/data/generated/feature_module_catalog.g.dart",
);
const enterpriseCatalogPath = join(
  root,
  "kitchenapp/lib/data/enterprise_feature_catalog.dart",
);

function unescapeString(value) {
  return value.replace(/\\"/g, '"').replace(/\\\\/g, "\\");
}

function parseStringArray(source, key) {
  const match = source.match(new RegExp(`${key}:\\s*\\[([^\\]]*)\\]`));
  if (!match) return [];
  return [...match[1].matchAll(/"((?:\\.|[^"\\])*)"/g)].map((hit) =>
    unescapeString(hit[1]),
  );
}

function parseNumberArray(source, key) {
  const match = source.match(new RegExp(`${key}:\\s*\\[([^\\]]*)\\]`));
  if (!match) return [];
  return [...match[1].matchAll(/\d+/g)].map((hit) => Number(hit[0]));
}

function parseStringValue(source, key) {
  const match = source.match(
    new RegExp(`${key}:\\s*"((?:\\\\.|[^"\\\\])*)"`),
  );
  return match ? unescapeString(match[1]) : undefined;
}

function parseCatalogFromTs(source) {
  const modules = [];
  const modRe =
    /mod\(\s*(\d+)\s*,\s*"((?:\\.|[^"\\])*)"\s*,\s*"((?:\\.|[^"\\])*)"\s*,\s*\{([\s\S]*?)\}\s*\),/g;

  for (const match of source.matchAll(modRe)) {
    const number = Number(match[1]);
    const title = unescapeString(match[2]);
    const category = unescapeString(match[3]);
    const opts = match[4];

    modules.push({
      number,
      key: `system_${number}`,
      title,
      category,
      surfaces: parseStringArray(opts, "surfaces").length
        ? parseStringArray(opts, "surfaces")
        : ["mobile"],
      apiPath: parseStringValue(opts, "apiPath") ?? null,
      restaurantPaths: parseStringArray(opts, "restaurantPaths"),
      linkedSystems: parseNumberArray(opts, "linkedSystems"),
      requiresSystems: parseNumberArray(opts, "requiresSystems"),
      minPlan: parseStringValue(opts, "minPlan") ?? "starter",
    });
  }

  if (modules.length !== 49) {
    throw new Error(`Expected 49 modules, parsed ${modules.length}`);
  }

  return {
    version: 1,
    systemCount: modules.length,
    modules,
  };
}

function dartString(value) {
  return `'${String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

function dartList(values, indent = "    ") {
  if (!values?.length) return "const []";
  const inner = values.map((value) => `${indent}  ${value},`).join("\n");
  return `const [\n${inner}\n${indent}]`;
}

function dartStringList(values, indent = "    ") {
  return dartList(values.map((value) => dartString(value)), indent);
}

function dartIntList(values, indent = "    ") {
  return dartList(values, indent);
}

function generateDart(payload) {
  const modules = payload.modules
    .map((mod) => {
      const apiPath = mod.apiPath ? `apiPath: ${dartString(mod.apiPath)},` : "";
      const restaurantPaths =
        mod.restaurantPaths?.length > 0
          ? `restaurantPaths: ${dartStringList(mod.restaurantPaths)},`
          : "";
      const requiresSystems =
        mod.requiresSystems?.length > 0
          ? `requiresSystems: ${dartIntList(mod.requiresSystems)},`
          : "";

      return `    FeatureModuleMeta(
      number: ${mod.number},
      key: ${dartString(mod.key)},
      title: ${dartString(mod.title)},
      category: ${dartString(mod.category)},
      surfaces: ${dartStringList(mod.surfaces)},
      ${apiPath}
      ${restaurantPaths}
      linkedSystems: ${dartIntList(mod.linkedSystems)},
      ${requiresSystems}
      minPlan: FeaturePlanTier.${mod.minPlan},
    ),`;
    })
    .join("\n");

  return `// GENERATED FILE — DO NOT EDIT BY HAND.
// Source: artifacts/api-server/src/lib/feature-modules/catalog.ts
// Run: pnpm catalog:sync

enum FeaturePlanTier {
  free,
  starter,
  pro,
  enterprise;

  static FeaturePlanTier parse(String value) {
    return FeaturePlanTier.values.firstWhere(
      (tier) => tier.name == value,
      orElse: () => FeaturePlanTier.starter,
    );
  }
}

class FeatureModuleMeta {
  const FeatureModuleMeta({
    required this.number,
    required this.key,
    required this.title,
    required this.category,
    required this.surfaces,
    this.apiPath,
    this.restaurantPaths = const [],
    this.linkedSystems = const [],
    this.requiresSystems = const [],
    required this.minPlan,
  });

  final int number;
  final String key;
  final String title;
  final String category;
  final List<String> surfaces;
  final String? apiPath;
  final List<String> restaurantPaths;
  final List<int> linkedSystems;
  final List<int> requiresSystems;
  final FeaturePlanTier minPlan;
}

class FeatureModuleCatalog {
  const FeatureModuleCatalog._();

  static const int version = ${payload.version};
  static const int systemCount = ${payload.systemCount};

  static const List<FeatureModuleMeta> modules = [
${modules}
  ];

  static final Map<int, FeatureModuleMeta> _byNumber = {
    for (final module in modules) module.number: module,
  };

  static FeatureModuleMeta? tryModule(int number) => _byNumber[number];

  static FeatureModuleMeta module(int number) {
    final hit = tryModule(number);
    if (hit == null) {
      throw StateError('Unknown feature module #$number');
    }
    return hit;
  }

  static String titleFor(int number) => module(number).title;

  static String? apiPathFor(int number) => module(number).apiPath;

  static List<int> linkedSystemsFor(int number) => module(number).linkedSystems;

  static List<int> requiresSystemsFor(int number) =>
      module(number).requiresSystems;

  static bool planIncludes(String plan, FeaturePlanTier minPlan) {
    const ranks = {
      FeaturePlanTier.free: 0,
      FeaturePlanTier.starter: 1,
      FeaturePlanTier.pro: 2,
      FeaturePlanTier.enterprise: 3,
    };
    final planRank = ranks[FeaturePlanTier.parse(plan)] ?? 0;
    final minRank = ranks[minPlan] ?? 0;
    return planRank >= minRank;
  }
}
`;
}

function patchEnterpriseCatalogTitles(modules) {
  let content = readFileSync(enterpriseCatalogPath, "utf8");
  let patched = 0;

  for (const mod of modules) {
    const escapedTitle = mod.title.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
    const pattern = new RegExp(
      `(number:\\s*${mod.number},[\\s\\S]*?title:\\s*)'(?:[^'\\\\]|\\\\.)*'`,
      "m",
    );
    const next = content.replace(pattern, `$1'${escapedTitle}'`);
    if (next !== content) {
      content = next;
      patched += 1;
    }
  }

  if (patched > 0) {
    writeFileSync(enterpriseCatalogPath, content, "utf8");
  }
}

function main() {
  const payload = parseCatalogFromTs(readFileSync(catalogTs, "utf8"));

  mkdirSync(dirname(sharedJsonPath), { recursive: true });
  mkdirSync(dirname(generatedDartPath), { recursive: true });

  writeFileSync(sharedJsonPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  writeFileSync(generatedDartPath, generateDart(payload), "utf8");
  patchEnterpriseCatalogTitles(payload.modules);

  console.log(
    `Synced ${payload.systemCount} feature modules -> shared JSON + Dart generated catalog`,
  );
}

main();
