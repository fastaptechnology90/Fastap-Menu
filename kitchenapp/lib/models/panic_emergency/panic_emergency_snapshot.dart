class PanicEmergencySnapshot {
  const PanicEmergencySnapshot({
    required this.section,
    required this.lastSyncedAt,
    required this.incidents,
    required this.evacuationAlerts,
    required this.broadcastLog,
    required this.stats,
    required this.emergencyFeatures,
    required this.sections,
  });

  final String section;
  final DateTime lastSyncedAt;
  final List<EmergencyIncident> incidents;
  final List<EvacuationAlert> evacuationAlerts;
  final List<EmergencyBroadcast> broadcastLog;
  final PanicEmergencyStats stats;
  final PanicEmergencyFeatureFlags emergencyFeatures;
  final List<String> sections;

  factory PanicEmergencySnapshot.fromJson(Map<String, dynamic> json) {
    return PanicEmergencySnapshot(
      section: json['section'] as String? ?? 'All',
      lastSyncedAt: DateTime.parse(json['lastSyncedAt'] as String),
      incidents: (json['incidents'] as List<dynamic>)
          .map(
            (item) => EmergencyIncident.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      evacuationAlerts: (json['evacuationAlerts'] as List<dynamic>)
          .map(
            (item) => EvacuationAlert.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      broadcastLog: (json['broadcastLog'] as List<dynamic>)
          .map(
            (item) => EmergencyBroadcast.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      stats: PanicEmergencyStats.fromJson(json['stats'] as Map<String, dynamic>),
      emergencyFeatures: PanicEmergencyFeatureFlags.fromJson(
        json['emergencyFeatures'] as Map<String, dynamic>,
      ),
      sections: (json['sections'] as List<dynamic>)
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class EmergencyIncident {
  const EmergencyIncident({
    required this.id,
    required this.emergencyType,
    required this.title,
    required this.section,
    required this.severity,
    required this.reportedAt,
    required this.reportedBy,
    required this.message,
    required this.status,
    required this.availableActions,
  });

  final String id;
  final String emergencyType;
  final String title;
  final String section;
  final String severity;
  final String reportedAt;
  final String reportedBy;
  final String message;
  final String status;
  final List<String> availableActions;

  factory EmergencyIncident.fromJson(Map<String, dynamic> json) {
    return EmergencyIncident(
      id: json['id'] as String,
      emergencyType: json['emergencyType'] as String? ?? 'general',
      title: json['title'] as String,
      section: json['section'] as String,
      severity: json['severity'] as String? ?? 'critical',
      reportedAt: json['reportedAt'] as String? ?? 'Just now',
      reportedBy: json['reportedBy'] as String? ?? 'System',
      message: json['message'] as String? ?? '',
      status: json['status'] as String? ?? 'active',
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class EvacuationAlert {
  const EvacuationAlert({
    required this.id,
    required this.zone,
    required this.section,
    required this.message,
    required this.status,
    required this.availableActions,
  });

  final String id;
  final String zone;
  final String section;
  final String message;
  final String status;
  final List<String> availableActions;

  factory EvacuationAlert.fromJson(Map<String, dynamic> json) {
    return EvacuationAlert(
      id: json['id'] as String,
      zone: json['zone'] as String? ?? 'Kitchen',
      section: json['section'] as String,
      message: json['message'] as String? ?? '',
      status: json['status'] as String? ?? 'standby',
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class EmergencyBroadcast {
  const EmergencyBroadcast({
    required this.id,
    required this.broadcastType,
    required this.message,
    required this.sentAt,
    required this.status,
  });

  final String id;
  final String broadcastType;
  final String message;
  final String sentAt;
  final String status;

  factory EmergencyBroadcast.fromJson(Map<String, dynamic> json) {
    return EmergencyBroadcast(
      id: json['id'] as String,
      broadcastType: json['broadcastType'] as String? ?? 'general',
      message: json['message'] as String? ?? '',
      sentAt: json['sentAt'] as String? ?? 'Just now',
      status: json['status'] as String? ?? 'sent',
    );
  }
}

class PanicEmergencyStats {
  const PanicEmergencyStats({
    required this.activeIncidents,
    required this.criticalIncidents,
    required this.evacuationsActive,
    required this.broadcastsToday,
    required this.panicTriggersToday,
    required this.resolvedToday,
  });

  final int activeIncidents;
  final int criticalIncidents;
  final int evacuationsActive;
  final int broadcastsToday;
  final int panicTriggersToday;
  final int resolvedToday;

  factory PanicEmergencyStats.fromJson(Map<String, dynamic> json) {
    return PanicEmergencyStats(
      activeIncidents: json['activeIncidents'] as int? ?? 0,
      criticalIncidents: json['criticalIncidents'] as int? ?? 0,
      evacuationsActive: json['evacuationsActive'] as int? ?? 0,
      broadcastsToday: json['broadcastsToday'] as int? ?? 0,
      panicTriggersToday: json['panicTriggersToday'] as int? ?? 0,
      resolvedToday: json['resolvedToday'] as int? ?? 0,
    );
  }
}

class PanicEmergencyFeatureFlags {
  const PanicEmergencyFeatureFlags({
    required this.fireEmergency,
    required this.gasLeakage,
    required this.equipmentBlast,
    required this.staffInjury,
    required this.foodContamination,
    required this.panicButton,
    required this.emergencyBroadcasts,
    required this.evacuationAlerts,
    required this.incidentEscalation,
  });

  final bool fireEmergency;
  final bool gasLeakage;
  final bool equipmentBlast;
  final bool staffInjury;
  final bool foodContamination;
  final bool panicButton;
  final bool emergencyBroadcasts;
  final bool evacuationAlerts;
  final bool incidentEscalation;

  factory PanicEmergencyFeatureFlags.fromJson(Map<String, dynamic> json) {
    return PanicEmergencyFeatureFlags(
      fireEmergency: json['fireEmergency'] as bool? ?? false,
      gasLeakage: json['gasLeakage'] as bool? ?? false,
      equipmentBlast: json['equipmentBlast'] as bool? ?? false,
      staffInjury: json['staffInjury'] as bool? ?? false,
      foodContamination: json['foodContamination'] as bool? ?? false,
      panicButton: json['panicButton'] as bool? ?? false,
      emergencyBroadcasts: json['emergencyBroadcasts'] as bool? ?? false,
      evacuationAlerts: json['evacuationAlerts'] as bool? ?? false,
      incidentEscalation: json['incidentEscalation'] as bool? ?? false,
    );
  }
}

class PanicEmergencyActionResult {
  const PanicEmergencyActionResult({
    required this.success,
    required this.message,
  });

  final bool success;
  final String message;

  factory PanicEmergencyActionResult.fromJson(Map<String, dynamic> json) {
    return PanicEmergencyActionResult(
      success: json['success'] as bool? ?? false,
      message: json['message'] as String? ?? 'Emergency action applied',
    );
  }
}
