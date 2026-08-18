class OfflineFailoverSnapshot {
  const OfflineFailoverSnapshot({
    required this.section,
    required this.lastSyncedAt,
    required this.connectivityStatus,
    required this.offlineModules,
    required this.queuedItems,
    required this.recoveryJobs,
    required this.stats,
    required this.failoverFeatures,
    required this.sections,
  });

  final String section;
  final DateTime lastSyncedAt;
  final String connectivityStatus;
  final List<OfflineModuleStatus> offlineModules;
  final List<FailoverQueueItem> queuedItems;
  final List<QueueRecoveryJob> recoveryJobs;
  final OfflineFailoverStats stats;
  final OfflineFailoverFeatureFlags failoverFeatures;
  final List<String> sections;

  factory OfflineFailoverSnapshot.fromJson(Map<String, dynamic> json) {
    return OfflineFailoverSnapshot(
      section: json['section'] as String? ?? 'All',
      lastSyncedAt: DateTime.parse(json['lastSyncedAt'] as String),
      connectivityStatus: json['connectivityStatus'] as String? ?? 'online',
      offlineModules: (json['offlineModules'] as List<dynamic>)
          .map(
            (item) => OfflineModuleStatus.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      queuedItems: (json['queuedItems'] as List<dynamic>)
          .map(
            (item) => FailoverQueueItem.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      recoveryJobs: (json['recoveryJobs'] as List<dynamic>)
          .map(
            (item) => QueueRecoveryJob.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      stats: OfflineFailoverStats.fromJson(json['stats'] as Map<String, dynamic>),
      failoverFeatures: OfflineFailoverFeatureFlags.fromJson(
        json['failoverFeatures'] as Map<String, dynamic>,
      ),
      sections: (json['sections'] as List<dynamic>)
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class OfflineModuleStatus {
  const OfflineModuleStatus({
    required this.id,
    required this.moduleName,
    required this.moduleType,
    required this.section,
    required this.status,
    required this.lastSyncedAt,
    required this.pendingCount,
    required this.availableActions,
  });

  final String id;
  final String moduleName;
  final String moduleType;
  final String section;
  final String status;
  final String lastSyncedAt;
  final int pendingCount;
  final List<String> availableActions;

  factory OfflineModuleStatus.fromJson(Map<String, dynamic> json) {
    return OfflineModuleStatus(
      id: json['id'] as String,
      moduleName: json['moduleName'] as String,
      moduleType: json['moduleType'] as String? ?? 'general',
      section: json['section'] as String,
      status: json['status'] as String? ?? 'online',
      lastSyncedAt: json['lastSyncedAt'] as String? ?? 'Just now',
      pendingCount: json['pendingCount'] as int? ?? 0,
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class FailoverQueueItem {
  const FailoverQueueItem({
    required this.id,
    required this.itemType,
    required this.label,
    required this.section,
    required this.queuedAt,
    required this.status,
    required this.availableActions,
  });

  final String id;
  final String itemType;
  final String label;
  final String section;
  final String queuedAt;
  final String status;
  final List<String> availableActions;

  factory FailoverQueueItem.fromJson(Map<String, dynamic> json) {
    return FailoverQueueItem(
      id: json['id'] as String,
      itemType: json['itemType'] as String? ?? 'order',
      label: json['label'] as String,
      section: json['section'] as String,
      queuedAt: json['queuedAt'] as String? ?? 'Unknown',
      status: json['status'] as String? ?? 'pending',
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class QueueRecoveryJob {
  const QueueRecoveryJob({
    required this.id,
    required this.jobName,
    required this.section,
    required this.progress,
    required this.status,
    required this.availableActions,
  });

  final String id;
  final String jobName;
  final String section;
  final int progress;
  final String status;
  final List<String> availableActions;

  factory QueueRecoveryJob.fromJson(Map<String, dynamic> json) {
    return QueueRecoveryJob(
      id: json['id'] as String,
      jobName: json['jobName'] as String,
      section: json['section'] as String,
      progress: json['progress'] as int? ?? 0,
      status: json['status'] as String? ?? 'pending',
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class OfflineFailoverStats {
  const OfflineFailoverStats({
    required this.connectivityStatus,
    required this.offlineModulesCount,
    required this.pendingQueueItems,
    required this.activeRecoveryJobs,
    required this.syncedToday,
    required this.lastRestoreAt,
  });

  final String connectivityStatus;
  final int offlineModulesCount;
  final int pendingQueueItems;
  final int activeRecoveryJobs;
  final int syncedToday;
  final String lastRestoreAt;

  factory OfflineFailoverStats.fromJson(Map<String, dynamic> json) {
    return OfflineFailoverStats(
      connectivityStatus: json['connectivityStatus'] as String? ?? 'online',
      offlineModulesCount: json['offlineModulesCount'] as int? ?? 0,
      pendingQueueItems: json['pendingQueueItems'] as int? ?? 0,
      activeRecoveryJobs: json['activeRecoveryJobs'] as int? ?? 0,
      syncedToday: json['syncedToday'] as int? ?? 0,
      lastRestoreAt: json['lastRestoreAt'] as String? ?? 'Never',
    );
  }
}

class OfflineFailoverFeatureFlags {
  const OfflineFailoverFeatureFlags({
    required this.offlineKds,
    required this.offlineOrderSync,
    required this.offlinePrepTracking,
    required this.queueRecovery,
    required this.autoSyncRestoration,
  });

  final bool offlineKds;
  final bool offlineOrderSync;
  final bool offlinePrepTracking;
  final bool queueRecovery;
  final bool autoSyncRestoration;

  factory OfflineFailoverFeatureFlags.fromJson(Map<String, dynamic> json) {
    return OfflineFailoverFeatureFlags(
      offlineKds: json['offlineKds'] as bool? ?? false,
      offlineOrderSync: json['offlineOrderSync'] as bool? ?? false,
      offlinePrepTracking: json['offlinePrepTracking'] as bool? ?? false,
      queueRecovery: json['queueRecovery'] as bool? ?? false,
      autoSyncRestoration: json['autoSyncRestoration'] as bool? ?? false,
    );
  }
}

class OfflineFailoverActionResult {
  const OfflineFailoverActionResult({
    required this.success,
    required this.message,
  });

  final bool success;
  final String message;

  factory OfflineFailoverActionResult.fromJson(Map<String, dynamic> json) {
    return OfflineFailoverActionResult(
      success: json['success'] as bool? ?? false,
      message: json['message'] as String? ?? 'Offline failover action applied',
    );
  }
}
