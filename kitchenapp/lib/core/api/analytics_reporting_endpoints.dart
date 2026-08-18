class AnalyticsReportingEndpoints {
  const AnalyticsReportingEndpoints._();

  static const board = '/analytics-reporting/board';
  static const generateAll = '/analytics-reporting/generate-all';

  static String reportAction(String reportId) =>
      '/analytics-reporting/reports/$reportId/action';

  static String insightAction(String insightId) =>
      '/analytics-reporting/insights/$insightId/action';
}
