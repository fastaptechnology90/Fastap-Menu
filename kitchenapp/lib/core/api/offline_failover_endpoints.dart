class OfflineFailoverEndpoints {
  const OfflineFailoverEndpoints._();

  static const board = '/offline-failover/board';
  static const restoreSync = '/offline-failover/restore-sync';
  static const syncAll = '/offline-failover/sync/all';

  static String moduleAction(String moduleId) =>
      '/offline-failover/modules/$moduleId/action';

  static String queueAction(String queueId) =>
      '/offline-failover/queue/$queueId/action';

  static String recoveryAction(String recoveryId) =>
      '/offline-failover/recovery/$recoveryId/action';
}
