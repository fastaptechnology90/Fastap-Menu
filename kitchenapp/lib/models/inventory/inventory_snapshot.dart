class InventorySnapshot {
  const InventorySnapshot({
    required this.section,
    required this.lastSyncedAt,
    required this.items,
    required this.batches,
    required this.alerts,
    required this.substitutions,
    required this.deductions,
    required this.shortagePredictions,
    required this.stats,
    required this.inventoryFeatures,
    required this.sections,
  });

  final String section;
  final DateTime lastSyncedAt;
  final List<InventoryItem> items;
  final List<InventoryBatch> batches;
  final List<InventoryAlert> alerts;
  final List<IngredientSubstitution> substitutions;
  final List<InventoryDeduction> deductions;
  final List<ShortagePrediction> shortagePredictions;
  final InventoryStats stats;
  final InventoryFeatureFlags inventoryFeatures;
  final List<String> sections;

  factory InventorySnapshot.fromJson(Map<String, dynamic> json) {
    return InventorySnapshot(
      section: json['section'] as String? ?? 'All',
      lastSyncedAt: DateTime.parse(json['lastSyncedAt'] as String),
      items: (json['items'] as List<dynamic>)
          .map((item) => InventoryItem.fromJson(item as Map<String, dynamic>))
          .toList(),
      batches: (json['batches'] as List<dynamic>)
          .map((item) => InventoryBatch.fromJson(item as Map<String, dynamic>))
          .toList(),
      alerts: (json['alerts'] as List<dynamic>)
          .map((item) => InventoryAlert.fromJson(item as Map<String, dynamic>))
          .toList(),
      substitutions: (json['substitutions'] as List<dynamic>)
          .map(
            (item) =>
                IngredientSubstitution.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      deductions: (json['deductions'] as List<dynamic>)
          .map(
            (item) => InventoryDeduction.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      shortagePredictions: (json['shortagePredictions'] as List<dynamic>)
          .map(
            (item) =>
                ShortagePrediction.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      stats: InventoryStats.fromJson(json['stats'] as Map<String, dynamic>),
      inventoryFeatures: InventoryFeatureFlags.fromJson(
        json['inventoryFeatures'] as Map<String, dynamic>,
      ),
      sections: (json['sections'] as List<dynamic>)
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class InventoryItem {
  const InventoryItem({
    required this.id,
    required this.name,
    required this.section,
    required this.unit,
    required this.onHand,
    required this.reserved,
    required this.minLevel,
    required this.batchId,
    required this.expiryDays,
    required this.deductedToday,
    required this.status,
  });

  final String id;
  final String name;
  final String section;
  final String unit;
  final double onHand;
  final double reserved;
  final double minLevel;
  final String batchId;
  final int expiryDays;
  final double deductedToday;
  final String status;

  factory InventoryItem.fromJson(Map<String, dynamic> json) {
    return InventoryItem(
      id: json['id'] as String,
      name: json['name'] as String,
      section: json['section'] as String,
      unit: json['unit'] as String,
      onHand: (json['onHand'] as num).toDouble(),
      reserved: (json['reserved'] as num?)?.toDouble() ?? 0,
      minLevel: (json['minLevel'] as num).toDouble(),
      batchId: json['batchId'] as String,
      expiryDays: json['expiryDays'] as int,
      deductedToday: (json['deductedToday'] as num?)?.toDouble() ?? 0,
      status: json['status'] as String,
    );
  }
}

class InventoryBatch {
  const InventoryBatch({
    required this.id,
    required this.itemId,
    required this.itemName,
    required this.section,
    required this.quantity,
    required this.unit,
    required this.expiryAt,
    required this.expiryDays,
    required this.status,
  });

  final String id;
  final String itemId;
  final String itemName;
  final String section;
  final double quantity;
  final String unit;
  final DateTime expiryAt;
  final int expiryDays;
  final String status;

  factory InventoryBatch.fromJson(Map<String, dynamic> json) {
    return InventoryBatch(
      id: json['id'] as String,
      itemId: json['itemId'] as String,
      itemName: json['itemName'] as String,
      section: json['section'] as String,
      quantity: (json['quantity'] as num).toDouble(),
      unit: json['unit'] as String,
      expiryAt: DateTime.parse(json['expiryAt'] as String),
      expiryDays: json['expiryDays'] as int,
      status: json['status'] as String,
    );
  }
}

class InventoryAlert {
  const InventoryAlert({
    required this.id,
    required this.type,
    required this.title,
    required this.detail,
    required this.itemId,
    required this.section,
    required this.severity,
    required this.status,
    required this.availableActions,
    required this.createdAt,
  });

  final String id;
  final String type;
  final String title;
  final String detail;
  final String itemId;
  final String section;
  final String severity;
  final String status;
  final List<String> availableActions;
  final DateTime createdAt;

  factory InventoryAlert.fromJson(Map<String, dynamic> json) {
    return InventoryAlert(
      id: json['id'] as String,
      title: json['title'] as String,
      type: json['type'] as String,
      detail: json['detail'] as String,
      itemId: json['itemId'] as String,
      section: json['section'] as String,
      severity: json['severity'] as String,
      status: json['status'] as String,
      availableActions:
          (json['availableActions'] as List<dynamic>? ?? const [])
              .map((item) => item.toString())
              .toList(),
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }
}

class IngredientSubstitution {
  const IngredientSubstitution({
    required this.id,
    required this.itemId,
    required this.itemName,
    required this.substituteId,
    required this.substituteName,
    required this.section,
    required this.reason,
    required this.confidence,
  });

  final String id;
  final String itemId;
  final String itemName;
  final String substituteId;
  final String substituteName;
  final String section;
  final String reason;
  final double confidence;

  factory IngredientSubstitution.fromJson(Map<String, dynamic> json) {
    return IngredientSubstitution(
      id: json['id'] as String,
      itemId: json['itemId'] as String,
      itemName: json['itemName'] as String,
      substituteId: json['substituteId'] as String,
      substituteName: json['substituteName'] as String,
      section: json['section'] as String,
      reason: json['reason'] as String,
      confidence: (json['confidence'] as num).toDouble(),
    );
  }
}

class InventoryDeduction {
  const InventoryDeduction({
    required this.id,
    required this.itemId,
    required this.itemName,
    required this.quantity,
    required this.unit,
    required this.section,
    required this.deductedAt,
    this.orderId,
  });

  final String id;
  final String itemId;
  final String itemName;
  final double quantity;
  final String unit;
  final String section;
  final DateTime deductedAt;
  final String? orderId;

  factory InventoryDeduction.fromJson(Map<String, dynamic> json) {
    return InventoryDeduction(
      id: json['id'] as String,
      itemId: json['itemId'] as String,
      itemName: json['itemName'] as String,
      quantity: (json['quantity'] as num).toDouble(),
      unit: json['unit'] as String,
      section: json['section'] as String,
      deductedAt: DateTime.parse(json['deductedAt'] as String),
      orderId: json['orderId'] as String?,
    );
  }
}

class ShortagePrediction {
  const ShortagePrediction({
    required this.itemId,
    required this.itemName,
    required this.predictedShortageHours,
    required this.confidence,
  });

  final String itemId;
  final String itemName;
  final int predictedShortageHours;
  final double confidence;

  factory ShortagePrediction.fromJson(Map<String, dynamic> json) {
    return ShortagePrediction(
      itemId: json['itemId'] as String,
      itemName: json['itemName'] as String,
      predictedShortageHours: json['predictedShortageHours'] as int,
      confidence: (json['confidence'] as num).toDouble(),
    );
  }
}

class InventoryStats {
  const InventoryStats({
    required this.totalItems,
    required this.lowStock,
    required this.expiringBatches,
    required this.openAlerts,
    required this.deductionsToday,
  });

  final int totalItems;
  final int lowStock;
  final int expiringBatches;
  final int openAlerts;
  final int deductionsToday;

  factory InventoryStats.fromJson(Map<String, dynamic> json) {
    return InventoryStats(
      totalItems: json['totalItems'] as int? ?? 0,
      lowStock: json['lowStock'] as int? ?? 0,
      expiringBatches: json['expiringBatches'] as int? ?? 0,
      openAlerts: json['openAlerts'] as int? ?? 0,
      deductionsToday: json['deductionsToday'] as int? ?? 0,
    );
  }
}

class InventoryFeatureFlags {
  const InventoryFeatureFlags({
    required this.liveIngredientDeduction,
    required this.stockValidation,
    required this.ingredientAlerts,
    required this.lowStockAlerts,
    required this.batchTracking,
    required this.expiryTracking,
    required this.autoStockSynchronization,
    required this.aiShortagePrediction,
    required this.ingredientSubstitutionSuggestions,
    required this.recipeStockValidation,
  });

  final bool liveIngredientDeduction;
  final bool stockValidation;
  final bool ingredientAlerts;
  final bool lowStockAlerts;
  final bool batchTracking;
  final bool expiryTracking;
  final bool autoStockSynchronization;
  final bool aiShortagePrediction;
  final bool ingredientSubstitutionSuggestions;
  final bool recipeStockValidation;

  factory InventoryFeatureFlags.fromJson(Map<String, dynamic> json) {
    return InventoryFeatureFlags(
      liveIngredientDeduction:
          json['liveIngredientDeduction'] as bool? ?? false,
      stockValidation: json['stockValidation'] as bool? ?? false,
      ingredientAlerts: json['ingredientAlerts'] as bool? ?? false,
      lowStockAlerts: json['lowStockAlerts'] as bool? ?? false,
      batchTracking: json['batchTracking'] as bool? ?? false,
      expiryTracking: json['expiryTracking'] as bool? ?? false,
      autoStockSynchronization:
          json['autoStockSynchronization'] as bool? ?? false,
      aiShortagePrediction: json['aiShortagePrediction'] as bool? ?? false,
      ingredientSubstitutionSuggestions:
          json['ingredientSubstitutionSuggestions'] as bool? ?? false,
      recipeStockValidation: json['recipeStockValidation'] as bool? ?? false,
    );
  }
}

class InventoryActionResult {
  const InventoryActionResult({
    required this.success,
    required this.message,
    this.valid,
  });

  final bool success;
  final String message;
  final bool? valid;

  factory InventoryActionResult.fromJson(Map<String, dynamic> json) {
    return InventoryActionResult(
      success: json['success'] as bool? ?? false,
      message: json['message'] as String? ?? 'Inventory action applied',
      valid: json['valid'] as bool?,
    );
  }
}
