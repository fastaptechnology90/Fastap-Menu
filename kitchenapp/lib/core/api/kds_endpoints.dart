class KdsEndpoints {
  const KdsEndpoints._();

  static const kds = '/kds';
  static String orderAction(String orderId) => '/kds/orders/$orderId/action';
  static const reorder = '/kds/reorder';
}
