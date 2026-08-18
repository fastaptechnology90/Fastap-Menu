class IotDeviceEndpoints {
  const IotDeviceEndpoints._();

  static const board = '/iot/board';
  static const syncAll = '/iot/sync/all';

  static String deviceAction(String deviceId) => '/iot/devices/$deviceId/action';
}
