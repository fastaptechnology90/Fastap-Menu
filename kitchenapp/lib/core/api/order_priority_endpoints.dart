class OrderPriorityEndpoints {
  const OrderPriorityEndpoints._();

  static const board = '/orders/priority';
  static const reprioritize = '/orders/priority/reprioritize';
  static String action(String orderId) => '/orders/$orderId/priority';
}
