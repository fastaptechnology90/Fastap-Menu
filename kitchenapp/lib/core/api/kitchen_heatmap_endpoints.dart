class KitchenHeatmapEndpoints {
  const KitchenHeatmapEndpoints._();

  static const board = '/kitchen-heatmap/board';
  static const refreshAll = '/kitchen-heatmap/refresh-all';

  static String stationAction(String stationId) =>
      '/kitchen-heatmap/stations/$stationId/action';

  static String hotspotAction(String hotspotId) =>
      '/kitchen-heatmap/hotspots/$hotspotId/action';

  static String densityAction(String densityId) =>
      '/kitchen-heatmap/density/$densityId/action';

  static String rushAction(String rushId) => '/kitchen-heatmap/rush/$rushId/action';
}
