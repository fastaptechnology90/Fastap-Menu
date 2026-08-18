class MultiBranchSnapshot {
  const MultiBranchSnapshot({
    required this.section,
    required this.lastSyncedAt,
    required this.centralKitchens,
    required this.recipeSyncJobs,
    required this.branchKitchens,
    required this.sharedInventory,
    required this.demandForecasts,
    required this.stats,
    required this.multiBranchFeatures,
    required this.sections,
  });

  final String section;
  final DateTime lastSyncedAt;
  final List<CentralKitchenHub> centralKitchens;
  final List<RecipeSyncJob> recipeSyncJobs;
  final List<BranchKitchenNode> branchKitchens;
  final List<SharedInventoryItem> sharedInventory;
  final List<DemandForecast> demandForecasts;
  final MultiBranchStats stats;
  final MultiBranchFeatureFlags multiBranchFeatures;
  final List<String> sections;

  factory MultiBranchSnapshot.fromJson(Map<String, dynamic> json) {
    return MultiBranchSnapshot(
      section: json['section'] as String? ?? 'All',
      lastSyncedAt: DateTime.parse(json['lastSyncedAt'] as String),
      centralKitchens: (json['centralKitchens'] as List<dynamic>)
          .map(
            (item) => CentralKitchenHub.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      recipeSyncJobs: (json['recipeSyncJobs'] as List<dynamic>)
          .map((item) => RecipeSyncJob.fromJson(item as Map<String, dynamic>))
          .toList(),
      branchKitchens: (json['branchKitchens'] as List<dynamic>)
          .map(
            (item) => BranchKitchenNode.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      sharedInventory: (json['sharedInventory'] as List<dynamic>)
          .map(
            (item) => SharedInventoryItem.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      demandForecasts: (json['demandForecasts'] as List<dynamic>)
          .map((item) => DemandForecast.fromJson(item as Map<String, dynamic>))
          .toList(),
      stats: MultiBranchStats.fromJson(json['stats'] as Map<String, dynamic>),
      multiBranchFeatures: MultiBranchFeatureFlags.fromJson(
        json['multiBranchFeatures'] as Map<String, dynamic>,
      ),
      sections: (json['sections'] as List<dynamic>)
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class CentralKitchenHub {
  const CentralKitchenHub({
    required this.id,
    required this.hubName,
    required this.section,
    required this.branchesServed,
    required this.productionLoad,
    required this.status,
    required this.availableActions,
  });

  final String id;
  final String hubName;
  final String section;
  final int branchesServed;
  final int productionLoad;
  final String status;
  final List<String> availableActions;

  factory CentralKitchenHub.fromJson(Map<String, dynamic> json) {
    return CentralKitchenHub(
      id: json['id'] as String,
      hubName: json['hubName'] as String,
      section: json['section'] as String,
      branchesServed: json['branchesServed'] as int? ?? 0,
      productionLoad: json['productionLoad'] as int? ?? 0,
      status: json['status'] as String? ?? 'idle',
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class RecipeSyncJob {
  const RecipeSyncJob({
    required this.id,
    required this.recipePack,
    required this.targetBranch,
    required this.section,
    required this.version,
    required this.status,
    required this.availableActions,
  });

  final String id;
  final String recipePack;
  final String targetBranch;
  final String section;
  final String version;
  final String status;
  final List<String> availableActions;

  factory RecipeSyncJob.fromJson(Map<String, dynamic> json) {
    return RecipeSyncJob(
      id: json['id'] as String,
      recipePack: json['recipePack'] as String,
      targetBranch: json['targetBranch'] as String,
      section: json['section'] as String,
      version: json['version'] as String? ?? 'v1.0',
      status: json['status'] as String? ?? 'pending',
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class BranchKitchenNode {
  const BranchKitchenNode({
    required this.id,
    required this.branchName,
    required this.section,
    required this.syncLagMinutes,
    required this.ordersToday,
    required this.status,
    required this.availableActions,
  });

  final String id;
  final String branchName;
  final String section;
  final int syncLagMinutes;
  final int ordersToday;
  final String status;
  final List<String> availableActions;

  factory BranchKitchenNode.fromJson(Map<String, dynamic> json) {
    return BranchKitchenNode(
      id: json['id'] as String,
      branchName: json['branchName'] as String,
      section: json['section'] as String,
      syncLagMinutes: json['syncLagMinutes'] as int? ?? 0,
      ordersToday: json['ordersToday'] as int? ?? 0,
      status: json['status'] as String? ?? 'synced',
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class SharedInventoryItem {
  const SharedInventoryItem({
    required this.id,
    required this.itemName,
    required this.section,
    required this.centralStock,
    required this.branchesLow,
    required this.status,
    required this.availableActions,
  });

  final String id;
  final String itemName;
  final String section;
  final String centralStock;
  final int branchesLow;
  final String status;
  final List<String> availableActions;

  factory SharedInventoryItem.fromJson(Map<String, dynamic> json) {
    return SharedInventoryItem(
      id: json['id'] as String,
      itemName: json['itemName'] as String,
      section: json['section'] as String,
      centralStock: json['centralStock'] as String? ?? '0',
      branchesLow: json['branchesLow'] as int? ?? 0,
      status: json['status'] as String? ?? 'ok',
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class DemandForecast {
  const DemandForecast({
    required this.id,
    required this.forecastName,
    required this.section,
    required this.expectedChange,
    required this.confidence,
    required this.windowLabel,
    required this.status,
    required this.availableActions,
  });

  final String id;
  final String forecastName;
  final String section;
  final String expectedChange;
  final String confidence;
  final String windowLabel;
  final String status;
  final List<String> availableActions;

  factory DemandForecast.fromJson(Map<String, dynamic> json) {
    return DemandForecast(
      id: json['id'] as String,
      forecastName: json['forecastName'] as String,
      section: json['section'] as String,
      expectedChange: json['expectedChange'] as String? ?? '0%',
      confidence: json['confidence'] as String? ?? 'medium',
      windowLabel: json['windowLabel'] as String? ?? 'This week',
      status: json['status'] as String? ?? 'draft',
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class MultiBranchStats {
  const MultiBranchStats({
    required this.activeCentralHubs,
    required this.pendingRecipeSyncs,
    required this.branchesOutOfSync,
    required this.lowStockItems,
    required this.publishedForecasts,
    required this.syncedToday,
  });

  final int activeCentralHubs;
  final int pendingRecipeSyncs;
  final int branchesOutOfSync;
  final int lowStockItems;
  final int publishedForecasts;
  final int syncedToday;

  factory MultiBranchStats.fromJson(Map<String, dynamic> json) {
    return MultiBranchStats(
      activeCentralHubs: json['activeCentralHubs'] as int? ?? 0,
      pendingRecipeSyncs: json['pendingRecipeSyncs'] as int? ?? 0,
      branchesOutOfSync: json['branchesOutOfSync'] as int? ?? 0,
      lowStockItems: json['lowStockItems'] as int? ?? 0,
      publishedForecasts: json['publishedForecasts'] as int? ?? 0,
      syncedToday: json['syncedToday'] as int? ?? 0,
    );
  }
}

class MultiBranchFeatureFlags {
  const MultiBranchFeatureFlags({
    required this.centralKitchenSupport,
    required this.recipeSynchronization,
    required this.branchKitchenSync,
    required this.sharedInventoryVisibility,
    required this.demandForecasting,
  });

  final bool centralKitchenSupport;
  final bool recipeSynchronization;
  final bool branchKitchenSync;
  final bool sharedInventoryVisibility;
  final bool demandForecasting;

  factory MultiBranchFeatureFlags.fromJson(Map<String, dynamic> json) {
    return MultiBranchFeatureFlags(
      centralKitchenSupport: json['centralKitchenSupport'] as bool? ?? false,
      recipeSynchronization: json['recipeSynchronization'] as bool? ?? false,
      branchKitchenSync: json['branchKitchenSync'] as bool? ?? false,
      sharedInventoryVisibility:
          json['sharedInventoryVisibility'] as bool? ?? false,
      demandForecasting: json['demandForecasting'] as bool? ?? false,
    );
  }
}

class MultiBranchActionResult {
  const MultiBranchActionResult({
    required this.success,
    required this.message,
  });

  final bool success;
  final String message;

  factory MultiBranchActionResult.fromJson(Map<String, dynamic> json) {
    return MultiBranchActionResult(
      success: json['success'] as bool? ?? false,
      message: json['message'] as String? ?? 'Multi-branch action applied',
    );
  }
}
