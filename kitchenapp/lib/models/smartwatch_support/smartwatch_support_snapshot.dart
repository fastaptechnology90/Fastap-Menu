class SmartwatchSupportSnapshot {
  const SmartwatchSupportSnapshot({
    required this.section,
    required this.lastSyncedAt,
    required this.orderAlerts,
    required this.delayAlerts,
    required this.emergencyAlerts,
    required this.taskNotifications,
    required this.stats,
    required this.smartwatchFeatures,
    required this.sections,
  });

  final String section;
  final DateTime lastSyncedAt;
  final List<WatchOrderAlert> orderAlerts;
  final List<WatchDelayAlert> delayAlerts;
  final List<WatchEmergencyAlert> emergencyAlerts;
  final List<WatchTaskNotification> taskNotifications;
  final SmartwatchSupportStats stats;
  final SmartwatchSupportFeatureFlags smartwatchFeatures;
  final List<String> sections;

  factory SmartwatchSupportSnapshot.fromJson(Map<String, dynamic> json) {
    return SmartwatchSupportSnapshot(
      section: json['section'] as String? ?? 'All',
      lastSyncedAt: DateTime.parse(json['lastSyncedAt'] as String),
      orderAlerts: (json['orderAlerts'] as List<dynamic>)
          .map((item) => WatchOrderAlert.fromJson(item as Map<String, dynamic>))
          .toList(),
      delayAlerts: (json['delayAlerts'] as List<dynamic>)
          .map((item) => WatchDelayAlert.fromJson(item as Map<String, dynamic>))
          .toList(),
      emergencyAlerts: (json['emergencyAlerts'] as List<dynamic>)
          .map(
            (item) =>
                WatchEmergencyAlert.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      taskNotifications: (json['taskNotifications'] as List<dynamic>)
          .map(
            (item) =>
                WatchTaskNotification.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      stats: SmartwatchSupportStats.fromJson(
        json['stats'] as Map<String, dynamic>,
      ),
      smartwatchFeatures: SmartwatchSupportFeatureFlags.fromJson(
        json['smartwatchFeatures'] as Map<String, dynamic>,
      ),
      sections: (json['sections'] as List<dynamic>)
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class WatchOrderAlert {
  const WatchOrderAlert({
    required this.id,
    required this.title,
    required this.section,
    required this.priority,
    required this.recipient,
    required this.status,
    required this.availableActions,
  });

  final String id;
  final String title;
  final String section;
  final String priority;
  final String recipient;
  final String status;
  final List<String> availableActions;

  factory WatchOrderAlert.fromJson(Map<String, dynamic> json) {
    return WatchOrderAlert(
      id: json['id'] as String,
      title: json['title'] as String,
      section: json['section'] as String,
      priority: json['priority'] as String? ?? 'medium',
      recipient: json['recipient'] as String? ?? 'Kitchen team',
      status: json['status'] as String? ?? 'pending',
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class WatchDelayAlert {
  const WatchDelayAlert({
    required this.id,
    required this.title,
    required this.section,
    required this.delayMinutes,
    required this.severity,
    required this.status,
    required this.availableActions,
  });

  final String id;
  final String title;
  final String section;
  final int delayMinutes;
  final String severity;
  final String status;
  final List<String> availableActions;

  factory WatchDelayAlert.fromJson(Map<String, dynamic> json) {
    return WatchDelayAlert(
      id: json['id'] as String,
      title: json['title'] as String,
      section: json['section'] as String,
      delayMinutes: json['delayMinutes'] as int? ?? 0,
      severity: json['severity'] as String? ?? 'medium',
      status: json['status'] as String? ?? 'active',
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class WatchEmergencyAlert {
  const WatchEmergencyAlert({
    required this.id,
    required this.title,
    required this.section,
    required this.alertType,
    required this.severity,
    required this.status,
    required this.availableActions,
  });

  final String id;
  final String title;
  final String section;
  final String alertType;
  final String severity;
  final String status;
  final List<String> availableActions;

  factory WatchEmergencyAlert.fromJson(Map<String, dynamic> json) {
    return WatchEmergencyAlert(
      id: json['id'] as String,
      title: json['title'] as String,
      section: json['section'] as String,
      alertType: json['alertType'] as String? ?? 'emergency',
      severity: json['severity'] as String? ?? 'high',
      status: json['status'] as String? ?? 'active',
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class WatchTaskNotification {
  const WatchTaskNotification({
    required this.id,
    required this.title,
    required this.section,
    required this.assignee,
    required this.dueLabel,
    required this.status,
    required this.availableActions,
  });

  final String id;
  final String title;
  final String section;
  final String assignee;
  final String dueLabel;
  final String status;
  final List<String> availableActions;

  factory WatchTaskNotification.fromJson(Map<String, dynamic> json) {
    return WatchTaskNotification(
      id: json['id'] as String,
      title: json['title'] as String,
      section: json['section'] as String,
      assignee: json['assignee'] as String? ?? 'Unassigned',
      dueLabel: json['dueLabel'] as String? ?? 'Soon',
      status: json['status'] as String? ?? 'pending',
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class SmartwatchSupportStats {
  const SmartwatchSupportStats({
    required this.activeOrderAlerts,
    required this.activeDelayAlerts,
    required this.emergencyActive,
    required this.pendingTasks,
    required this.watchesConnected,
    required this.pushedToday,
  });

  final int activeOrderAlerts;
  final int activeDelayAlerts;
  final int emergencyActive;
  final int pendingTasks;
  final int watchesConnected;
  final int pushedToday;

  factory SmartwatchSupportStats.fromJson(Map<String, dynamic> json) {
    return SmartwatchSupportStats(
      activeOrderAlerts: json['activeOrderAlerts'] as int? ?? 0,
      activeDelayAlerts: json['activeDelayAlerts'] as int? ?? 0,
      emergencyActive: json['emergencyActive'] as int? ?? 0,
      pendingTasks: json['pendingTasks'] as int? ?? 0,
      watchesConnected: json['watchesConnected'] as int? ?? 0,
      pushedToday: json['pushedToday'] as int? ?? 0,
    );
  }
}

class SmartwatchSupportFeatureFlags {
  const SmartwatchSupportFeatureFlags({
    required this.orderAlerts,
    required this.delayAlerts,
    required this.emergencyAlerts,
    required this.taskNotifications,
  });

  final bool orderAlerts;
  final bool delayAlerts;
  final bool emergencyAlerts;
  final bool taskNotifications;

  factory SmartwatchSupportFeatureFlags.fromJson(Map<String, dynamic> json) {
    return SmartwatchSupportFeatureFlags(
      orderAlerts: json['orderAlerts'] as bool? ?? false,
      delayAlerts: json['delayAlerts'] as bool? ?? false,
      emergencyAlerts: json['emergencyAlerts'] as bool? ?? false,
      taskNotifications: json['taskNotifications'] as bool? ?? false,
    );
  }
}

class SmartwatchSupportActionResult {
  const SmartwatchSupportActionResult({
    required this.success,
    required this.message,
  });

  final bool success;
  final String message;

  factory SmartwatchSupportActionResult.fromJson(Map<String, dynamic> json) {
    return SmartwatchSupportActionResult(
      success: json['success'] as bool? ?? false,
      message: json['message'] as String? ?? 'Smartwatch action applied',
    );
  }
}
