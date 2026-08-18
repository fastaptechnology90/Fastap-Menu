class StaffWellnessEndpoints {
  const StaffWellnessEndpoints._();

  static const board = '/staff-wellness/board';
  static const runScan = '/staff-wellness/run-scan';

  static String alertAction(String alertId) =>
      '/staff-wellness/alerts/$alertId/action';

  static String recommendationAction(String recommendationId) =>
      '/staff-wellness/recommendations/$recommendationId/action';
}
