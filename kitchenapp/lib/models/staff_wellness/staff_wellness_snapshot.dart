class StaffWellnessSnapshot {
  const StaffWellnessSnapshot({
    required this.section,
    required this.lastSyncedAt,
    required this.burnoutPredictions,
    required this.slowPerformanceAlerts,
    required this.overworkAlerts,
    required this.breakRecommendations,
    required this.stats,
    required this.wellnessFeatures,
    required this.sections,
  });

  final String section;
  final DateTime lastSyncedAt;
  final List<BurnoutPrediction> burnoutPredictions;
  final List<SlowPerformanceAlert> slowPerformanceAlerts;
  final List<OverworkAlert> overworkAlerts;
  final List<BreakRecommendation> breakRecommendations;
  final StaffWellnessStats stats;
  final StaffWellnessFeatureFlags wellnessFeatures;
  final List<String> sections;

  factory StaffWellnessSnapshot.fromJson(Map<String, dynamic> json) {
    return StaffWellnessSnapshot(
      section: json['section'] as String? ?? 'All',
      lastSyncedAt: DateTime.parse(json['lastSyncedAt'] as String),
      burnoutPredictions: (json['burnoutPredictions'] as List<dynamic>)
          .map(
            (item) => BurnoutPrediction.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      slowPerformanceAlerts: (json['slowPerformanceAlerts'] as List<dynamic>)
          .map(
            (item) =>
                SlowPerformanceAlert.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      overworkAlerts: (json['overworkAlerts'] as List<dynamic>)
          .map((item) => OverworkAlert.fromJson(item as Map<String, dynamic>))
          .toList(),
      breakRecommendations: (json['breakRecommendations'] as List<dynamic>)
          .map(
            (item) =>
                BreakRecommendation.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      stats: StaffWellnessStats.fromJson(json['stats'] as Map<String, dynamic>),
      wellnessFeatures: StaffWellnessFeatureFlags.fromJson(
        json['wellnessFeatures'] as Map<String, dynamic>,
      ),
      sections: (json['sections'] as List<dynamic>)
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class BurnoutPrediction {
  const BurnoutPrediction({
    required this.id,
    required this.staffId,
    required this.staffName,
    required this.section,
    required this.riskLevel,
    required this.riskScore,
    required this.predictionSummary,
    required this.availableActions,
  });

  final String id;
  final String staffId;
  final String staffName;
  final String section;
  final String riskLevel;
  final int riskScore;
  final String predictionSummary;
  final List<String> availableActions;

  factory BurnoutPrediction.fromJson(Map<String, dynamic> json) {
    return BurnoutPrediction(
      id: json['id'] as String,
      staffId: json['staffId'] as String,
      staffName: json['staffName'] as String,
      section: json['section'] as String,
      riskLevel: json['riskLevel'] as String? ?? 'moderate',
      riskScore: json['riskScore'] as int? ?? 0,
      predictionSummary: json['predictionSummary'] as String? ?? '',
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class SlowPerformanceAlert {
  const SlowPerformanceAlert({
    required this.id,
    required this.staffId,
    required this.staffName,
    required this.section,
    required this.slowdownPercent,
    required this.detectedAt,
    required this.status,
    required this.availableActions,
  });

  final String id;
  final String staffId;
  final String staffName;
  final String section;
  final int slowdownPercent;
  final String detectedAt;
  final String status;
  final List<String> availableActions;

  factory SlowPerformanceAlert.fromJson(Map<String, dynamic> json) {
    return SlowPerformanceAlert(
      id: json['id'] as String,
      staffId: json['staffId'] as String,
      staffName: json['staffName'] as String,
      section: json['section'] as String,
      slowdownPercent: json['slowdownPercent'] as int? ?? 0,
      detectedAt: json['detectedAt'] as String? ?? 'Unknown',
      status: json['status'] as String? ?? 'active',
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class OverworkAlert {
  const OverworkAlert({
    required this.id,
    required this.staffId,
    required this.staffName,
    required this.section,
    required this.hoursOnShift,
    required this.thresholdHours,
    required this.status,
    required this.availableActions,
  });

  final String id;
  final String staffId;
  final String staffName;
  final String section;
  final double hoursOnShift;
  final double thresholdHours;
  final String status;
  final List<String> availableActions;

  factory OverworkAlert.fromJson(Map<String, dynamic> json) {
    return OverworkAlert(
      id: json['id'] as String,
      staffId: json['staffId'] as String,
      staffName: json['staffName'] as String,
      section: json['section'] as String,
      hoursOnShift: (json['hoursOnShift'] as num?)?.toDouble() ?? 0,
      thresholdHours: (json['thresholdHours'] as num?)?.toDouble() ?? 8,
      status: json['status'] as String? ?? 'active',
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class BreakRecommendation {
  const BreakRecommendation({
    required this.id,
    required this.staffId,
    required this.staffName,
    required this.section,
    required this.recommendedBreakIn,
    required this.reason,
    required this.status,
    required this.availableActions,
  });

  final String id;
  final String staffId;
  final String staffName;
  final String section;
  final String recommendedBreakIn;
  final String reason;
  final String status;
  final List<String> availableActions;

  factory BreakRecommendation.fromJson(Map<String, dynamic> json) {
    return BreakRecommendation(
      id: json['id'] as String,
      staffId: json['staffId'] as String,
      staffName: json['staffName'] as String,
      section: json['section'] as String,
      recommendedBreakIn: json['recommendedBreakIn'] as String? ?? '15 min',
      reason: json['reason'] as String? ?? 'Fatigue detected',
      status: json['status'] as String? ?? 'pending',
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class StaffWellnessStats {
  const StaffWellnessStats({
    required this.highBurnoutRisk,
    required this.activeSlowAlerts,
    required this.overworkAlerts,
    required this.pendingBreaks,
    required this.aiScansToday,
    required this.avgRiskScore,
  });

  final int highBurnoutRisk;
  final int activeSlowAlerts;
  final int overworkAlerts;
  final int pendingBreaks;
  final int aiScansToday;
  final int avgRiskScore;

  factory StaffWellnessStats.fromJson(Map<String, dynamic> json) {
    return StaffWellnessStats(
      highBurnoutRisk: json['highBurnoutRisk'] as int? ?? 0,
      activeSlowAlerts: json['activeSlowAlerts'] as int? ?? 0,
      overworkAlerts: json['overworkAlerts'] as int? ?? 0,
      pendingBreaks: json['pendingBreaks'] as int? ?? 0,
      aiScansToday: json['aiScansToday'] as int? ?? 0,
      avgRiskScore: json['avgRiskScore'] as int? ?? 0,
    );
  }
}

class StaffWellnessFeatureFlags {
  const StaffWellnessFeatureFlags({
    required this.burnoutPrediction,
    required this.slowPerformanceDetection,
    required this.overworkAlerts,
    required this.breakRecommendations,
  });

  final bool burnoutPrediction;
  final bool slowPerformanceDetection;
  final bool overworkAlerts;
  final bool breakRecommendations;

  factory StaffWellnessFeatureFlags.fromJson(Map<String, dynamic> json) {
    return StaffWellnessFeatureFlags(
      burnoutPrediction: json['burnoutPrediction'] as bool? ?? false,
      slowPerformanceDetection:
          json['slowPerformanceDetection'] as bool? ?? false,
      overworkAlerts: json['overworkAlerts'] as bool? ?? false,
      breakRecommendations: json['breakRecommendations'] as bool? ?? false,
    );
  }
}

class StaffWellnessActionResult {
  const StaffWellnessActionResult({
    required this.success,
    required this.message,
  });

  final bool success;
  final String message;

  factory StaffWellnessActionResult.fromJson(Map<String, dynamic> json) {
    return StaffWellnessActionResult(
      success: json['success'] as bool? ?? false,
      message: json['message'] as String? ?? 'Wellness action applied',
    );
  }
}
