class PrepStationEndpoints {
  const PrepStationEndpoints._();

  static const board = '/prep/stations';
  static const balance = '/prep/stations/balance';
  static String action(String stationId) => '/prep/stations/$stationId/action';
  static String assign(String stationId) => '/prep/stations/$stationId/assign';
}
