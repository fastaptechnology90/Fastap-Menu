class BatchCookingSnapshot {
  const BatchCookingSnapshot({
    required this.section,
    required this.lastSyncedAt,
    required this.batches,
    required this.forecasts,
    required this.stats,
    required this.batchFeatures,
    required this.sections,
  });

  final String section;
  final DateTime lastSyncedAt;
  final List<CookingBatch> batches;
  final List<ProductionForecast> forecasts;
  final BatchCookingStats stats;
  final BatchFeatureFlags batchFeatures;
  final List<String> sections;

  factory BatchCookingSnapshot.fromJson(Map<String, dynamic> json) {
    return BatchCookingSnapshot(
      section: json['section'] as String? ?? 'All',
      lastSyncedAt: DateTime.parse(json['lastSyncedAt'] as String),
      batches: (json['batches'] as List<dynamic>)
          .map((item) => CookingBatch.fromJson(item as Map<String, dynamic>))
          .toList(),
      forecasts: (json['forecasts'] as List<dynamic>)
          .map(
            (item) => ProductionForecast.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      stats: BatchCookingStats.fromJson(json['stats'] as Map<String, dynamic>),
      batchFeatures: BatchFeatureFlags.fromJson(
        json['batchFeatures'] as Map<String, dynamic>,
      ),
      sections: (json['sections'] as List<dynamic>)
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class CookingBatch {
  const CookingBatch({
    required this.id,
    required this.name,
    required this.section,
    required this.quantity,
    required this.remainingQuantity,
    required this.unit,
    required this.status,
    required this.statusLabel,
    required this.timerSeconds,
    required this.timerLabel,
    required this.expiryMinutes,
    required this.reuseCount,
    required this.progress,
    required this.availableActions,
  });

  final String id;
  final String name;
  final String section;
  final double quantity;
  final double remainingQuantity;
  final String unit;
  final String status;
  final String statusLabel;
  final int timerSeconds;
  final String timerLabel;
  final int expiryMinutes;
  final int reuseCount;
  final double progress;
  final List<String> availableActions;

  factory CookingBatch.fromJson(Map<String, dynamic> json) {
    return CookingBatch(
      id: json['id'] as String,
      name: json['name'] as String,
      section: json['section'] as String,
      quantity: (json['quantity'] as num).toDouble(),
      remainingQuantity: (json['remainingQuantity'] as num).toDouble(),
      unit: json['unit'] as String,
      status: json['status'] as String,
      statusLabel: json['statusLabel'] as String,
      timerSeconds: json['timerSeconds'] as int? ?? 0,
      timerLabel: json['timerLabel'] as String? ?? '00:00',
      expiryMinutes: json['expiryMinutes'] as int? ?? 0,
      reuseCount: json['reuseCount'] as int? ?? 0,
      progress: (json['progress'] as num?)?.toDouble() ?? 0,
      availableActions:
          (json['availableActions'] as List<dynamic>? ?? const [])
              .map((item) => item.toString())
              .toList(),
    );
  }
}

class ProductionForecast {
  const ProductionForecast({
    required this.id,
    required this.section,
    required this.label,
    required this.forecastCovers,
    required this.recommendedBatchSize,
    required this.startInMinutes,
    required this.confidence,
    required this.updatedAt,
  });

  final String id;
  final String section;
  final String label;
  final int forecastCovers;
  final int recommendedBatchSize;
  final int startInMinutes;
  final double confidence;
  final DateTime updatedAt;

  factory ProductionForecast.fromJson(Map<String, dynamic> json) {
    return ProductionForecast(
      id: json['id'] as String,
      section: json['section'] as String,
      label: json['label'] as String,
      forecastCovers: json['forecastCovers'] as int,
      recommendedBatchSize: json['recommendedBatchSize'] as int,
      startInMinutes: json['startInMinutes'] as int,
      confidence: (json['confidence'] as num).toDouble(),
      updatedAt: DateTime.parse(json['updatedAt'] as String),
    );
  }
}

class BatchCookingStats {
  const BatchCookingStats({
    required this.totalBatches,
    required this.cooking,
    required this.ready,
    required this.expiring,
    required this.reused,
    required this.forecastWindows,
  });

  final int totalBatches;
  final int cooking;
  final int ready;
  final int expiring;
  final int reused;
  final int forecastWindows;

  factory BatchCookingStats.fromJson(Map<String, dynamic> json) {
    return BatchCookingStats(
      totalBatches: json['totalBatches'] as int? ?? 0,
      cooking: json['cooking'] as int? ?? 0,
      ready: json['ready'] as int? ?? 0,
      expiring: json['expiring'] as int? ?? 0,
      reused: json['reused'] as int? ?? 0,
      forecastWindows: json['forecastWindows'] as int? ?? 0,
    );
  }
}

class BatchFeatureFlags {
  const BatchFeatureFlags({
    required this.bulkPreparationTracking,
    required this.batchTiming,
    required this.batchExpiryTracking,
    required this.batchReuseTracking,
    required this.productionForecasting,
  });

  final bool bulkPreparationTracking;
  final bool batchTiming;
  final bool batchExpiryTracking;
  final bool batchReuseTracking;
  final bool productionForecasting;

  factory BatchFeatureFlags.fromJson(Map<String, dynamic> json) {
    return BatchFeatureFlags(
      bulkPreparationTracking:
          json['bulkPreparationTracking'] as bool? ?? false,
      batchTiming: json['batchTiming'] as bool? ?? false,
      batchExpiryTracking: json['batchExpiryTracking'] as bool? ?? false,
      batchReuseTracking: json['batchReuseTracking'] as bool? ?? false,
      productionForecasting: json['productionForecasting'] as bool? ?? false,
    );
  }
}

class BatchCookingActionResult {
  const BatchCookingActionResult({
    required this.success,
    required this.message,
  });

  final bool success;
  final String message;

  factory BatchCookingActionResult.fromJson(Map<String, dynamic> json) {
    return BatchCookingActionResult(
      success: json['success'] as bool? ?? false,
      message: json['message'] as String? ?? 'Batch action applied',
    );
  }
}
