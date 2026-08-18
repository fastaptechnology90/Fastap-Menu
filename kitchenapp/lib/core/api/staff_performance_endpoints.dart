class StaffPerformanceEndpoints {
  const StaffPerformanceEndpoints._();

  static const board = '/staff-performance/board';
  static const recalculate = '/staff-performance/recalculate';

  static String staffAction(String staffId) =>
      '/staff-performance/staff/$staffId/action';

  static String incentiveAction(String incentiveId) =>
      '/staff-performance/incentives/$incentiveId/action';
}
