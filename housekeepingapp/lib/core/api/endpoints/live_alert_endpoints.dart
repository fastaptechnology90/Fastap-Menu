class LiveAlertEndpoints {
  const LiveAlertEndpoints._();

  static const board = '/live-alerts/board';
  static const syncAll = '/live-alerts/sync/all';

  static String alertAction(String alertId) => '/live-alerts/$alertId/action';
}
