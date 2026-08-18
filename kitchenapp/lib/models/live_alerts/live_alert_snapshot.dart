class LiveAlertSnapshot {
  const LiveAlertSnapshot({
    required this.section,
    required this.lastSyncedAt,
    required this.alerts,
    required this.stats,
    required this.alertFeatures,
    required this.sections,
  });

  final String section;
  final DateTime lastSyncedAt;
  final List<LiveAlert> alerts;
  final LiveAlertStats stats;
  final LiveAlertFeatureFlags alertFeatures;
  final List<String> sections;

  factory LiveAlertSnapshot.fromJson(Map<String, dynamic> json) {
    return LiveAlertSnapshot(
      section: json['section'] as String? ?? 'All',
      lastSyncedAt: DateTime.parse(json['lastSyncedAt'] as String),
      alerts: (json['alerts'] as List<dynamic>)
          .map((item) => LiveAlert.fromJson(item as Map<String, dynamic>))
          .toList(),
      stats: LiveAlertStats.fromJson(json['stats'] as Map<String, dynamic>),
      alertFeatures: LiveAlertFeatureFlags.fromJson(
        json['alertFeatures'] as Map<String, dynamic>,
      ),
      sections: (json['sections'] as List<dynamic>)
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class LiveAlert {
  const LiveAlert({
    required this.id,
    required this.alertType,
    required this.title,
    required this.section,
    required this.severity,
    required this.message,
    required this.triggeredAt,
    required this.status,
    required this.availableActions,
  });

  final String id;
  final String alertType;
  final String title;
  final String section;
  final String severity;
  final String message;
  final String triggeredAt;
  final String status;
  final List<String> availableActions;

  factory LiveAlert.fromJson(Map<String, dynamic> json) {
    return LiveAlert(
      id: json['id'] as String,
      alertType: json['alertType'] as String? ?? 'general',
      title: json['title'] as String,
      section: json['section'] as String,
      severity: json['severity'] as String? ?? 'medium',
      message: json['message'] as String? ?? '',
      triggeredAt: json['triggeredAt'] as String? ?? 'Just now',
      status: json['status'] as String? ?? 'active',
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class LiveAlertStats {
  const LiveAlertStats({
    required this.activeAlerts,
    required this.criticalAlerts,
    required this.delayAlerts,
    required this.vipAlerts,
    required this.emergencyAlerts,
    required this.resolvedToday,
  });

  final int activeAlerts;
  final int criticalAlerts;
  final int delayAlerts;
  final int vipAlerts;
  final int emergencyAlerts;
  final int resolvedToday;

  factory LiveAlertStats.fromJson(Map<String, dynamic> json) {
    return LiveAlertStats(
      activeAlerts: json['activeAlerts'] as int? ?? 0,
      criticalAlerts: json['criticalAlerts'] as int? ?? 0,
      delayAlerts: json['delayAlerts'] as int? ?? 0,
      vipAlerts: json['vipAlerts'] as int? ?? 0,
      emergencyAlerts: json['emergencyAlerts'] as int? ?? 0,
      resolvedToday: json['resolvedToday'] as int? ?? 0,
    );
  }
}

class LiveAlertFeatureFlags {
  const LiveAlertFeatureFlags({
    required this.delayAlerts,
    required this.vipAlerts,
    required this.emergencyAlerts,
    required this.lowStockAlerts,
    required this.equipmentAlerts,
    required this.hygieneAlerts,
  });

  final bool delayAlerts;
  final bool vipAlerts;
  final bool emergencyAlerts;
  final bool lowStockAlerts;
  final bool equipmentAlerts;
  final bool hygieneAlerts;

  factory LiveAlertFeatureFlags.fromJson(Map<String, dynamic> json) {
    return LiveAlertFeatureFlags(
      delayAlerts: json['delayAlerts'] as bool? ?? false,
      vipAlerts: json['vipAlerts'] as bool? ?? false,
      emergencyAlerts: json['emergencyAlerts'] as bool? ?? false,
      lowStockAlerts: json['lowStockAlerts'] as bool? ?? false,
      equipmentAlerts: json['equipmentAlerts'] as bool? ?? false,
      hygieneAlerts: json['hygieneAlerts'] as bool? ?? false,
    );
  }
}

class LiveAlertActionResult {
  const LiveAlertActionResult({
    required this.success,
    required this.message,
  });

  final bool success;
  final String message;

  factory LiveAlertActionResult.fromJson(Map<String, dynamic> json) {
    return LiveAlertActionResult(
      success: json['success'] as bool? ?? false,
      message: json['message'] as String? ?? 'Alert action applied',
    );
  }
}
