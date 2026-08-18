class AnalyticsReportingSnapshot {
  const AnalyticsReportingSnapshot({
    required this.section,
    required this.lastSyncedAt,
    required this.kitchenReports,
    required this.aiInsights,
    required this.stats,
    required this.analyticsFeatures,
    required this.sections,
  });

  final String section;
  final DateTime lastSyncedAt;
  final List<KitchenReport> kitchenReports;
  final List<AiAnalyticsInsight> aiInsights;
  final AnalyticsReportingStats stats;
  final AnalyticsReportingFeatureFlags analyticsFeatures;
  final List<String> sections;

  factory AnalyticsReportingSnapshot.fromJson(Map<String, dynamic> json) {
    return AnalyticsReportingSnapshot(
      section: json['section'] as String? ?? 'All',
      lastSyncedAt: DateTime.parse(json['lastSyncedAt'] as String),
      kitchenReports: (json['kitchenReports'] as List<dynamic>)
          .map((item) => KitchenReport.fromJson(item as Map<String, dynamic>))
          .toList(),
      aiInsights: (json['aiInsights'] as List<dynamic>)
          .map(
            (item) => AiAnalyticsInsight.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      stats: AnalyticsReportingStats.fromJson(json['stats'] as Map<String, dynamic>),
      analyticsFeatures: AnalyticsReportingFeatureFlags.fromJson(
        json['analyticsFeatures'] as Map<String, dynamic>,
      ),
      sections: (json['sections'] as List<dynamic>)
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class KitchenReport {
  const KitchenReport({
    required this.id,
    required this.reportType,
    required this.title,
    required this.section,
    required this.period,
    required this.summary,
    required this.metricLabel,
    required this.metricValue,
    required this.status,
    required this.availableActions,
  });

  final String id;
  final String reportType;
  final String title;
  final String section;
  final String period;
  final String summary;
  final String metricLabel;
  final String metricValue;
  final String status;
  final List<String> availableActions;

  factory KitchenReport.fromJson(Map<String, dynamic> json) {
    return KitchenReport(
      id: json['id'] as String,
      reportType: json['reportType'] as String? ?? 'general',
      title: json['title'] as String,
      section: json['section'] as String,
      period: json['period'] as String? ?? 'Today',
      summary: json['summary'] as String? ?? '',
      metricLabel: json['metricLabel'] as String? ?? 'Metric',
      metricValue: json['metricValue'] as String? ?? '0',
      status: json['status'] as String? ?? 'ready',
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class AiAnalyticsInsight {
  const AiAnalyticsInsight({
    required this.id,
    required this.insightType,
    required this.title,
    required this.section,
    required this.prediction,
    required this.confidence,
    required this.status,
    required this.availableActions,
  });

  final String id;
  final String insightType;
  final String title;
  final String section;
  final String prediction;
  final int confidence;
  final String status;
  final List<String> availableActions;

  factory AiAnalyticsInsight.fromJson(Map<String, dynamic> json) {
    return AiAnalyticsInsight(
      id: json['id'] as String,
      insightType: json['insightType'] as String? ?? 'general',
      title: json['title'] as String,
      section: json['section'] as String,
      prediction: json['prediction'] as String? ?? '',
      confidence: json['confidence'] as int? ?? 0,
      status: json['status'] as String? ?? 'active',
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class AnalyticsReportingStats {
  const AnalyticsReportingStats({
    required this.reportsReady,
    required this.aiInsightsActive,
    required this.avgProductivity,
    required this.delayRate,
    required this.wastePercent,
    required this.peakHourLabel,
  });

  final int reportsReady;
  final int aiInsightsActive;
  final int avgProductivity;
  final int delayRate;
  final int wastePercent;
  final String peakHourLabel;

  factory AnalyticsReportingStats.fromJson(Map<String, dynamic> json) {
    return AnalyticsReportingStats(
      reportsReady: json['reportsReady'] as int? ?? 0,
      aiInsightsActive: json['aiInsightsActive'] as int? ?? 0,
      avgProductivity: json['avgProductivity'] as int? ?? 0,
      delayRate: json['delayRate'] as int? ?? 0,
      wastePercent: json['wastePercent'] as int? ?? 0,
      peakHourLabel: json['peakHourLabel'] as String? ?? 'N/A',
    );
  }
}

class AnalyticsReportingFeatureFlags {
  const AnalyticsReportingFeatureFlags({
    required this.preparationReports,
    required this.delayReports,
    required this.wasteReports,
    required this.productivityReports,
    required this.peakHourReports,
    required this.rushPrediction,
    required this.demandForecasting,
    required this.staffPrediction,
    required this.slowItemDetection,
  });

  final bool preparationReports;
  final bool delayReports;
  final bool wasteReports;
  final bool productivityReports;
  final bool peakHourReports;
  final bool rushPrediction;
  final bool demandForecasting;
  final bool staffPrediction;
  final bool slowItemDetection;

  factory AnalyticsReportingFeatureFlags.fromJson(Map<String, dynamic> json) {
    return AnalyticsReportingFeatureFlags(
      preparationReports: json['preparationReports'] as bool? ?? false,
      delayReports: json['delayReports'] as bool? ?? false,
      wasteReports: json['wasteReports'] as bool? ?? false,
      productivityReports: json['productivityReports'] as bool? ?? false,
      peakHourReports: json['peakHourReports'] as bool? ?? false,
      rushPrediction: json['rushPrediction'] as bool? ?? false,
      demandForecasting: json['demandForecasting'] as bool? ?? false,
      staffPrediction: json['staffPrediction'] as bool? ?? false,
      slowItemDetection: json['slowItemDetection'] as bool? ?? false,
    );
  }
}

class AnalyticsReportingActionResult {
  const AnalyticsReportingActionResult({
    required this.success,
    required this.message,
  });

  final bool success;
  final String message;

  factory AnalyticsReportingActionResult.fromJson(Map<String, dynamic> json) {
    return AnalyticsReportingActionResult(
      success: json['success'] as bool? ?? false,
      message: json['message'] as String? ?? 'Analytics action applied',
    );
  }
}
