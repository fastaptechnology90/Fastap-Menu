class StaffShiftEndpoints {
  const StaffShiftEndpoints._();

  static const board = '/staff-shift/board';
  static const syncAll = '/staff-shift/sync/all';

  static String staffAction(String staffId) => '/staff-shift/staff/$staffId/action';

  static String swapAction(String swapId) => '/staff-shift/swaps/$swapId/action';

  static String handoverAction(String handoverId) =>
      '/staff-shift/handovers/$handoverId/action';
}
