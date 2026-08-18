class RoomServiceEndpoints {
  const RoomServiceEndpoints._();

  static const board = '/room-service/board';
  static const dispatchTray = '/room-service/trays/dispatch';

  static String orderAction(String orderId) =>
      '/room-service/orders/$orderId/action';
}
