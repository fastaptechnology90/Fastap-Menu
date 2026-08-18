class BanquetEndpoints {
  const BanquetEndpoints._();

  static const board = '/banquet/board';
  static const startSchedule = '/banquet/schedule/start';

  static String eventAction(String eventId) => '/banquet/events/$eventId/action';
}
