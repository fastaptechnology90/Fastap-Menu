// GENERATED FILE — DO NOT EDIT BY HAND.
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

  static const int version = 1;
  static const int systemCount = 49;

  static const List<FeatureModuleMeta> modules = [
    FeatureModuleMeta(
      number: 1,
      key: 'system_1',
      title: 'Authentication & Security System',
      category: 'Core',
      surfaces: const [
      'mobile',
      'restaurant',
    ],
      
      restaurantPaths: const [
      '/restaurant/rbac',
      '/restaurant/settings',
    ],
      linkedSystems: const [
      2,
    ],
      
      minPlan: FeaturePlanTier.free,
    ),
    FeatureModuleMeta(
      number: 2,
      key: 'system_2',
      title: 'Kitchen Dashboard System',
      category: 'Operations',
      surfaces: const [
      'mobile',
    ],
      apiPath: '/dashboard',
      restaurantPaths: const [
      '/restaurant/dashboard',
    ],
      linkedSystems: const [
      3,
      5,
      36,
    ],
      
      minPlan: FeaturePlanTier.free,
    ),
    FeatureModuleMeta(
      number: 3,
      key: 'system_3',
      title: 'Live KDS (Kitchen Display System)',
      category: 'Operations',
      surfaces: const [
      'mobile',
    ],
      apiPath: '/kds',
      restaurantPaths: const [
      '/restaurant/kitchen',
    ],
      linkedSystems: const [
      2,
      5,
      12,
      18,
      21,
    ],
      requiresSystems: const [
      5,
    ],
      minPlan: FeaturePlanTier.free,
    ),
    FeatureModuleMeta(
      number: 4,
      key: 'system_4',
      title: 'Multi Kitchen Section Management',
      category: 'Operations',
      surfaces: const [
      'mobile',
    ],
      apiPath: '/sections/overview',
      
      linkedSystems: const [
      2,
      3,
      5,
    ],
      
      minPlan: FeaturePlanTier.starter,
    ),
    FeatureModuleMeta(
      number: 5,
      key: 'system_5',
      title: 'Advanced Order Processing System',
      category: 'Operations',
      surfaces: const [
      'mobile',
    ],
      apiPath: '/orders/processing',
      restaurantPaths: const [
      '/restaurant/orders',
    ],
      linkedSystems: const [
      3,
      12,
      21,
      22,
      49,
    ],
      
      minPlan: FeaturePlanTier.free,
    ),
    FeatureModuleMeta(
      number: 6,
      key: 'system_6',
      title: 'Food Firing & Course Management',
      category: 'Kitchen',
      surfaces: const [
      'mobile',
    ],
      apiPath: '/course-firing/sessions',
      
      linkedSystems: const [
      5,
      7,
    ],
      
      minPlan: FeaturePlanTier.starter,
    ),
    FeatureModuleMeta(
      number: 7,
      key: 'system_7',
      title: 'Food Preparation Management',
      category: 'Kitchen',
      surfaces: const [
      'mobile',
    ],
      apiPath: '/prep/board',
      
      linkedSystems: const [
      5,
      6,
      16,
    ],
      
      minPlan: FeaturePlanTier.starter,
    ),
    FeatureModuleMeta(
      number: 8,
      key: 'system_8',
      title: 'Modifier & Customization Management',
      category: 'Kitchen',
      surfaces: const [
      'mobile',
    ],
      apiPath: '/modifiers/board',
      
      linkedSystems: const [
      5,
      9,
    ],
      
      minPlan: FeaturePlanTier.starter,
    ),
    FeatureModuleMeta(
      number: 9,
      key: 'system_9',
      title: 'Food Allergy & Safety Engine',
      category: 'Safety',
      surfaces: const [
      'mobile',
    ],
      apiPath: '/allergy-safety/board',
      
      linkedSystems: const [
      5,
      8,
    ],
      
      minPlan: FeaturePlanTier.starter,
    ),
    FeatureModuleMeta(
      number: 10,
      key: 'system_10',
      title: 'Chef Task Management System',
      category: 'Staff',
      surfaces: const [
      'mobile',
    ],
      apiPath: '/chef-tasks/board',
      restaurantPaths: const [
      '/restaurant/tasks-sop',
    ],
      linkedSystems: const [
      7,
      33,
    ],
      
      minPlan: FeaturePlanTier.starter,
    ),
    FeatureModuleMeta(
      number: 11,
      key: 'system_11',
      title: 'AI Kitchen Assistant',
      category: 'AI',
      surfaces: const [
      'mobile',
    ],
      apiPath: '/ai/assistant',
      restaurantPaths: const [
      '/restaurant/ai-features',
    ],
      linkedSystems: const [
      2,
      5,
      48,
    ],
      
      minPlan: FeaturePlanTier.pro,
    ),
    FeatureModuleMeta(
      number: 12,
      key: 'system_12',
      title: 'Order Priority Engine',
      category: 'Operations',
      surfaces: const [
      'mobile',
    ],
      apiPath: '/order-priority/board',
      
      linkedSystems: const [
      3,
      5,
      18,
    ],
      
      minPlan: FeaturePlanTier.starter,
    ),
    FeatureModuleMeta(
      number: 13,
      key: 'system_13',
      title: 'Kitchen Communication System',
      category: 'Communication',
      surfaces: const [
      'mobile',
    ],
      apiPath: '/kitchen-communication/board',
      restaurantPaths: const [
      '/restaurant/communications',
    ],
      linkedSystems: const [
      3,
      36,
    ],
      
      minPlan: FeaturePlanTier.starter,
    ),
    FeatureModuleMeta(
      number: 14,
      key: 'system_14',
      title: 'Inventory & Stock Integration',
      category: 'Inventory',
      surfaces: const [
      'mobile',
    ],
      apiPath: '/inventory/board',
      restaurantPaths: const [
      '/restaurant/inventory',
    ],
      linkedSystems: const [
      15,
      16,
      30,
    ],
      
      minPlan: FeaturePlanTier.starter,
    ),
    FeatureModuleMeta(
      number: 15,
      key: 'system_15',
      title: 'Recipe & Food Costing System',
      category: 'Inventory',
      surfaces: const [
      'mobile',
    ],
      apiPath: '/recipe-costing/board',
      restaurantPaths: const [
      '/restaurant/food-costing',
    ],
      linkedSystems: const [
      14,
      16,
    ],
      
      minPlan: FeaturePlanTier.starter,
    ),
    FeatureModuleMeta(
      number: 16,
      key: 'system_16',
      title: 'Prep Station Management System',
      category: 'Kitchen',
      surfaces: const [
      'mobile',
    ],
      apiPath: '/prep-stations/board',
      
      linkedSystems: const [
      7,
      14,
      15,
    ],
      
      minPlan: FeaturePlanTier.starter,
    ),
    FeatureModuleMeta(
      number: 17,
      key: 'system_17',
      title: 'Advanced Batch Cooking System',
      category: 'Kitchen',
      surfaces: const [
      'mobile',
    ],
      apiPath: '/batch-cooking/board',
      
      linkedSystems: const [
      7,
      16,
    ],
      
      minPlan: FeaturePlanTier.pro,
    ),
    FeatureModuleMeta(
      number: 18,
      key: 'system_18',
      title: 'Delay & Escalation System',
      category: 'Alerts',
      surfaces: const [
      'mobile',
    ],
      apiPath: '/delay-escalation/board',
      
      linkedSystems: const [
      3,
      12,
      36,
    ],
      
      minPlan: FeaturePlanTier.starter,
    ),
    FeatureModuleMeta(
      number: 19,
      key: 'system_19',
      title: 'Quality Control System',
      category: 'Quality',
      surfaces: const [
      'mobile',
    ],
      apiPath: '/quality-control/board',
      
      linkedSystems: const [
      5,
      20,
    ],
      
      minPlan: FeaturePlanTier.pro,
    ),
    FeatureModuleMeta(
      number: 20,
      key: 'system_20',
      title: 'Customer Return & Re-fire System',
      category: 'Operations',
      surfaces: const [
      'mobile',
    ],
      apiPath: '/customer-return/board',
      
      linkedSystems: const [
      3,
      19,
    ],
      
      minPlan: FeaturePlanTier.pro,
    ),
    FeatureModuleMeta(
      number: 21,
      key: 'system_21',
      title: 'Expeditor Management System',
      category: 'Operations',
      surfaces: const [
      'mobile',
    ],
      apiPath: '/expeditor/board',
      
      linkedSystems: const [
      3,
      5,
      22,
    ],
      requiresSystems: const [
      3,
      5,
    ],
      minPlan: FeaturePlanTier.pro,
    ),
    FeatureModuleMeta(
      number: 22,
      key: 'system_22',
      title: 'Packing & Delivery Preparation System',
      category: 'Operations',
      surfaces: const [
      'mobile',
    ],
      apiPath: '/packing/board',
      
      linkedSystems: const [
      21,
      23,
      49,
    ],
      requiresSystems: const [
      21,
    ],
      minPlan: FeaturePlanTier.pro,
    ),
    FeatureModuleMeta(
      number: 23,
      key: 'system_23',
      title: 'Delivery Aggregator System',
      category: 'Delivery',
      surfaces: const [
      'mobile',
    ],
      apiPath: '/delivery-aggregator/board',
      restaurantPaths: const [
      '/restaurant/aggregators',
    ],
      linkedSystems: const [
      22,
    ],
      requiresSystems: const [
      22,
    ],
      minPlan: FeaturePlanTier.pro,
    ),
    FeatureModuleMeta(
      number: 24,
      key: 'system_24',
      title: 'Bar & Beverage Kitchen System',
      category: 'Specialty',
      surfaces: const [
      'mobile',
    ],
      apiPath: '/bar-beverage/board',
      restaurantPaths: const [
      '/restaurant/spa-bar',
    ],
      linkedSystems: const [
      5,
    ],
      
      minPlan: FeaturePlanTier.pro,
    ),
    FeatureModuleMeta(
      number: 25,
      key: 'system_25',
      title: 'Bakery & Dessert Management',
      category: 'Specialty',
      surfaces: const [
      'mobile',
    ],
      apiPath: '/bakery-dessert/board',
      
      linkedSystems: const [
      5,
      7,
    ],
      
      minPlan: FeaturePlanTier.pro,
    ),
    FeatureModuleMeta(
      number: 26,
      key: 'system_26',
      title: 'Cloud Kitchen Management',
      category: 'Enterprise',
      surfaces: const [
      'mobile',
    ],
      apiPath: '/cloud-kitchen/board',
      
      linkedSystems: const [
      43,
    ],
      
      minPlan: FeaturePlanTier.enterprise,
    ),
    FeatureModuleMeta(
      number: 27,
      key: 'system_27',
      title: 'Event & Banquet Kitchen System',
      category: 'Events',
      surfaces: const [
      'mobile',
    ],
      apiPath: '/banquet/board',
      restaurantPaths: const [
      '/restaurant/events',
    ],
      linkedSystems: const [
      5,
      28,
    ],
      
      minPlan: FeaturePlanTier.pro,
    ),
    FeatureModuleMeta(
      number: 28,
      key: 'system_28',
      title: 'Room Service Kitchen System',
      category: 'Hotel',
      surfaces: const [
      'mobile',
    ],
      apiPath: '/room-service/board',
      restaurantPaths: const [
      '/restaurant/room-service',
    ],
      linkedSystems: const [
      5,
      27,
    ],
      
      minPlan: FeaturePlanTier.pro,
    ),
    FeatureModuleMeta(
      number: 29,
      key: 'system_29',
      title: 'Cleaning & Hygiene Management',
      category: 'Compliance',
      surfaces: const [
      'mobile',
    ],
      apiPath: '/cleaning-hygiene/board',
      restaurantPaths: const [
      '/restaurant/housekeeping',
    ],
      linkedSystems: const [
      44,
    ],
      
      minPlan: FeaturePlanTier.pro,
    ),
    FeatureModuleMeta(
      number: 30,
      key: 'system_30',
      title: 'Equipment Management System',
      category: 'IoT',
      surfaces: const [
      'mobile',
    ],
      apiPath: '/equipment/board',
      restaurantPaths: const [
      '/restaurant/documents',
    ],
      linkedSystems: const [
      14,
      31,
      32,
    ],
      
      minPlan: FeaturePlanTier.pro,
    ),
    FeatureModuleMeta(
      number: 31,
      key: 'system_31',
      title: 'Smart Energy & Gas Monitoring',
      category: 'IoT',
      surfaces: const [
      'mobile',
    ],
      apiPath: '/smart-energy/board',
      
      linkedSystems: const [
      30,
      32,
    ],
      
      minPlan: FeaturePlanTier.enterprise,
    ),
    FeatureModuleMeta(
      number: 32,
      key: 'system_32',
      title: 'IoT Device Integration System',
      category: 'IoT',
      surfaces: const [
      'mobile',
    ],
      apiPath: '/iot-devices/board',
      
      linkedSystems: const [
      30,
      31,
      41,
    ],
      
      minPlan: FeaturePlanTier.enterprise,
    ),
    FeatureModuleMeta(
      number: 33,
      key: 'system_33',
      title: 'Staff Performance System',
      category: 'Staff',
      surfaces: const [
      'mobile',
    ],
      apiPath: '/staff-performance/board',
      restaurantPaths: const [
      '/restaurant/staff',
    ],
      linkedSystems: const [
      10,
      34,
      35,
    ],
      
      minPlan: FeaturePlanTier.pro,
    ),
    FeatureModuleMeta(
      number: 34,
      key: 'system_34',
      title: 'Staff Shift Management',
      category: 'Staff',
      surfaces: const [
      'mobile',
    ],
      apiPath: '/staff-shift/board',
      restaurantPaths: const [
      '/restaurant/staff',
    ],
      linkedSystems: const [
      33,
      35,
    ],
      
      minPlan: FeaturePlanTier.pro,
    ),
    FeatureModuleMeta(
      number: 35,
      key: 'system_35',
      title: 'Staff Fatigue & Wellness AI',
      category: 'Staff',
      surfaces: const [
      'mobile',
    ],
      apiPath: '/staff-wellness/board',
      
      linkedSystems: const [
      33,
      34,
    ],
      
      minPlan: FeaturePlanTier.enterprise,
    ),
    FeatureModuleMeta(
      number: 36,
      key: 'system_36',
      title: 'Live Alert Engine',
      category: 'Alerts',
      surfaces: const [
      'mobile',
    ],
      apiPath: '/live-alerts/board',
      restaurantPaths: const [
      '/restaurant/notifications',
    ],
      linkedSystems: const [
      2,
      3,
      18,
      37,
    ],
      
      minPlan: FeaturePlanTier.free,
    ),
    FeatureModuleMeta(
      number: 37,
      key: 'system_37',
      title: 'Panic & Emergency System',
      category: 'Safety',
      surfaces: const [
      'mobile',
    ],
      apiPath: '/panic-emergency/board',
      
      linkedSystems: const [
      36,
    ],
      
      minPlan: FeaturePlanTier.pro,
    ),
    FeatureModuleMeta(
      number: 38,
      key: 'system_38',
      title: 'Offline Mode & Failover System',
      category: 'Technology',
      surfaces: const [
      'mobile',
    ],
      apiPath: '/offline-failover/board',
      restaurantPaths: const [
      '/restaurant/offline',
    ],
      linkedSystems: const [
      45,
    ],
      
      minPlan: FeaturePlanTier.enterprise,
    ),
    FeatureModuleMeta(
      number: 39,
      key: 'system_39',
      title: 'Analytics & Reporting System',
      category: 'Reports',
      surfaces: const [
      'mobile',
    ],
      apiPath: '/analytics-reporting/board',
      restaurantPaths: const [
      '/restaurant/analytics',
    ],
      linkedSystems: const [
      2,
      40,
    ],
      
      minPlan: FeaturePlanTier.pro,
    ),
    FeatureModuleMeta(
      number: 40,
      key: 'system_40',
      title: 'Live Kitchen Heatmap System',
      category: 'Reports',
      surfaces: const [
      'mobile',
    ],
      apiPath: '/kitchen-heatmap/board',
      
      linkedSystems: const [
      2,
      39,
    ],
      
      minPlan: FeaturePlanTier.enterprise,
    ),
    FeatureModuleMeta(
      number: 41,
      key: 'system_41',
      title: 'Hardware Integration System',
      category: 'Technology',
      surfaces: const [
      'mobile',
    ],
      apiPath: '/hardware-integration/board',
      restaurantPaths: const [
      '/restaurant/documents',
      '/restaurant/digital-signage',
    ],
      linkedSystems: const [
      32,
    ],
      
      minPlan: FeaturePlanTier.pro,
    ),
    FeatureModuleMeta(
      number: 42,
      key: 'system_42',
      title: 'Smartwatch Support',
      category: 'Technology',
      surfaces: const [
      'mobile',
    ],
      apiPath: '/smartwatch-support/board',
      
      linkedSystems: const [
      3,
      36,
    ],
      
      minPlan: FeaturePlanTier.enterprise,
    ),
    FeatureModuleMeta(
      number: 43,
      key: 'system_43',
      title: 'Multi Branch & Central Kitchen System',
      category: 'Enterprise',
      surfaces: const [
      'mobile',
    ],
      apiPath: '/multi-branch/board',
      restaurantPaths: const [
      '/restaurant/branches',
    ],
      linkedSystems: const [
      26,
    ],
      
      minPlan: FeaturePlanTier.enterprise,
    ),
    FeatureModuleMeta(
      number: 44,
      key: 'system_44',
      title: 'Audit & Compliance System',
      category: 'Compliance',
      surfaces: const [
      'mobile',
    ],
      apiPath: '/audit-compliance/board',
      restaurantPaths: const [
      '/restaurant/audit',
    ],
      linkedSystems: const [
      29,
    ],
      
      minPlan: FeaturePlanTier.enterprise,
    ),
    FeatureModuleMeta(
      number: 45,
      key: 'system_45',
      title: 'Backup & Recovery System',
      category: 'Technology',
      surfaces: const [
      'mobile',
    ],
      apiPath: '/backup-recovery/board',
      restaurantPaths: const [
      '/restaurant/backup',
    ],
      linkedSystems: const [
      38,
    ],
      
      minPlan: FeaturePlanTier.enterprise,
    ),
    FeatureModuleMeta(
      number: 46,
      key: 'system_46',
      title: 'Sandbox & Training Mode',
      category: 'Training',
      surfaces: const [
      'mobile',
    ],
      apiPath: '/sandbox-training/board',
      restaurantPaths: const [
      '/restaurant/sandbox',
    ],
      linkedSystems: const [
      1,
    ],
      
      minPlan: FeaturePlanTier.enterprise,
    ),
    FeatureModuleMeta(
      number: 47,
      key: 'system_47',
      title: 'Hidden Enterprise Features',
      category: 'Enterprise',
      surfaces: const [
      'mobile',
    ],
      apiPath: '/hidden-enterprise/board',
      
      linkedSystems: const [],
      
      minPlan: FeaturePlanTier.enterprise,
    ),
    FeatureModuleMeta(
      number: 48,
      key: 'system_48',
      title: 'Future AI Expansion Features',
      category: 'AI',
      surfaces: const [
      'mobile',
    ],
      apiPath: '/future-ai-expansion/board',
      restaurantPaths: const [
      '/restaurant/ai-features',
    ],
      linkedSystems: const [
      11,
    ],
      
      minPlan: FeaturePlanTier.enterprise,
    ),
    FeatureModuleMeta(
      number: 49,
      key: 'system_49',
      title: 'Waiter Auto Assignment System',
      category: 'Operations',
      surfaces: const [
      'mobile',
    ],
      apiPath: '/waiter-auto-assignment/board',
      restaurantPaths: const [
      '/restaurant/waiter',
      '/restaurant/queue',
    ],
      linkedSystems: const [
      5,
      22,
    ],
      requiresSystems: const [
      5,
    ],
      minPlan: FeaturePlanTier.starter,
    ),
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
