/// Canonical feature list for System 2 · Kitchen Dashboard.
class KitchenDashboardCatalog {
  const KitchenDashboardCatalog._();

  static const title = 'Kitchen Dashboard System';

  static const dashboardWidgets = [
    'Active orders',
    'Delayed orders',
    'VIP orders',
    'Priority orders',
    'Section workload',
    'Staff availability',
    'Pending KOTs',
    'Completed orders',
    'Rejected orders',
    'Rush alerts',
  ];

  static const realtimeMetrics = [
    'Kitchen efficiency',
    'Average preparation time',
    'Delay ratio',
    'Order backlog',
    'Peak kitchen load',
    'Staff productivity',
    'Live preparation speed',
  ];

  static const dashboardWidgetCount = 10;
  static const realtimeMetricCount = 7;
}
