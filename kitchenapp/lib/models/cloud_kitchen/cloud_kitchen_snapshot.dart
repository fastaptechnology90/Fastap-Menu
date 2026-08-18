class CloudKitchenSnapshot {
  const CloudKitchenSnapshot({
    required this.section,
    required this.lastSyncedAt,
    required this.brandLanes,
    required this.brandOrders,
    required this.deliveryQueue,
    required this.loadBalance,
    required this.sharedInventory,
    required this.stats,
    required this.cloudKitchenFeatures,
    required this.sections,
  });

  final String section;
  final DateTime lastSyncedAt;
  final List<BrandLane> brandLanes;
  final List<BrandOrder> brandOrders;
  final List<DeliveryOrderEntry> deliveryQueue;
  final List<LoadBalanceSlot> loadBalance;
  final List<SharedInventoryItem> sharedInventory;
  final CloudKitchenStats stats;
  final CloudKitchenFeatureFlags cloudKitchenFeatures;
  final List<String> sections;

  factory CloudKitchenSnapshot.fromJson(Map<String, dynamic> json) {
    return CloudKitchenSnapshot(
      section: json['section'] as String? ?? 'All',
      lastSyncedAt: DateTime.parse(json['lastSyncedAt'] as String),
      brandLanes: (json['brandLanes'] as List<dynamic>)
          .map((item) => BrandLane.fromJson(item as Map<String, dynamic>))
          .toList(),
      brandOrders: (json['brandOrders'] as List<dynamic>)
          .map((item) => BrandOrder.fromJson(item as Map<String, dynamic>))
          .toList(),
      deliveryQueue: (json['deliveryQueue'] as List<dynamic>)
          .map(
            (item) =>
                DeliveryOrderEntry.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      loadBalance: (json['loadBalance'] as List<dynamic>)
          .map((item) => LoadBalanceSlot.fromJson(item as Map<String, dynamic>))
          .toList(),
      sharedInventory: (json['sharedInventory'] as List<dynamic>)
          .map(
            (item) =>
                SharedInventoryItem.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      stats: CloudKitchenStats.fromJson(json['stats'] as Map<String, dynamic>),
      cloudKitchenFeatures: CloudKitchenFeatureFlags.fromJson(
        json['cloudKitchenFeatures'] as Map<String, dynamic>,
      ),
      sections: (json['sections'] as List<dynamic>)
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class BrandLane {
  const BrandLane({
    required this.id,
    required this.brandName,
    required this.cuisine,
    required this.activeOrders,
    required this.loadPercent,
    required this.status,
    required this.colorTag,
  });

  final String id;
  final String brandName;
  final String cuisine;
  final int activeOrders;
  final int loadPercent;
  final String status;
  final String colorTag;

  factory BrandLane.fromJson(Map<String, dynamic> json) {
    return BrandLane(
      id: json['id'] as String,
      brandName: json['brandName'] as String,
      cuisine: json['cuisine'] as String? ?? '',
      activeOrders: json['activeOrders'] as int? ?? 0,
      loadPercent: json['loadPercent'] as int? ?? 0,
      status: json['status'] as String? ?? 'active',
      colorTag: json['colorTag'] as String? ?? 'primary',
    );
  }
}

class BrandOrder {
  const BrandOrder({
    required this.id,
    required this.orderId,
    required this.kotNumber,
    required this.brandName,
    required this.brandId,
    required this.section,
    required this.channel,
    required this.itemSummary,
    required this.deliveryType,
    required this.status,
    required this.timerSeconds,
    required this.timerLabel,
    required this.availableActions,
  });

  final String id;
  final String orderId;
  final String kotNumber;
  final String brandName;
  final String brandId;
  final String section;
  final String channel;
  final String itemSummary;
  final String deliveryType;
  final String status;
  final int timerSeconds;
  final String timerLabel;
  final List<String> availableActions;

  factory BrandOrder.fromJson(Map<String, dynamic> json) {
    return BrandOrder(
      id: json['id'] as String,
      orderId: json['orderId'] as String,
      kotNumber: json['kotNumber'] as String,
      brandName: json['brandName'] as String,
      brandId: json['brandId'] as String? ?? '',
      section: json['section'] as String? ?? 'All',
      channel: json['channel'] as String? ?? 'Direct',
      itemSummary: json['itemSummary'] as String? ?? '',
      deliveryType: json['deliveryType'] as String? ?? 'Delivery',
      status: json['status'] as String? ?? 'queued',
      timerSeconds: json['timerSeconds'] as int? ?? 0,
      timerLabel: json['timerLabel'] as String? ?? '00:00',
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class DeliveryOrderEntry {
  const DeliveryOrderEntry({
    required this.id,
    required this.orderId,
    required this.kotNumber,
    required this.brandName,
    required this.platform,
    required this.riderEtaMinutes,
    required this.status,
    required this.priority,
  });

  final String id;
  final String orderId;
  final String kotNumber;
  final String brandName;
  final String platform;
  final int riderEtaMinutes;
  final String status;
  final String priority;

  factory DeliveryOrderEntry.fromJson(Map<String, dynamic> json) {
    return DeliveryOrderEntry(
      id: json['id'] as String,
      orderId: json['orderId'] as String,
      kotNumber: json['kotNumber'] as String,
      brandName: json['brandName'] as String,
      platform: json['platform'] as String? ?? 'Direct',
      riderEtaMinutes: json['riderEtaMinutes'] as int? ?? 0,
      status: json['status'] as String? ?? 'pending',
      priority: json['priority'] as String? ?? 'normal',
    );
  }
}

class LoadBalanceSlot {
  const LoadBalanceSlot({
    required this.section,
    required this.brandName,
    required this.queueDepth,
    required this.capacity,
    required this.recommendation,
  });

  final String section;
  final String brandName;
  final int queueDepth;
  final int capacity;
  final String recommendation;

  factory LoadBalanceSlot.fromJson(Map<String, dynamic> json) {
    return LoadBalanceSlot(
      section: json['section'] as String,
      brandName: json['brandName'] as String? ?? 'Shared',
      queueDepth: json['queueDepth'] as int? ?? 0,
      capacity: json['capacity'] as int? ?? 10,
      recommendation: json['recommendation'] as String? ?? 'stable',
    );
  }
}

class SharedInventoryItem {
  const SharedInventoryItem({
    required this.id,
    required this.itemName,
    required this.quantity,
    required this.unit,
    required this.sharedByBrands,
    required this.stockLevel,
  });

  final String id;
  final String itemName;
  final double quantity;
  final String unit;
  final List<String> sharedByBrands;
  final String stockLevel;

  factory SharedInventoryItem.fromJson(Map<String, dynamic> json) {
    return SharedInventoryItem(
      id: json['id'] as String,
      itemName: json['itemName'] as String,
      quantity: (json['quantity'] as num?)?.toDouble() ?? 0,
      unit: json['unit'] as String? ?? 'kg',
      sharedByBrands: (json['sharedByBrands'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
      stockLevel: json['stockLevel'] as String? ?? 'ok',
    );
  }
}

class CloudKitchenStats {
  const CloudKitchenStats({
    required this.activeBrands,
    required this.totalOrders,
    required this.deliveryPending,
    required this.overloadedLanes,
    required this.sharedItems,
    required this.completedToday,
  });

  final int activeBrands;
  final int totalOrders;
  final int deliveryPending;
  final int overloadedLanes;
  final int sharedItems;
  final int completedToday;

  factory CloudKitchenStats.fromJson(Map<String, dynamic> json) {
    return CloudKitchenStats(
      activeBrands: json['activeBrands'] as int? ?? 0,
      totalOrders: json['totalOrders'] as int? ?? 0,
      deliveryPending: json['deliveryPending'] as int? ?? 0,
      overloadedLanes: json['overloadedLanes'] as int? ?? 0,
      sharedItems: json['sharedItems'] as int? ?? 0,
      completedToday: json['completedToday'] as int? ?? 0,
    );
  }
}

class CloudKitchenFeatureFlags {
  const CloudKitchenFeatureFlags({
    required this.multiBrandOrderManagement,
    required this.brandWiseSegregation,
    required this.deliveryOrderHandling,
    required this.kitchenLoadBalancing,
    required this.sharedInventoryVisibility,
  });

  final bool multiBrandOrderManagement;
  final bool brandWiseSegregation;
  final bool deliveryOrderHandling;
  final bool kitchenLoadBalancing;
  final bool sharedInventoryVisibility;

  factory CloudKitchenFeatureFlags.fromJson(Map<String, dynamic> json) {
    return CloudKitchenFeatureFlags(
      multiBrandOrderManagement:
          json['multiBrandOrderManagement'] as bool? ?? false,
      brandWiseSegregation: json['brandWiseSegregation'] as bool? ?? false,
      deliveryOrderHandling: json['deliveryOrderHandling'] as bool? ?? false,
      kitchenLoadBalancing: json['kitchenLoadBalancing'] as bool? ?? false,
      sharedInventoryVisibility:
          json['sharedInventoryVisibility'] as bool? ?? false,
    );
  }
}

class CloudKitchenActionResult {
  const CloudKitchenActionResult({
    required this.success,
    required this.message,
  });

  final bool success;
  final String message;

  factory CloudKitchenActionResult.fromJson(Map<String, dynamic> json) {
    return CloudKitchenActionResult(
      success: json['success'] as bool? ?? false,
      message: json['message'] as String? ?? 'Cloud kitchen action applied',
    );
  }
}
