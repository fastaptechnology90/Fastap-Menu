class DelayEscalationSnapshot {
  const DelayEscalationSnapshot({
    required this.section,
    required this.lastSyncedAt,
    required this.delayedOrders,
    required this.history,
    required this.escalations,
    required this.bottlenecks,
    required this.stats,
    required this.delayFeatures,
    required this.sections,
  });

  final String section;
  final DateTime lastSyncedAt;
  final List<DelayedOrder> delayedOrders;
  final List<DelayHistoryEntry> history;
  final List<EscalationAlert> escalations;
  final List<BottleneckInsight> bottlenecks;
  final DelayEscalationStats stats;
  final DelayFeatureFlags delayFeatures;
  final List<String> sections;

  factory DelayEscalationSnapshot.fromJson(Map<String, dynamic> json) {
    return DelayEscalationSnapshot(
      section: json['section'] as String? ?? 'All',
      lastSyncedAt: DateTime.parse(json['lastSyncedAt'] as String),
      delayedOrders: (json['delayedOrders'] as List<dynamic>)
          .map((item) => DelayedOrder.fromJson(item as Map<String, dynamic>))
          .toList(),
      history: (json['history'] as List<dynamic>)
          .map(
            (item) => DelayHistoryEntry.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      escalations: (json['escalations'] as List<dynamic>)
          .map((item) => EscalationAlert.fromJson(item as Map<String, dynamic>))
          .toList(),
      bottlenecks: (json['bottlenecks'] as List<dynamic>)
          .map(
            (item) => BottleneckInsight.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      stats: DelayEscalationStats.fromJson(json['stats'] as Map<String, dynamic>),
      delayFeatures: DelayFeatureFlags.fromJson(
        json['delayFeatures'] as Map<String, dynamic>,
      ),
      sections: (json['sections'] as List<dynamic>)
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class DelayedOrder {
  const DelayedOrder({
    required this.orderId,
    required this.kotNumber,
    required this.section,
    required this.location,
    required this.status,
    required this.delayMinutes,
    required this.timerLabel,
    required this.delayReason,
    required this.escalated,
    required this.escalationLevel,
    required this.availableActions,
  });

  final String orderId;
  final String kotNumber;
  final String section;
  final String location;
  final String status;
  final int delayMinutes;
  final String timerLabel;
  final String? delayReason;
  final bool escalated;
  final String? escalationLevel;
  final List<String> availableActions;

  factory DelayedOrder.fromJson(Map<String, dynamic> json) {
    return DelayedOrder(
      orderId: json['orderId'] as String,
      kotNumber: json['kotNumber'] as String,
      section: json['section'] as String,
      location: json['location'] as String,
      status: json['status'] as String,
      delayMinutes: json['delayMinutes'] as int? ?? 0,
      timerLabel: json['timerLabel'] as String? ?? '00:00',
      delayReason: json['delayReason'] as String?,
      escalated: json['escalated'] as bool? ?? false,
      escalationLevel: json['escalationLevel'] as String?,
      availableActions:
          (json['availableActions'] as List<dynamic>? ?? const [])
              .map((item) => item.toString())
              .toList(),
    );
  }
}

class DelayHistoryEntry {
  const DelayHistoryEntry({
    required this.id,
    required this.orderId,
    required this.kotNumber,
    required this.section,
    required this.reason,
    required this.loggedAt,
  });

  final String id;
  final String orderId;
  final String kotNumber;
  final String section;
  final String reason;
  final DateTime loggedAt;

  factory DelayHistoryEntry.fromJson(Map<String, dynamic> json) {
    return DelayHistoryEntry(
      id: json['id'] as String,
      orderId: json['orderId'] as String,
      kotNumber: json['kotNumber'] as String,
      section: json['section'] as String,
      reason: json['reason'] as String,
      loggedAt: DateTime.parse(json['loggedAt'] as String),
    );
  }
}

class EscalationAlert {
  const EscalationAlert({
    required this.id,
    required this.orderId,
    required this.kotNumber,
    required this.section,
    required this.level,
    required this.levelLabel,
    required this.reason,
    required this.updatedAt,
  });

  final String id;
  final String orderId;
  final String kotNumber;
  final String section;
  final String level;
  final String levelLabel;
  final String reason;
  final DateTime updatedAt;

  factory EscalationAlert.fromJson(Map<String, dynamic> json) {
    return EscalationAlert(
      id: json['id'] as String,
      orderId: json['orderId'] as String,
      kotNumber: json['kotNumber'] as String,
      section: json['section'] as String,
      level: json['level'] as String,
      levelLabel: json['levelLabel'] as String,
      reason: json['reason'] as String,
      updatedAt: DateTime.parse(json['updatedAt'] as String),
    );
  }
}

class BottleneckInsight {
  const BottleneckInsight({
    required this.section,
    required this.delayedOrders,
    required this.severity,
    required this.bottleneck,
  });

  final String section;
  final int delayedOrders;
  final String severity;
  final String bottleneck;

  factory BottleneckInsight.fromJson(Map<String, dynamic> json) {
    return BottleneckInsight(
      section: json['section'] as String,
      delayedOrders: json['delayedOrders'] as int,
      severity: json['severity'] as String,
      bottleneck: json['bottleneck'] as String,
    );
  }
}

class DelayEscalationStats {
  const DelayEscalationStats({
    required this.delayedOrders,
    required this.openEscalations,
    required this.historyEvents,
    required this.bottlenecks,
    required this.chefAlerts,
    required this.managerAlerts,
    required this.operationsAlerts,
  });

  final int delayedOrders;
  final int openEscalations;
  final int historyEvents;
  final int bottlenecks;
  final int chefAlerts;
  final int managerAlerts;
  final int operationsAlerts;

  factory DelayEscalationStats.fromJson(Map<String, dynamic> json) {
    return DelayEscalationStats(
      delayedOrders: json['delayedOrders'] as int? ?? 0,
      openEscalations: json['openEscalations'] as int? ?? 0,
      historyEvents: json['historyEvents'] as int? ?? 0,
      bottlenecks: json['bottlenecks'] as int? ?? 0,
      chefAlerts: json['chefAlerts'] as int? ?? 0,
      managerAlerts: json['managerAlerts'] as int? ?? 0,
      operationsAlerts: json['operationsAlerts'] as int? ?? 0,
    );
  }
}

class DelayFeatureFlags {
  const DelayFeatureFlags({
    required this.delayTimer,
    required this.delayReasonLogging,
    required this.autoEscalation,
    required this.delayHistory,
    required this.bottleneckDetection,
    required this.chefAlert,
    required this.kitchenManagerAlert,
    required this.operationsAlert,
  });

  final bool delayTimer;
  final bool delayReasonLogging;
  final bool autoEscalation;
  final bool delayHistory;
  final bool bottleneckDetection;
  final bool chefAlert;
  final bool kitchenManagerAlert;
  final bool operationsAlert;

  factory DelayFeatureFlags.fromJson(Map<String, dynamic> json) {
    return DelayFeatureFlags(
      delayTimer: json['delayTimer'] as bool? ?? false,
      delayReasonLogging: json['delayReasonLogging'] as bool? ?? false,
      autoEscalation: json['autoEscalation'] as bool? ?? false,
      delayHistory: json['delayHistory'] as bool? ?? false,
      bottleneckDetection: json['bottleneckDetection'] as bool? ?? false,
      chefAlert: json['chefAlert'] as bool? ?? false,
      kitchenManagerAlert: json['kitchenManagerAlert'] as bool? ?? false,
      operationsAlert: json['operationsAlert'] as bool? ?? false,
    );
  }
}

class DelayEscalationActionResult {
  const DelayEscalationActionResult({
    required this.success,
    required this.message,
  });

  final bool success;
  final String message;

  factory DelayEscalationActionResult.fromJson(Map<String, dynamic> json) {
    return DelayEscalationActionResult(
      success: json['success'] as bool? ?? false,
      message: json['message'] as String? ?? 'Delay action applied',
    );
  }
}
