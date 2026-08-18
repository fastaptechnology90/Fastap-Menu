class BackupRecoverySnapshot {
  const BackupRecoverySnapshot({
    required this.section,
    required this.lastSyncedAt,
    required this.autoBackups,
    required this.manualBackups,
    required this.cloudSyncJobs,
    required this.recoveryRestores,
    required this.dataRecoveryTasks,
    required this.stats,
    required this.backupFeatures,
    required this.sections,
  });

  final String section;
  final DateTime lastSyncedAt;
  final List<AutoBackupJob> autoBackups;
  final List<ManualBackupJob> manualBackups;
  final List<CloudSyncJob> cloudSyncJobs;
  final List<RecoveryRestorePoint> recoveryRestores;
  final List<DataRecoveryTask> dataRecoveryTasks;
  final BackupRecoveryStats stats;
  final BackupRecoveryFeatureFlags backupFeatures;
  final List<String> sections;

  factory BackupRecoverySnapshot.fromJson(Map<String, dynamic> json) {
    return BackupRecoverySnapshot(
      section: json['section'] as String? ?? 'All',
      lastSyncedAt: DateTime.parse(json['lastSyncedAt'] as String),
      autoBackups: (json['autoBackups'] as List<dynamic>)
          .map((item) => AutoBackupJob.fromJson(item as Map<String, dynamic>))
          .toList(),
      manualBackups: (json['manualBackups'] as List<dynamic>)
          .map((item) => ManualBackupJob.fromJson(item as Map<String, dynamic>))
          .toList(),
      cloudSyncJobs: (json['cloudSyncJobs'] as List<dynamic>)
          .map((item) => CloudSyncJob.fromJson(item as Map<String, dynamic>))
          .toList(),
      recoveryRestores: (json['recoveryRestores'] as List<dynamic>)
          .map(
            (item) =>
                RecoveryRestorePoint.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      dataRecoveryTasks: (json['dataRecoveryTasks'] as List<dynamic>)
          .map((item) => DataRecoveryTask.fromJson(item as Map<String, dynamic>))
          .toList(),
      stats: BackupRecoveryStats.fromJson(
        json['stats'] as Map<String, dynamic>,
      ),
      backupFeatures: BackupRecoveryFeatureFlags.fromJson(
        json['backupFeatures'] as Map<String, dynamic>,
      ),
      sections: (json['sections'] as List<dynamic>)
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class AutoBackupJob {
  const AutoBackupJob({
    required this.id,
    required this.jobName,
    required this.section,
    required this.scheduleLabel,
    required this.lastRunLabel,
    required this.status,
    required this.availableActions,
  });

  final String id;
  final String jobName;
  final String section;
  final String scheduleLabel;
  final String lastRunLabel;
  final String status;
  final List<String> availableActions;

  factory AutoBackupJob.fromJson(Map<String, dynamic> json) {
    return AutoBackupJob(
      id: json['id'] as String,
      jobName: json['jobName'] as String,
      section: json['section'] as String,
      scheduleLabel: json['scheduleLabel'] as String? ?? 'Daily',
      lastRunLabel: json['lastRunLabel'] as String? ?? 'Never',
      status: json['status'] as String? ?? 'idle',
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class ManualBackupJob {
  const ManualBackupJob({
    required this.id,
    required this.backupName,
    required this.section,
    required this.sizeLabel,
    required this.requestedBy,
    required this.status,
    required this.availableActions,
  });

  final String id;
  final String backupName;
  final String section;
  final String sizeLabel;
  final String requestedBy;
  final String status;
  final List<String> availableActions;

  factory ManualBackupJob.fromJson(Map<String, dynamic> json) {
    return ManualBackupJob(
      id: json['id'] as String,
      backupName: json['backupName'] as String,
      section: json['section'] as String,
      sizeLabel: json['sizeLabel'] as String? ?? '0 MB',
      requestedBy: json['requestedBy'] as String? ?? 'System',
      status: json['status'] as String? ?? 'pending',
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class CloudSyncJob {
  const CloudSyncJob({
    required this.id,
    required this.syncName,
    required this.section,
    required this.destination,
    required this.lagMinutes,
    required this.status,
    required this.availableActions,
  });

  final String id;
  final String syncName;
  final String section;
  final String destination;
  final int lagMinutes;
  final String status;
  final List<String> availableActions;

  factory CloudSyncJob.fromJson(Map<String, dynamic> json) {
    return CloudSyncJob(
      id: json['id'] as String,
      syncName: json['syncName'] as String,
      section: json['section'] as String,
      destination: json['destination'] as String? ?? 'Cloud',
      lagMinutes: json['lagMinutes'] as int? ?? 0,
      status: json['status'] as String? ?? 'idle',
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class RecoveryRestorePoint {
  const RecoveryRestorePoint({
    required this.id,
    required this.restoreLabel,
    required this.section,
    required this.createdAt,
    required this.integrity,
    required this.status,
    required this.availableActions,
  });

  final String id;
  final String restoreLabel;
  final String section;
  final String createdAt;
  final String integrity;
  final String status;
  final List<String> availableActions;

  factory RecoveryRestorePoint.fromJson(Map<String, dynamic> json) {
    return RecoveryRestorePoint(
      id: json['id'] as String,
      restoreLabel: json['restoreLabel'] as String,
      section: json['section'] as String,
      createdAt: json['createdAt'] as String? ?? 'Unknown',
      integrity: json['integrity'] as String? ?? 'verified',
      status: json['status'] as String? ?? 'available',
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class DataRecoveryTask {
  const DataRecoveryTask({
    required this.id,
    required this.taskName,
    required this.section,
    required this.dataScope,
    required this.priority,
    required this.status,
    required this.availableActions,
  });

  final String id;
  final String taskName;
  final String section;
  final String dataScope;
  final String priority;
  final String status;
  final List<String> availableActions;

  factory DataRecoveryTask.fromJson(Map<String, dynamic> json) {
    return DataRecoveryTask(
      id: json['id'] as String,
      taskName: json['taskName'] as String,
      section: json['section'] as String,
      dataScope: json['dataScope'] as String? ?? 'General',
      priority: json['priority'] as String? ?? 'medium',
      status: json['status'] as String? ?? 'queued',
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class BackupRecoveryStats {
  const BackupRecoveryStats({
    required this.activeAutoBackups,
    required this.pendingManualBackups,
    required this.cloudSyncLagMinutes,
    required this.availableRestorePoints,
    required this.activeRecoveries,
    required this.completedToday,
  });

  final int activeAutoBackups;
  final int pendingManualBackups;
  final int cloudSyncLagMinutes;
  final int availableRestorePoints;
  final int activeRecoveries;
  final int completedToday;

  factory BackupRecoveryStats.fromJson(Map<String, dynamic> json) {
    return BackupRecoveryStats(
      activeAutoBackups: json['activeAutoBackups'] as int? ?? 0,
      pendingManualBackups: json['pendingManualBackups'] as int? ?? 0,
      cloudSyncLagMinutes: json['cloudSyncLagMinutes'] as int? ?? 0,
      availableRestorePoints: json['availableRestorePoints'] as int? ?? 0,
      activeRecoveries: json['activeRecoveries'] as int? ?? 0,
      completedToday: json['completedToday'] as int? ?? 0,
    );
  }
}

class BackupRecoveryFeatureFlags {
  const BackupRecoveryFeatureFlags({
    required this.autoBackup,
    required this.manualBackup,
    required this.cloudSynchronization,
    required this.recoveryRestore,
    required this.dataRecovery,
  });

  final bool autoBackup;
  final bool manualBackup;
  final bool cloudSynchronization;
  final bool recoveryRestore;
  final bool dataRecovery;

  factory BackupRecoveryFeatureFlags.fromJson(Map<String, dynamic> json) {
    return BackupRecoveryFeatureFlags(
      autoBackup: json['autoBackup'] as bool? ?? false,
      manualBackup: json['manualBackup'] as bool? ?? false,
      cloudSynchronization: json['cloudSynchronization'] as bool? ?? false,
      recoveryRestore: json['recoveryRestore'] as bool? ?? false,
      dataRecovery: json['dataRecovery'] as bool? ?? false,
    );
  }
}

class BackupRecoveryActionResult {
  const BackupRecoveryActionResult({
    required this.success,
    required this.message,
  });

  final bool success;
  final String message;

  factory BackupRecoveryActionResult.fromJson(Map<String, dynamic> json) {
    return BackupRecoveryActionResult(
      success: json['success'] as bool? ?? false,
      message: json['message'] as String? ?? 'Backup action applied',
    );
  }
}
