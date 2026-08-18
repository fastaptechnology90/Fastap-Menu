import 'mock_section_registry.dart';

class MockAnalyticsReportingRegistry {
  MockAnalyticsReportingRegistry._();

  static final List<Map<String, dynamic>> _reports = _seedReports();
  static final List<Map<String, dynamic>> _insights = _seedInsights();

  static List<Map<String, dynamic>> reportsFor(String section) {
    if (section == 'All') {
      return _reports.map(_serializeReport).toList();
    }
    return _reports
        .where((item) => item['section'] == section)
        .map(_serializeReport)
        .toList();
  }

  static List<Map<String, dynamic>> insightsFor(String section) {
    if (section == 'All') {
      return _insights.map(_serializeInsight).toList();
    }
    return _insights
        .where((item) => item['section'] == section)
        .map(_serializeInsight)
        .toList();
  }

  static Map<String, dynamic> performReportAction({
    required String reportId,
    required String action,
  }) {
    final report = _findReport(reportId);
    if (report == null) {
      throw ArgumentError('Kitchen report not found');
    }

    final title = report['title'] as String;

    switch (action) {
      case 'view_report':
        report['status'] = 'viewed';
        return {
          'success': true,
          'message': 'Report opened · $title',
        };
      case 'export_report':
        report['status'] = 'exported';
        return {
          'success': true,
          'message': 'Report exported · $title',
        };
      case 'schedule_report':
        report['status'] = 'scheduled';
        return {
          'success': true,
          'message': 'Report scheduled · $title',
        };
      case 'acknowledge_report':
        report['status'] = 'acknowledged';
        return {
          'success': true,
          'message': 'Report acknowledged · $title',
        };
      default:
        throw ArgumentError('Unknown report action: $action');
    }
  }

  static Map<String, dynamic> performInsightAction({
    required String insightId,
    required String action,
  }) {
    final insight = _findInsight(insightId);
    if (insight == null) {
      throw ArgumentError('AI insight not found');
    }

    final title = insight['title'] as String;

    switch (action) {
      case 'apply_insight':
        insight['status'] = 'applied';
        return {
          'success': true,
          'message': 'AI insight applied · $title',
        };
      case 'dismiss_insight':
        insight['status'] = 'dismissed';
        return {
          'success': true,
          'message': 'AI insight dismissed · $title',
        };
      case 'refresh_prediction':
        insight['confidence'] = ((insight['confidence'] as int) + 3).clamp(0, 99);
        insight['status'] = 'refreshed';
        return {
          'success': true,
          'message': 'Prediction refreshed · $title',
        };
      default:
        throw ArgumentError('Unknown insight action: $action');
    }
  }

  static Map<String, dynamic> generateAll() {
    for (final report in _reports) {
      report['status'] = 'ready';
    }
    for (final insight in _insights) {
      if (insight['status'] != 'applied') {
        insight['status'] = 'active';
        insight['confidence'] = ((insight['confidence'] as int) + 1).clamp(0, 99);
      }
    }
    return {
      'success': true,
      'message':
          'Analytics regenerated · ${_reports.length} reports · ${_insights.length} AI insights',
    };
  }

  static Map<String, dynamic>? _findReport(String reportId) {
    for (final report in _reports) {
      if (report['id'] == reportId) {
        return report;
      }
    }
    return null;
  }

  static Map<String, dynamic>? _findInsight(String insightId) {
    for (final insight in _insights) {
      if (insight['id'] == insightId) {
        return insight;
      }
    }
    return null;
  }

  static Map<String, dynamic> _serializeReport(Map<String, dynamic> report) {
    return {
      'id': report['id'],
      'reportType': report['reportType'],
      'title': report['title'],
      'section': report['section'],
      'period': report['period'],
      'summary': report['summary'],
      'metricLabel': report['metricLabel'],
      'metricValue': report['metricValue'],
      'status': report['status'],
      'availableActions': _reportActions(report),
    };
  }

  static List<String> _reportActions(Map<String, dynamic> report) {
    return [
      'view_report',
      'export_report',
      'schedule_report',
      'acknowledge_report',
    ];
  }

  static Map<String, dynamic> _serializeInsight(Map<String, dynamic> insight) {
    return {
      'id': insight['id'],
      'insightType': insight['insightType'],
      'title': insight['title'],
      'section': insight['section'],
      'prediction': insight['prediction'],
      'confidence': insight['confidence'],
      'status': insight['status'],
      'availableActions': insight['status'] == 'dismissed'
          ? <String>[]
          : ['apply_insight', 'dismiss_insight', 'refresh_prediction'],
    };
  }

  static List<Map<String, dynamic>> _seedReports() {
    return [
      {
        'id': 'RPT-PREP-001',
        'reportType': 'preparation',
        'title': 'Preparation report',
        'section': 'Main',
        'period': 'Today',
        'summary': 'Prep batches completed ahead of lunch rush',
        'metricLabel': 'Prep completion',
        'metricValue': '92%',
        'status': 'ready',
      },
      {
        'id': 'RPT-DLY-001',
        'reportType': 'delay',
        'title': 'Delay report',
        'section': 'Main',
        'period': 'Today',
        'summary': '18 min avg delay · 4 re-fire tickets',
        'metricLabel': 'Delay rate',
        'metricValue': '11%',
        'status': 'ready',
      },
      {
        'id': 'RPT-WST-001',
        'reportType': 'waste',
        'title': 'Waste report',
        'section': 'Continental',
        'period': 'Today',
        'summary': 'Sauce batch discard · prep overproduction',
        'metricLabel': 'Waste',
        'metricValue': '6.4%',
        'status': 'ready',
      },
      {
        'id': 'RPT-PRD-001',
        'reportType': 'productivity',
        'title': 'Productivity report',
        'section': 'Tandoor',
        'period': 'Today',
        'summary': 'Highest section output · naan throughput up',
        'metricLabel': 'Productivity',
        'metricValue': '93',
        'status': 'ready',
      },
      {
        'id': 'RPT-PEAK-001',
        'reportType': 'peak_hour',
        'title': 'Peak hour report',
        'section': 'All',
        'period': 'Today',
        'summary': 'Rush window 13:00–14:30 · 148 covers',
        'metricLabel': 'Peak hour',
        'metricValue': '13:30',
        'status': 'ready',
      },
    ];
  }

  static List<Map<String, dynamic>> _seedInsights() {
    return [
      {
        'id': 'AI-RUSH-001',
        'insightType': 'rush_prediction',
        'title': 'Rush prediction',
        'section': 'Main',
        'prediction': 'Rush in 22 min · add 1 grill chef',
        'confidence': 87,
        'status': 'active',
      },
      {
        'id': 'AI-DMD-001',
        'insightType': 'demand_forecasting',
        'title': 'Demand forecast',
        'section': 'Tandoor',
        'prediction': 'Naan demand +18% vs yesterday same hour',
        'confidence': 81,
        'status': 'active',
      },
      {
        'id': 'AI-STF-001',
        'insightType': 'staff_prediction',
        'title': 'Staff prediction',
        'section': 'Chinese',
        'prediction': 'Wok station understaffed for evening service',
        'confidence': 76,
        'status': 'active',
      },
      {
        'id': 'AI-SLW-001',
        'insightType': 'slow_item_detection',
        'title': 'Slow item detection',
        'section': 'Main',
        'prediction': 'Butter chicken prep 24% slower than baseline',
        'confidence': 84,
        'status': 'active',
      },
    ];
  }
}

class MockAnalyticsReportingEngine {
  const MockAnalyticsReportingEngine._();

  static Map<String, dynamic> buildSnapshot({String section = 'All'}) {
    final kitchenReports = MockAnalyticsReportingRegistry.reportsFor(section);
    final aiInsights = MockAnalyticsReportingRegistry.insightsFor(section);

    final productivityReport = kitchenReports.cast<Map<String, dynamic>?>().firstWhere(
          (item) => item?['reportType'] == 'productivity',
          orElse: () => null,
        );
    final delayReport = kitchenReports.cast<Map<String, dynamic>?>().firstWhere(
          (item) => item?['reportType'] == 'delay',
          orElse: () => null,
        );
    final wasteReport = kitchenReports.cast<Map<String, dynamic>?>().firstWhere(
          (item) => item?['reportType'] == 'waste',
          orElse: () => null,
        );
    final peakReport = kitchenReports.cast<Map<String, dynamic>?>().firstWhere(
          (item) => item?['reportType'] == 'peak_hour',
          orElse: () => null,
        );

    return {
      'section': section,
      'lastSyncedAt': DateTime.now().toIso8601String(),
      'kitchenReports': kitchenReports,
      'aiInsights': aiInsights,
      'stats': {
        'reportsReady': kitchenReports
            .where((item) => item['status'] == 'ready')
            .length,
        'aiInsightsActive': aiInsights
            .where((item) => item['status'] == 'active')
            .length,
        'avgProductivity': productivityReport == null
            ? 0
            : int.tryParse(
                  (productivityReport['metricValue'] as String)
                      .replaceAll('%', ''),
                ) ??
                0,
        'delayRate': delayReport == null
            ? 0
            : int.tryParse(
                  (delayReport['metricValue'] as String).replaceAll('%', ''),
                ) ??
                0,
        'wastePercent': wasteReport == null
            ? 0
            : int.tryParse(
                  (wasteReport['metricValue'] as String)
                      .replaceAll('%', '')
                      .split('.')
                      .first,
                ) ??
                0,
        'peakHourLabel':
            peakReport?['metricValue'] as String? ?? 'N/A',
      },
      'analyticsFeatures': {
        'preparationReports': kitchenReports.any(
          (item) => item['reportType'] == 'preparation',
        ),
        'delayReports': kitchenReports.any(
          (item) => item['reportType'] == 'delay',
        ),
        'wasteReports': kitchenReports.any(
          (item) => item['reportType'] == 'waste',
        ),
        'productivityReports': kitchenReports.any(
          (item) => item['reportType'] == 'productivity',
        ),
        'peakHourReports': kitchenReports.any(
          (item) => item['reportType'] == 'peak_hour',
        ),
        'rushPrediction': aiInsights.any(
          (item) => item['insightType'] == 'rush_prediction',
        ),
        'demandForecasting': aiInsights.any(
          (item) => item['insightType'] == 'demand_forecasting',
        ),
        'staffPrediction': aiInsights.any(
          (item) => item['insightType'] == 'staff_prediction',
        ),
        'slowItemDetection': aiInsights.any(
          (item) => item['insightType'] == 'slow_item_detection',
        ),
      },
      'sections': MockSectionRegistry.filterSections,
    };
  }
}
