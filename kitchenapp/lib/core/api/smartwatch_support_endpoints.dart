class SmartwatchSupportEndpoints {
  const SmartwatchSupportEndpoints._();

  static const board = '/smartwatch-support/board';
  static const pushAll = '/smartwatch-support/push-all';

  static String orderAlertAction(String alertId) =>
      '/smartwatch-support/orders/$alertId/action';

  static String delayAlertAction(String alertId) =>
      '/smartwatch-support/delays/$alertId/action';

  static String emergencyAlertAction(String alertId) =>
      '/smartwatch-support/emergency/$alertId/action';

  static String taskNotificationAction(String taskId) =>
      '/smartwatch-support/tasks/$taskId/action';
}
