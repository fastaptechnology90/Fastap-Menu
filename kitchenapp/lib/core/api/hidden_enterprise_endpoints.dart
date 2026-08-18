class HiddenEnterpriseEndpoints {
  const HiddenEnterpriseEndpoints._();

  static const board = '/hidden-enterprise/board';
  static const activateAll = '/hidden-enterprise/activate-all';

  static String softDeleteAction(String itemId) =>
      '/hidden-enterprise/soft-delete/$itemId/action';

  static String deletedOrderAction(String orderId) =>
      '/hidden-enterprise/orders/$orderId/action';

  static String actionReplayAction(String replayId) =>
      '/hidden-enterprise/replays/$replayId/action';

  static String versionLogAction(String versionId) =>
      '/hidden-enterprise/versions/$versionId/action';

  static String deviceTrackingAction(String deviceId) =>
      '/hidden-enterprise/devices/$deviceId/action';

  static String sessionLogAction(String sessionId) =>
      '/hidden-enterprise/sessions/$sessionId/action';

  static String lockdownAction(String lockdownId) =>
      '/hidden-enterprise/lockdown/$lockdownId/action';

  static String queueRecoveryAction(String queueId) =>
      '/hidden-enterprise/queue/$queueId/action';
}
