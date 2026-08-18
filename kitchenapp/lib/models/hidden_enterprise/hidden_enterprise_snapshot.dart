class HiddenEnterpriseSnapshot {
  const HiddenEnterpriseSnapshot({
    required this.section,
    required this.lastSyncedAt,
    required this.softDeleteItems,
    required this.deletedOrders,
    required this.actionReplays,
    required this.versionLogs,
    required this.deviceTracking,
    required this.sessionLogs,
    required this.emergencyLockdowns,
    required this.queueRecoveries,
    required this.stats,
    required this.hiddenFeatures,
    required this.sections,
  });

  final String section;
  final DateTime lastSyncedAt;
  final List<SoftDeleteItem> softDeleteItems;
  final List<DeletedOrderRestore> deletedOrders;
  final List<ActionReplayEntry> actionReplays;
  final List<VersionLogEntry> versionLogs;
  final List<DeviceTrackingEntry> deviceTracking;
  final List<SessionLogEntry> sessionLogs;
  final List<EmergencyLockdownEntry> emergencyLockdowns;
  final List<QueueRecoveryEntry> queueRecoveries;
  final HiddenEnterpriseStats stats;
  final HiddenEnterpriseFeatureFlags hiddenFeatures;
  final List<String> sections;

  factory HiddenEnterpriseSnapshot.fromJson(Map<String, dynamic> json) {
    return HiddenEnterpriseSnapshot(
      section: json['section'] as String? ?? 'All',
      lastSyncedAt: DateTime.parse(json['lastSyncedAt'] as String),
      softDeleteItems: (json['softDeleteItems'] as List<dynamic>)
          .map((item) => SoftDeleteItem.fromJson(item as Map<String, dynamic>))
          .toList(),
      deletedOrders: (json['deletedOrders'] as List<dynamic>)
          .map(
            (item) => DeletedOrderRestore.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      actionReplays: (json['actionReplays'] as List<dynamic>)
          .map((item) => ActionReplayEntry.fromJson(item as Map<String, dynamic>))
          .toList(),
      versionLogs: (json['versionLogs'] as List<dynamic>)
          .map((item) => VersionLogEntry.fromJson(item as Map<String, dynamic>))
          .toList(),
      deviceTracking: (json['deviceTracking'] as List<dynamic>)
          .map(
            (item) => DeviceTrackingEntry.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      sessionLogs: (json['sessionLogs'] as List<dynamic>)
          .map((item) => SessionLogEntry.fromJson(item as Map<String, dynamic>))
          .toList(),
      emergencyLockdowns: (json['emergencyLockdowns'] as List<dynamic>)
          .map(
            (item) =>
                EmergencyLockdownEntry.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      queueRecoveries: (json['queueRecoveries'] as List<dynamic>)
          .map(
            (item) => QueueRecoveryEntry.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      stats: HiddenEnterpriseStats.fromJson(
        json['stats'] as Map<String, dynamic>,
      ),
      hiddenFeatures: HiddenEnterpriseFeatureFlags.fromJson(
        json['hiddenFeatures'] as Map<String, dynamic>,
      ),
      sections: (json['sections'] as List<dynamic>)
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class HiddenEnterpriseRecord {
  const HiddenEnterpriseRecord({
    required this.id,
    required this.title,
    required this.section,
    required this.detail,
    required this.status,
    required this.availableActions,
  });

  final String id;
  final String title;
  final String section;
  final String detail;
  final String status;
  final List<String> availableActions;
}

class SoftDeleteItem {
  const SoftDeleteItem({
    required this.id,
    required this.itemName,
    required this.section,
    required this.deletedAt,
    required this.retentionLabel,
    required this.status,
    required this.availableActions,
  });

  final String id;
  final String itemName;
  final String section;
  final String deletedAt;
  final String retentionLabel;
  final String status;
  final List<String> availableActions;

  factory SoftDeleteItem.fromJson(Map<String, dynamic> json) {
    return SoftDeleteItem(
      id: json['id'] as String,
      itemName: json['itemName'] as String,
      section: json['section'] as String,
      deletedAt: json['deletedAt'] as String? ?? 'Unknown',
      retentionLabel: json['retentionLabel'] as String? ?? '7 days',
      status: json['status'] as String? ?? 'recoverable',
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class DeletedOrderRestore {
  const DeletedOrderRestore({
    required this.id,
    required this.orderLabel,
    required this.section,
    required this.deletedAt,
    required this.orderType,
    required this.status,
    required this.availableActions,
  });

  final String id;
  final String orderLabel;
  final String section;
  final String deletedAt;
  final String orderType;
  final String status;
  final List<String> availableActions;

  factory DeletedOrderRestore.fromJson(Map<String, dynamic> json) {
    return DeletedOrderRestore(
      id: json['id'] as String,
      orderLabel: json['orderLabel'] as String,
      section: json['section'] as String,
      deletedAt: json['deletedAt'] as String? ?? 'Unknown',
      orderType: json['orderType'] as String? ?? 'Standard',
      status: json['status'] as String? ?? 'restorable',
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class ActionReplayEntry {
  const ActionReplayEntry({
    required this.id,
    required this.replayLabel,
    required this.section,
    required this.actorName,
    required this.stepCount,
    required this.status,
    required this.availableActions,
  });

  final String id;
  final String replayLabel;
  final String section;
  final String actorName;
  final int stepCount;
  final String status;
  final List<String> availableActions;

  factory ActionReplayEntry.fromJson(Map<String, dynamic> json) {
    return ActionReplayEntry(
      id: json['id'] as String,
      replayLabel: json['replayLabel'] as String,
      section: json['section'] as String,
      actorName: json['actorName'] as String? ?? 'System',
      stepCount: json['stepCount'] as int? ?? 0,
      status: json['status'] as String? ?? 'available',
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class VersionLogEntry {
  const VersionLogEntry({
    required this.id,
    required this.versionLabel,
    required this.section,
    required this.snapshotType,
    required this.createdAt,
    required this.status,
    required this.availableActions,
  });

  final String id;
  final String versionLabel;
  final String section;
  final String snapshotType;
  final String createdAt;
  final String status;
  final List<String> availableActions;

  factory VersionLogEntry.fromJson(Map<String, dynamic> json) {
    return VersionLogEntry(
      id: json['id'] as String,
      versionLabel: json['versionLabel'] as String,
      section: json['section'] as String,
      snapshotType: json['snapshotType'] as String? ?? 'Config',
      createdAt: json['createdAt'] as String? ?? 'Unknown',
      status: json['status'] as String? ?? 'archived',
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class DeviceTrackingEntry {
  const DeviceTrackingEntry({
    required this.id,
    required this.deviceName,
    required this.section,
    required this.lastSeen,
    required this.sessionLabel,
    required this.status,
    required this.availableActions,
  });

  final String id;
  final String deviceName;
  final String section;
  final String lastSeen;
  final String sessionLabel;
  final String status;
  final List<String> availableActions;

  factory DeviceTrackingEntry.fromJson(Map<String, dynamic> json) {
    return DeviceTrackingEntry(
      id: json['id'] as String,
      deviceName: json['deviceName'] as String,
      section: json['section'] as String,
      lastSeen: json['lastSeen'] as String? ?? 'Unknown',
      sessionLabel: json['sessionLabel'] as String? ?? 'Active',
      status: json['status'] as String? ?? 'tracked',
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class SessionLogEntry {
  const SessionLogEntry({
    required this.id,
    required this.sessionLabel,
    required this.section,
    required this.userName,
    required this.durationLabel,
    required this.status,
    required this.availableActions,
  });

  final String id;
  final String sessionLabel;
  final String section;
  final String userName;
  final String durationLabel;
  final String status;
  final List<String> availableActions;

  factory SessionLogEntry.fromJson(Map<String, dynamic> json) {
    return SessionLogEntry(
      id: json['id'] as String,
      sessionLabel: json['sessionLabel'] as String,
      section: json['section'] as String,
      userName: json['userName'] as String? ?? 'Unknown',
      durationLabel: json['durationLabel'] as String? ?? '0 min',
      status: json['status'] as String? ?? 'active',
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class EmergencyLockdownEntry {
  const EmergencyLockdownEntry({
    required this.id,
    required this.lockdownName,
    required this.section,
    required this.scopeLabel,
    required this.severity,
    required this.status,
    required this.availableActions,
  });

  final String id;
  final String lockdownName;
  final String section;
  final String scopeLabel;
  final String severity;
  final String status;
  final List<String> availableActions;

  factory EmergencyLockdownEntry.fromJson(Map<String, dynamic> json) {
    return EmergencyLockdownEntry(
      id: json['id'] as String,
      lockdownName: json['lockdownName'] as String,
      section: json['section'] as String,
      scopeLabel: json['scopeLabel'] as String? ?? 'Station',
      severity: json['severity'] as String? ?? 'high',
      status: json['status'] as String? ?? 'standby',
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class QueueRecoveryEntry {
  const QueueRecoveryEntry({
    required this.id,
    required this.queueName,
    required this.section,
    required this.ordersAffected,
    required this.recoveryMode,
    required this.status,
    required this.availableActions,
  });

  final String id;
  final String queueName;
  final String section;
  final int ordersAffected;
  final String recoveryMode;
  final String status;
  final List<String> availableActions;

  factory QueueRecoveryEntry.fromJson(Map<String, dynamic> json) {
    return QueueRecoveryEntry(
      id: json['id'] as String,
      queueName: json['queueName'] as String,
      section: json['section'] as String,
      ordersAffected: json['ordersAffected'] as int? ?? 0,
      recoveryMode: json['recoveryMode'] as String? ?? 'standard',
      status: json['status'] as String? ?? 'pending',
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class HiddenEnterpriseStats {
  const HiddenEnterpriseStats({
    required this.recoverableItems,
    required this.restorableOrders,
    required this.replayAvailable,
    required this.versionSnapshots,
    required this.trackedDevices,
    required this.activeSessions,
    required this.lockdownArmed,
    required this.queueRecoveries,
  });

  final int recoverableItems;
  final int restorableOrders;
  final int replayAvailable;
  final int versionSnapshots;
  final int trackedDevices;
  final int activeSessions;
  final int lockdownArmed;
  final int queueRecoveries;

  factory HiddenEnterpriseStats.fromJson(Map<String, dynamic> json) {
    return HiddenEnterpriseStats(
      recoverableItems: json['recoverableItems'] as int? ?? 0,
      restorableOrders: json['restorableOrders'] as int? ?? 0,
      replayAvailable: json['replayAvailable'] as int? ?? 0,
      versionSnapshots: json['versionSnapshots'] as int? ?? 0,
      trackedDevices: json['trackedDevices'] as int? ?? 0,
      activeSessions: json['activeSessions'] as int? ?? 0,
      lockdownArmed: json['lockdownArmed'] as int? ?? 0,
      queueRecoveries: json['queueRecoveries'] as int? ?? 0,
    );
  }
}

class HiddenEnterpriseFeatureFlags {
  const HiddenEnterpriseFeatureFlags({
    required this.softDeleteRecovery,
    required this.restoreDeletedOrders,
    required this.actionReplay,
    required this.versionLogs,
    required this.deviceTracking,
    required this.sessionLogs,
    required this.emergencyLockdownMode,
    required this.queueRecoveryEngine,
  });

  final bool softDeleteRecovery;
  final bool restoreDeletedOrders;
  final bool actionReplay;
  final bool versionLogs;
  final bool deviceTracking;
  final bool sessionLogs;
  final bool emergencyLockdownMode;
  final bool queueRecoveryEngine;

  factory HiddenEnterpriseFeatureFlags.fromJson(Map<String, dynamic> json) {
    return HiddenEnterpriseFeatureFlags(
      softDeleteRecovery: json['softDeleteRecovery'] as bool? ?? false,
      restoreDeletedOrders: json['restoreDeletedOrders'] as bool? ?? false,
      actionReplay: json['actionReplay'] as bool? ?? false,
      versionLogs: json['versionLogs'] as bool? ?? false,
      deviceTracking: json['deviceTracking'] as bool? ?? false,
      sessionLogs: json['sessionLogs'] as bool? ?? false,
      emergencyLockdownMode: json['emergencyLockdownMode'] as bool? ?? false,
      queueRecoveryEngine: json['queueRecoveryEngine'] as bool? ?? false,
    );
  }
}

class HiddenEnterpriseActionResult {
  const HiddenEnterpriseActionResult({
    required this.success,
    required this.message,
  });

  final bool success;
  final String message;

  factory HiddenEnterpriseActionResult.fromJson(Map<String, dynamic> json) {
    return HiddenEnterpriseActionResult(
      success: json['success'] as bool? ?? false,
      message: json['message'] as String? ?? 'Hidden action applied',
    );
  }
}
