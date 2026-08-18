class EquipmentSnapshot {
  const EquipmentSnapshot({
    required this.section,
    required this.lastSyncedAt,
    required this.equipmentAssets,
    required this.amcReminders,
    required this.maintenanceTickets,
    required this.breakdownAlerts,
    required this.usageAnalytics,
    required this.stats,
    required this.equipmentFeatures,
    required this.sections,
  });

  final String section;
  final DateTime lastSyncedAt;
  final List<EquipmentAsset> equipmentAssets;
  final List<AmcReminder> amcReminders;
  final List<MaintenanceTicket> maintenanceTickets;
  final List<BreakdownAlert> breakdownAlerts;
  final List<UsageAnalyticsEntry> usageAnalytics;
  final EquipmentStats stats;
  final EquipmentFeatureFlags equipmentFeatures;
  final List<String> sections;

  factory EquipmentSnapshot.fromJson(Map<String, dynamic> json) {
    return EquipmentSnapshot(
      section: json['section'] as String? ?? 'All',
      lastSyncedAt: DateTime.parse(json['lastSyncedAt'] as String),
      equipmentAssets: (json['equipmentAssets'] as List<dynamic>)
          .map((item) => EquipmentAsset.fromJson(item as Map<String, dynamic>))
          .toList(),
      amcReminders: (json['amcReminders'] as List<dynamic>)
          .map((item) => AmcReminder.fromJson(item as Map<String, dynamic>))
          .toList(),
      maintenanceTickets: (json['maintenanceTickets'] as List<dynamic>)
          .map(
            (item) => MaintenanceTicket.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      breakdownAlerts: (json['breakdownAlerts'] as List<dynamic>)
          .map((item) => BreakdownAlert.fromJson(item as Map<String, dynamic>))
          .toList(),
      usageAnalytics: (json['usageAnalytics'] as List<dynamic>)
          .map(
            (item) =>
                UsageAnalyticsEntry.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      stats: EquipmentStats.fromJson(json['stats'] as Map<String, dynamic>),
      equipmentFeatures: EquipmentFeatureFlags.fromJson(
        json['equipmentFeatures'] as Map<String, dynamic>,
      ),
      sections: (json['sections'] as List<dynamic>)
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class EquipmentAsset {
  const EquipmentAsset({
    required this.id,
    required this.assetName,
    required this.equipmentType,
    required this.section,
    required this.healthPercent,
    required this.status,
    required this.lastService,
    required this.availableActions,
  });

  final String id;
  final String assetName;
  final String equipmentType;
  final String section;
  final int healthPercent;
  final String status;
  final String lastService;
  final List<String> availableActions;

  factory EquipmentAsset.fromJson(Map<String, dynamic> json) {
    return EquipmentAsset(
      id: json['id'] as String,
      assetName: json['assetName'] as String,
      equipmentType: json['equipmentType'] as String? ?? 'General',
      section: json['section'] as String,
      healthPercent: json['healthPercent'] as int? ?? 0,
      status: json['status'] as String? ?? 'operational',
      lastService: json['lastService'] as String? ?? 'Unknown',
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class AmcReminder {
  const AmcReminder({
    required this.id,
    required this.assetName,
    required this.section,
    required this.provider,
    required this.dueInDays,
    required this.status,
  });

  final String id;
  final String assetName;
  final String section;
  final String provider;
  final int dueInDays;
  final String status;

  factory AmcReminder.fromJson(Map<String, dynamic> json) {
    return AmcReminder(
      id: json['id'] as String,
      assetName: json['assetName'] as String,
      section: json['section'] as String,
      provider: json['provider'] as String? ?? 'Vendor',
      dueInDays: json['dueInDays'] as int? ?? 0,
      status: json['status'] as String? ?? 'upcoming',
    );
  }
}

class MaintenanceTicket {
  const MaintenanceTicket({
    required this.id,
    required this.assetId,
    required this.assetName,
    required this.section,
    required this.issueSummary,
    required this.priority,
    required this.status,
    required this.availableActions,
  });

  final String id;
  final String assetId;
  final String assetName;
  final String section;
  final String issueSummary;
  final String priority;
  final String status;
  final List<String> availableActions;

  factory MaintenanceTicket.fromJson(Map<String, dynamic> json) {
    return MaintenanceTicket(
      id: json['id'] as String,
      assetId: json['assetId'] as String,
      assetName: json['assetName'] as String,
      section: json['section'] as String,
      issueSummary: json['issueSummary'] as String? ?? '',
      priority: json['priority'] as String? ?? 'normal',
      status: json['status'] as String? ?? 'open',
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class BreakdownAlert {
  const BreakdownAlert({
    required this.id,
    required this.assetId,
    required this.assetName,
    required this.section,
    required this.alertType,
    required this.severity,
    required this.status,
    required this.availableActions,
  });

  final String id;
  final String assetId;
  final String assetName;
  final String section;
  final String alertType;
  final String severity;
  final String status;
  final List<String> availableActions;

  factory BreakdownAlert.fromJson(Map<String, dynamic> json) {
    return BreakdownAlert(
      id: json['id'] as String,
      assetId: json['assetId'] as String,
      assetName: json['assetName'] as String,
      section: json['section'] as String,
      alertType: json['alertType'] as String? ?? 'breakdown',
      severity: json['severity'] as String? ?? 'high',
      status: json['status'] as String? ?? 'active',
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class UsageAnalyticsEntry {
  const UsageAnalyticsEntry({
    required this.id,
    required this.assetName,
    required this.section,
    required this.usageHours,
    required this.peakWindow,
    required this.utilizationPercent,
  });

  final String id;
  final String assetName;
  final String section;
  final double usageHours;
  final String peakWindow;
  final int utilizationPercent;

  factory UsageAnalyticsEntry.fromJson(Map<String, dynamic> json) {
    return UsageAnalyticsEntry(
      id: json['id'] as String,
      assetName: json['assetName'] as String,
      section: json['section'] as String,
      usageHours: (json['usageHours'] as num?)?.toDouble() ?? 0,
      peakWindow: json['peakWindow'] as String? ?? 'N/A',
      utilizationPercent: json['utilizationPercent'] as int? ?? 0,
    );
  }
}

class EquipmentStats {
  const EquipmentStats({
    required this.totalAssets,
    required this.operationalAssets,
    required this.openTickets,
    required this.activeBreakdowns,
    required this.amcDueSoon,
    required this.highUtilization,
    required this.resolvedToday,
  });

  final int totalAssets;
  final int operationalAssets;
  final int openTickets;
  final int activeBreakdowns;
  final int amcDueSoon;
  final int highUtilization;
  final int resolvedToday;

  factory EquipmentStats.fromJson(Map<String, dynamic> json) {
    return EquipmentStats(
      totalAssets: json['totalAssets'] as int? ?? 0,
      operationalAssets: json['operationalAssets'] as int? ?? 0,
      openTickets: json['openTickets'] as int? ?? 0,
      activeBreakdowns: json['activeBreakdowns'] as int? ?? 0,
      amcDueSoon: json['amcDueSoon'] as int? ?? 0,
      highUtilization: json['highUtilization'] as int? ?? 0,
      resolvedToday: json['resolvedToday'] as int? ?? 0,
    );
  }
}

class EquipmentFeatureFlags {
  const EquipmentFeatureFlags({
    required this.equipmentHealthTracking,
    required this.amcReminders,
    required this.maintenanceTickets,
    required this.breakdownAlerts,
    required this.usageAnalytics,
  });

  final bool equipmentHealthTracking;
  final bool amcReminders;
  final bool maintenanceTickets;
  final bool breakdownAlerts;
  final bool usageAnalytics;

  factory EquipmentFeatureFlags.fromJson(Map<String, dynamic> json) {
    return EquipmentFeatureFlags(
      equipmentHealthTracking:
          json['equipmentHealthTracking'] as bool? ?? false,
      amcReminders: json['amcReminders'] as bool? ?? false,
      maintenanceTickets: json['maintenanceTickets'] as bool? ?? false,
      breakdownAlerts: json['breakdownAlerts'] as bool? ?? false,
      usageAnalytics: json['usageAnalytics'] as bool? ?? false,
    );
  }
}

class EquipmentActionResult {
  const EquipmentActionResult({
    required this.success,
    required this.message,
  });

  final bool success;
  final String message;

  factory EquipmentActionResult.fromJson(Map<String, dynamic> json) {
    return EquipmentActionResult(
      success: json['success'] as bool? ?? false,
      message: json['message'] as String? ?? 'Equipment action applied',
    );
  }
}
