class StaffPerformanceSnapshot {
  const StaffPerformanceSnapshot({
    required this.section,
    required this.lastSyncedAt,
    required this.staffRecords,
    required this.incentives,
    required this.stats,
    required this.performanceFeatures,
    required this.sections,
  });

  final String section;
  final DateTime lastSyncedAt;
  final List<StaffPerformanceRecord> staffRecords;
  final List<PerformanceIncentive> incentives;
  final StaffPerformanceStats stats;
  final StaffPerformanceFeatureFlags performanceFeatures;
  final List<String> sections;

  factory StaffPerformanceSnapshot.fromJson(Map<String, dynamic> json) {
    return StaffPerformanceSnapshot(
      section: json['section'] as String? ?? 'All',
      lastSyncedAt: DateTime.parse(json['lastSyncedAt'] as String),
      staffRecords: (json['staffRecords'] as List<dynamic>)
          .map(
            (item) =>
                StaffPerformanceRecord.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      incentives: (json['incentives'] as List<dynamic>)
          .map(
            (item) =>
                PerformanceIncentive.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      stats: StaffPerformanceStats.fromJson(json['stats'] as Map<String, dynamic>),
      performanceFeatures: StaffPerformanceFeatureFlags.fromJson(
        json['performanceFeatures'] as Map<String, dynamic>,
      ),
      sections: (json['sections'] as List<dynamic>)
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class StaffPerformanceRecord {
  const StaffPerformanceRecord({
    required this.id,
    required this.staffId,
    required this.staffName,
    required this.section,
    required this.role,
    required this.ordersCompleted,
    required this.preparationSpeed,
    required this.delayRatio,
    required this.complaintRatio,
    required this.qualityScore,
    required this.productivityScore,
    required this.rankLabel,
    required this.trend,
    required this.availableActions,
  });

  final String id;
  final String staffId;
  final String staffName;
  final String section;
  final String role;
  final int ordersCompleted;
  final String preparationSpeed;
  final int delayRatio;
  final int complaintRatio;
  final int qualityScore;
  final int productivityScore;
  final String rankLabel;
  final String trend;
  final List<String> availableActions;

  factory StaffPerformanceRecord.fromJson(Map<String, dynamic> json) {
    return StaffPerformanceRecord(
      id: json['id'] as String,
      staffId: json['staffId'] as String,
      staffName: json['staffName'] as String,
      section: json['section'] as String,
      role: json['role'] as String? ?? 'Chef',
      ordersCompleted: json['ordersCompleted'] as int? ?? 0,
      preparationSpeed: json['preparationSpeed'] as String? ?? '0 min',
      delayRatio: json['delayRatio'] as int? ?? 0,
      complaintRatio: json['complaintRatio'] as int? ?? 0,
      qualityScore: json['qualityScore'] as int? ?? 0,
      productivityScore: json['productivityScore'] as int? ?? 0,
      rankLabel: json['rankLabel'] as String? ?? 'Unranked',
      trend: json['trend'] as String? ?? 'stable',
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class PerformanceIncentive {
  const PerformanceIncentive({
    required this.id,
    required this.staffId,
    required this.staffName,
    required this.section,
    required this.incentiveType,
    required this.amountLabel,
    required this.reason,
    required this.status,
    required this.availableActions,
  });

  final String id;
  final String staffId;
  final String staffName;
  final String section;
  final String incentiveType;
  final String amountLabel;
  final String reason;
  final String status;
  final List<String> availableActions;

  factory PerformanceIncentive.fromJson(Map<String, dynamic> json) {
    return PerformanceIncentive(
      id: json['id'] as String,
      staffId: json['staffId'] as String,
      staffName: json['staffName'] as String,
      section: json['section'] as String,
      incentiveType: json['incentiveType'] as String? ?? 'performance_bonus',
      amountLabel: json['amountLabel'] as String? ?? '₹0',
      reason: json['reason'] as String? ?? 'Performance reward',
      status: json['status'] as String? ?? 'pending',
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class StaffPerformanceStats {
  const StaffPerformanceStats({
    required this.staffTracked,
    required this.avgQualityScore,
    required this.avgProductivity,
    required this.avgDelayRatio,
    required this.incentivesPending,
    required this.bonusesThisMonth,
  });

  final int staffTracked;
  final int avgQualityScore;
  final int avgProductivity;
  final int avgDelayRatio;
  final int incentivesPending;
  final int bonusesThisMonth;

  factory StaffPerformanceStats.fromJson(Map<String, dynamic> json) {
    return StaffPerformanceStats(
      staffTracked: json['staffTracked'] as int? ?? 0,
      avgQualityScore: json['avgQualityScore'] as int? ?? 0,
      avgProductivity: json['avgProductivity'] as int? ?? 0,
      avgDelayRatio: json['avgDelayRatio'] as int? ?? 0,
      incentivesPending: json['incentivesPending'] as int? ?? 0,
      bonusesThisMonth: json['bonusesThisMonth'] as int? ?? 0,
    );
  }
}

class StaffPerformanceFeatureFlags {
  const StaffPerformanceFeatureFlags({
    required this.ordersCompleted,
    required this.preparationSpeed,
    required this.delayRatio,
    required this.complaintRatio,
    required this.qualityScore,
    required this.productivityScore,
    required this.speedIncentives,
    required this.qualityRewards,
    required this.performanceBonuses,
  });

  final bool ordersCompleted;
  final bool preparationSpeed;
  final bool delayRatio;
  final bool complaintRatio;
  final bool qualityScore;
  final bool productivityScore;
  final bool speedIncentives;
  final bool qualityRewards;
  final bool performanceBonuses;

  factory StaffPerformanceFeatureFlags.fromJson(Map<String, dynamic> json) {
    return StaffPerformanceFeatureFlags(
      ordersCompleted: json['ordersCompleted'] as bool? ?? false,
      preparationSpeed: json['preparationSpeed'] as bool? ?? false,
      delayRatio: json['delayRatio'] as bool? ?? false,
      complaintRatio: json['complaintRatio'] as bool? ?? false,
      qualityScore: json['qualityScore'] as bool? ?? false,
      productivityScore: json['productivityScore'] as bool? ?? false,
      speedIncentives: json['speedIncentives'] as bool? ?? false,
      qualityRewards: json['qualityRewards'] as bool? ?? false,
      performanceBonuses: json['performanceBonuses'] as bool? ?? false,
    );
  }
}

class StaffPerformanceActionResult {
  const StaffPerformanceActionResult({
    required this.success,
    required this.message,
  });

  final bool success;
  final String message;

  factory StaffPerformanceActionResult.fromJson(Map<String, dynamic> json) {
    return StaffPerformanceActionResult(
      success: json['success'] as bool? ?? false,
      message: json['message'] as String? ?? 'Performance action applied',
    );
  }
}
