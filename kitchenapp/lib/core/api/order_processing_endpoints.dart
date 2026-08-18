class OrderProcessingEndpoints {
  const OrderProcessingEndpoints._();

  static const processing = '/orders/processing';
  static const optimize = '/orders/processing/optimize';
  static String process(String orderId) => '/orders/$orderId/process';
}
