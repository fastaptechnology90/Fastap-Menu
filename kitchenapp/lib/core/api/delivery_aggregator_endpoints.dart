class DeliveryAggregatorEndpoints {

  const DeliveryAggregatorEndpoints._();



  static const board = '/aggregator/board';

  static const syncAll = '/aggregator/sync-all';

  static String orderAction(String orderId) => '/aggregator/orders/$orderId/action';

}

