class ModifierEndpoints {
  const ModifierEndpoints._();

  static const board = '/modifiers/board';
  static String orderAction(String orderId) =>
      '/modifiers/orders/$orderId/action';
}
