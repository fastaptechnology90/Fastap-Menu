class AuditComplianceSnapshot {
  const AuditComplianceSnapshot({
    required this.section,
    required this.lastSyncedAt,
    required this.actionLogs,
    required this.foodSafetyLogs,
    required this.hygieneLogs,
    required this.staffActivityLogs,
    required this.incidentLogs,
    required this.stats,
    required this.auditFeatures,
    required this.sections,
  });

  final String section;
  final DateTime lastSyncedAt;
  final List<AuditActionLog> actionLogs;
  final List<FoodSafetyLog> foodSafetyLogs;
  final List<HygieneLog> hygieneLogs;
  final List<StaffActivityLog> staffActivityLogs;
  final List<IncidentLog> incidentLogs;
  final AuditComplianceStats stats;
  final AuditComplianceFeatureFlags auditFeatures;
  final List<String> sections;

  factory AuditComplianceSnapshot.fromJson(Map<String, dynamic> json) {
    return AuditComplianceSnapshot(
      section: json['section'] as String? ?? 'All',
      lastSyncedAt: DateTime.parse(json['lastSyncedAt'] as String),
      actionLogs: (json['actionLogs'] as List<dynamic>)
          .map((item) => AuditActionLog.fromJson(item as Map<String, dynamic>))
          .toList(),
      foodSafetyLogs: (json['foodSafetyLogs'] as List<dynamic>)
          .map((item) => FoodSafetyLog.fromJson(item as Map<String, dynamic>))
          .toList(),
      hygieneLogs: (json['hygieneLogs'] as List<dynamic>)
          .map((item) => HygieneLog.fromJson(item as Map<String, dynamic>))
          .toList(),
      staffActivityLogs: (json['staffActivityLogs'] as List<dynamic>)
          .map(
            (item) => StaffActivityLog.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      incidentLogs: (json['incidentLogs'] as List<dynamic>)
          .map((item) => IncidentLog.fromJson(item as Map<String, dynamic>))
          .toList(),
      stats: AuditComplianceStats.fromJson(
        json['stats'] as Map<String, dynamic>,
      ),
      auditFeatures: AuditComplianceFeatureFlags.fromJson(
        json['auditFeatures'] as Map<String, dynamic>,
      ),
      sections: (json['sections'] as List<dynamic>)
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class AuditActionLog {
  const AuditActionLog({
    required this.id,
    required this.actionLabel,
    required this.actorName,
    required this.section,
    required this.timestampLabel,
    required this.severity,
    required this.status,
    required this.availableActions,
  });

  final String id;
  final String actionLabel;
  final String actorName;
  final String section;
  final String timestampLabel;
  final String severity;
  final String status;
  final List<String> availableActions;

  factory AuditActionLog.fromJson(Map<String, dynamic> json) {
    return AuditActionLog(
      id: json['id'] as String,
      actionLabel: json['actionLabel'] as String,
      actorName: json['actorName'] as String? ?? 'System',
      section: json['section'] as String,
      timestampLabel: json['timestampLabel'] as String? ?? 'Unknown',
      severity: json['severity'] as String? ?? 'info',
      status: json['status'] as String? ?? 'pending',
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class FoodSafetyLog {
  const FoodSafetyLog({
    required this.id,
    required this.checkName,
    required this.section,
    required this.reading,
    required this.threshold,
    required this.status,
    required this.availableActions,
  });

  final String id;
  final String checkName;
  final String section;
  final String reading;
  final String threshold;
  final String status;
  final List<String> availableActions;

  factory FoodSafetyLog.fromJson(Map<String, dynamic> json) {
    return FoodSafetyLog(
      id: json['id'] as String,
      checkName: json['checkName'] as String,
      section: json['section'] as String,
      reading: json['reading'] as String? ?? 'N/A',
      threshold: json['threshold'] as String? ?? 'N/A',
      status: json['status'] as String? ?? 'pending',
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class HygieneLog {
  const HygieneLog({
    required this.id,
    required this.taskName,
    required this.section,
    required this.dueLabel,
    required this.complianceLevel,
    required this.status,
    required this.availableActions,
  });

  final String id;
  final String taskName;
  final String section;
  final String dueLabel;
  final String complianceLevel;
  final String status;
  final List<String> availableActions;

  factory HygieneLog.fromJson(Map<String, dynamic> json) {
    return HygieneLog(
      id: json['id'] as String,
      taskName: json['taskName'] as String,
      section: json['section'] as String,
      dueLabel: json['dueLabel'] as String? ?? 'Due soon',
      complianceLevel: json['complianceLevel'] as String? ?? 'ok',
      status: json['status'] as String? ?? 'pending',
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class StaffActivityLog {
  const StaffActivityLog({
    required this.id,
    required this.activityLabel,
    required this.staffName,
    required this.section,
    required this.activityType,
    required this.status,
    required this.availableActions,
  });

  final String id;
  final String activityLabel;
  final String staffName;
  final String section;
  final String activityType;
  final String status;
  final List<String> availableActions;

  factory StaffActivityLog.fromJson(Map<String, dynamic> json) {
    return StaffActivityLog(
      id: json['id'] as String,
      activityLabel: json['activityLabel'] as String,
      staffName: json['staffName'] as String? ?? 'Unknown',
      section: json['section'] as String,
      activityType: json['activityType'] as String? ?? 'general',
      status: json['status'] as String? ?? 'pending',
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class IncidentLog {
  const IncidentLog({
    required this.id,
    required this.incidentTitle,
    required this.section,
    required this.severity,
    required this.reportedAt,
    required this.status,
    required this.availableActions,
  });

  final String id;
  final String incidentTitle;
  final String section;
  final String severity;
  final String reportedAt;
  final String status;
  final List<String> availableActions;

  factory IncidentLog.fromJson(Map<String, dynamic> json) {
    return IncidentLog(
      id: json['id'] as String,
      incidentTitle: json['incidentTitle'] as String,
      section: json['section'] as String,
      severity: json['severity'] as String? ?? 'medium',
      reportedAt: json['reportedAt'] as String? ?? 'Unknown',
      status: json['status'] as String? ?? 'open',
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class AuditComplianceStats {
  const AuditComplianceStats({
    required this.pendingReviews,
    required this.foodSafetyFlags,
    required this.hygieneIssues,
    required this.staffAlerts,
    required this.openIncidents,
    required this.exportedToday,
  });

  final int pendingReviews;
  final int foodSafetyFlags;
  final int hygieneIssues;
  final int staffAlerts;
  final int openIncidents;
  final int exportedToday;

  factory AuditComplianceStats.fromJson(Map<String, dynamic> json) {
    return AuditComplianceStats(
      pendingReviews: json['pendingReviews'] as int? ?? 0,
      foodSafetyFlags: json['foodSafetyFlags'] as int? ?? 0,
      hygieneIssues: json['hygieneIssues'] as int? ?? 0,
      staffAlerts: json['staffAlerts'] as int? ?? 0,
      openIncidents: json['openIncidents'] as int? ?? 0,
      exportedToday: json['exportedToday'] as int? ?? 0,
    );
  }
}

class AuditComplianceFeatureFlags {
  const AuditComplianceFeatureFlags({
    required this.actionLogs,
    required this.foodSafetyLogs,
    required this.hygieneLogs,
    required this.staffActivityLogs,
    required this.incidentLogs,
  });

  final bool actionLogs;
  final bool foodSafetyLogs;
  final bool hygieneLogs;
  final bool staffActivityLogs;
  final bool incidentLogs;

  factory AuditComplianceFeatureFlags.fromJson(Map<String, dynamic> json) {
    return AuditComplianceFeatureFlags(
      actionLogs: json['actionLogs'] as bool? ?? false,
      foodSafetyLogs: json['foodSafetyLogs'] as bool? ?? false,
      hygieneLogs: json['hygieneLogs'] as bool? ?? false,
      staffActivityLogs: json['staffActivityLogs'] as bool? ?? false,
      incidentLogs: json['incidentLogs'] as bool? ?? false,
    );
  }
}

class AuditComplianceActionResult {
  const AuditComplianceActionResult({
    required this.success,
    required this.message,
  });

  final bool success;
  final String message;

  factory AuditComplianceActionResult.fromJson(Map<String, dynamic> json) {
    return AuditComplianceActionResult(
      success: json['success'] as bool? ?? false,
      message: json['message'] as String? ?? 'Audit action applied',
    );
  }
}
