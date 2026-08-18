import 'package:flutter_test/flutter_test.dart';

import 'package:kitchenapp/models/analytics_reporting/analytics_reporting_snapshot.dart';

void main() {
  test('analytics reporting snapshot parses API payload', () {
    final snapshot = AnalyticsReportingSnapshot.fromJson({
      'section': 'All',
      'lastSyncedAt': '2026-06-06T12:00:00.000',
      'sections': ['All', 'Main'],
      'kitchenReports': [
        {
          'id': 'RPT-DLY-001',
          'reportType': 'delay',
          'title': 'Delay report',
          'section': 'Main',
          'period': 'Today',
          'summary': '18 min avg delay',
          'metricLabel': 'Delay rate',
          'metricValue': '11%',
          'status': 'ready',
          'availableActions': ['export_report'],
        },
      ],
      'aiInsights': [
        {
          'id': 'AI-RUSH-001',
          'insightType': 'rush_prediction',
          'title': 'Rush prediction',
          'section': 'Main',
          'prediction': 'Rush in 22 min',
          'confidence': 87,
          'status': 'active',
          'availableActions': ['apply_insight'],
        },
      ],
      'stats': {
        'reportsReady': 1,
        'aiInsightsActive': 1,
        'avgProductivity': 0,
        'delayRate': 11,
        'wastePercent': 0,
        'peakHourLabel': '13:30',
      },
      'analyticsFeatures': {
        'preparationReports': false,
        'delayReports': true,
        'wasteReports': false,
        'productivityReports': false,
        'peakHourReports': false,
        'rushPrediction': true,
        'demandForecasting': false,
        'staffPrediction': false,
        'slowItemDetection': false,
      },
    });

    expect(snapshot.kitchenReports.length, 1);
    expect(snapshot.kitchenReports.first.reportType, 'delay');
    expect(snapshot.analyticsFeatures.rushPrediction, isTrue);
    expect(snapshot.stats.delayRate, 11);
  });
}
