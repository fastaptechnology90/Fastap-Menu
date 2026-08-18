class WaiterAutoAssignmentEndpoints {
  const WaiterAutoAssignmentEndpoints._();

  static const board = '/waiter-auto-assignment/board';
  static const autoAllocate = '/waiter-auto-assignment/auto-allocate';
  static const balanceWorkload = '/waiter-auto-assignment/balance-workload';

  static String taskAction(String taskId) =>
      '/waiter-auto-assignment/tasks/$taskId/action';

  static String notificationAction(String notificationId) =>
      '/waiter-auto-assignment/notifications/$notificationId/action';
}
