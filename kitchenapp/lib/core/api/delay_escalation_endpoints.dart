class DelayEscalationEndpoints {
  const DelayEscalationEndpoints._();

  static const board = '/delays/board';
  static const reason = '/delays/reason';
  static const autoEscalate = '/delays/auto-escalate';
  static String action(String orderId) => '/delays/$orderId/action';
}
