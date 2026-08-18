import '../kitchen_order.dart';
import 'dashboard_metric_item.dart';
import 'dashboard_widget_item.dart';
import 'rush_alert.dart';
import 'section_workload.dart';

class DashboardSnapshot {
  const DashboardSnapshot({
    required this.section,
    required this.lastSyncedAt,
    required this.sections,
    required this.widgets,
    required this.metrics,
    required this.sectionWorkload,
    required this.rushAlerts,
    required this.orders,
  });

  final String section;
  final DateTime lastSyncedAt;
  final List<String> sections;
  final List<DashboardWidgetItem> widgets;
  final List<DashboardMetricItem> metrics;
  final List<SectionWorkload> sectionWorkload;
  final List<RushAlert> rushAlerts;
  final List<KitchenOrder> orders;

  factory DashboardSnapshot.fromJson(Map<String, dynamic> json) {
    return DashboardSnapshot(
      section: json['section'] as String? ?? 'All',
      lastSyncedAt: DateTime.tryParse(json['lastSyncedAt'] as String? ?? '') ??
          DateTime.now(),
      sections: _stringList(json['sections']),
      widgets: _mapList(json['widgets'], DashboardWidgetItem.fromJson),
      metrics: _mapList(json['metrics'], DashboardMetricItem.fromJson),
      sectionWorkload:
          _mapList(json['sectionWorkload'], SectionWorkload.fromJson),
      rushAlerts: _mapList(json['rushAlerts'], RushAlert.fromJson),
      orders: _mapList(json['orders'], KitchenOrder.fromJson),
    );
  }

  static List<String> _stringList(dynamic value) {
    if (value is! List) return const ['All'];
    return value.map((item) => item.toString()).toList();
  }

  static List<T> _mapList<T>(
    dynamic value,
    T Function(Map<String, dynamic>) parse,
  ) {
    if (value is! List) return const [];
    final parsed = <T>[];
    for (final item in value) {
      if (item is! Map<String, dynamic>) continue;
      try {
        parsed.add(parse(item));
      } catch (_) {
        // Skip malformed rows so one bad order does not blank the dashboard.
      }
    }
    return parsed;
  }
}
