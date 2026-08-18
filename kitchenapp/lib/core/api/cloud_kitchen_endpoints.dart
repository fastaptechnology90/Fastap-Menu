class CloudKitchenEndpoints {
  const CloudKitchenEndpoints._();

  static const board = '/cloud-kitchen/board';
  static const balanceLoad = '/cloud-kitchen/balance-load';

  static String orderAction(String orderId) =>
      '/cloud-kitchen/orders/$orderId/action';
}
