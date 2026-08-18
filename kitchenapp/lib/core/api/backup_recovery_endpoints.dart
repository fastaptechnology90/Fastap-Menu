class BackupRecoveryEndpoints {
  const BackupRecoveryEndpoints._();

  static const board = '/backup-recovery/board';
  static const runAll = '/backup-recovery/run-all';

  static String autoBackupAction(String backupId) =>
      '/backup-recovery/auto/$backupId/action';

  static String manualBackupAction(String backupId) =>
      '/backup-recovery/manual/$backupId/action';

  static String cloudSyncAction(String syncId) =>
      '/backup-recovery/cloud/$syncId/action';

  static String restoreAction(String restoreId) =>
      '/backup-recovery/restores/$restoreId/action';

  static String dataRecoveryAction(String recoveryId) =>
      '/backup-recovery/recovery/$recoveryId/action';
}
