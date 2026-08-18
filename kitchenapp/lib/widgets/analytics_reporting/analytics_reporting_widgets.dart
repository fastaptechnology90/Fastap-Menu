import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../models/analytics_reporting/analytics_reporting_snapshot.dart';

class KitchenReportCard extends StatelessWidget {
  const KitchenReportCard({
    super.key,
    required this.report,
    required this.onAction,
  });

  final KitchenReport report;
  final ValueChanged<String> onAction;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.panelBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  report.title,
                  style: const TextStyle(
                    color: AppColors.primaryText,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              _Tag(label: _typeLabel(report.reportType), color: AppColors.info),
              const SizedBox(width: 8),
              _Tag(label: report.status, color: AppColors.primary),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            '${report.section} · ${report.period}',
            style: const TextStyle(
              color: AppColors.secondaryText,
              fontWeight: FontWeight.w600,
              fontSize: 12,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            report.summary,
            style: const TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w600,
              fontSize: 12,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            '${report.metricLabel}: ${report.metricValue}',
            style: const TextStyle(
              color: AppColors.primary,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: report.availableActions
                .map(
                  (action) => action == 'export_report'
                      ? FilledButton(
                          onPressed: () => onAction(action),
                          child: Text(_actionLabel(action)),
                        )
                      : OutlinedButton(
                          onPressed: () => onAction(action),
                          child: Text(_actionLabel(action)),
                        ),
                )
                .toList(),
          ),
        ],
      ),
    );
  }

  static String _typeLabel(String type) {
    return switch (type) {
      'preparation' => 'Prep',
      'delay' => 'Delay',
      'waste' => 'Waste',
      'productivity' => 'Productivity',
      'peak_hour' => 'Peak',
      _ => type,
    };
  }

  static String _actionLabel(String action) {
    return switch (action) {
      'view_report' => 'View',
      'export_report' => 'Export',
      'schedule_report' => 'Schedule',
      'acknowledge_report' => 'Acknowledge',
      _ => action,
    };
  }
}

class AiAnalyticsInsightList extends StatelessWidget {
  const AiAnalyticsInsightList({
    super.key,
    required this.insights,
    required this.onAction,
  });

  final List<AiAnalyticsInsight> insights;
  final ValueChanged<(AiAnalyticsInsight insight, String action)> onAction;

  @override
  Widget build(BuildContext context) {
    if (insights.isEmpty) {
      return const _EmptyBox(message: 'No AI analytics insights');
    }

    return Column(
      children: insights
          .map(
            (insight) => Container(
              width: double.infinity,
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.premium.withValues(alpha: 0.06),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: AppColors.premium.withValues(alpha: 0.25),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          insight.title,
                          style: const TextStyle(
                            color: AppColors.primaryText,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                      _Tag(
                        label: '${insight.confidence}%',
                        color: AppColors.premium,
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${insight.section} · ${insight.prediction}',
                    style: const TextStyle(
                      color: AppColors.secondaryText,
                      fontWeight: FontWeight.w600,
                      fontSize: 12,
                    ),
                  ),
                  if (insight.availableActions.isNotEmpty) ...[
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: insight.availableActions
                          .map(
                            (action) => action == 'apply_insight'
                                ? FilledButton(
                                    onPressed: () =>
                                        onAction((insight, action)),
                                    child: Text(_actionLabel(action)),
                                  )
                                : OutlinedButton(
                                    onPressed: () =>
                                        onAction((insight, action)),
                                    child: Text(_actionLabel(action)),
                                  ),
                          )
                          .toList(),
                    ),
                  ],
                ],
              ),
            ),
          )
          .toList(),
    );
  }

  static String _actionLabel(String action) {
    return switch (action) {
      'apply_insight' => 'Apply',
      'dismiss_insight' => 'Dismiss',
      'refresh_prediction' => 'Refresh',
      _ => action,
    };
  }
}

class AnalyticsReportingSidePanel extends StatelessWidget {
  const AnalyticsReportingSidePanel({
    super.key,
    required this.stats,
    required this.flags,
    required this.onGenerateAll,
    required this.processing,
  });

  final AnalyticsReportingStats stats;
  final AnalyticsReportingFeatureFlags flags;
  final VoidCallback onGenerateAll;
  final bool processing;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.panelBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Analytics metrics',
            style: TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w900,
              fontSize: 16,
            ),
          ),
          const SizedBox(height: 12),
          _StatRow('Reports ready', '${stats.reportsReady}'),
          _StatRow('AI insights', '${stats.aiInsightsActive}'),
          _StatRow('Avg productivity', '${stats.avgProductivity}'),
          _StatRow('Delay rate', '${stats.delayRate}%'),
          _StatRow('Waste', '${stats.wastePercent}%'),
          _StatRow('Peak hour', stats.peakHourLabel),
          const SizedBox(height: 16),
          const Text(
            'Kitchen reports',
            style: TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 8),
          _FeatureChip('Preparation reports', flags.preparationReports),
          _FeatureChip('Delay reports', flags.delayReports),
          _FeatureChip('Waste reports', flags.wasteReports),
          _FeatureChip('Productivity reports', flags.productivityReports),
          _FeatureChip('Peak hour reports', flags.peakHourReports),
          const SizedBox(height: 12),
          const Text(
            'AI analytics',
            style: TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 8),
          _FeatureChip('Rush prediction', flags.rushPrediction),
          _FeatureChip('Demand forecasting', flags.demandForecasting),
          _FeatureChip('Staff prediction', flags.staffPrediction),
          _FeatureChip('Slow item detection', flags.slowItemDetection),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: processing ? null : onGenerateAll,
              icon: const Icon(Icons.insights_outlined, size: 18),
              label: const Text('Regenerate analytics'),
            ),
          ),
        ],
      ),
    );
  }
}

class _Tag extends StatelessWidget {
  const _Tag({required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontWeight: FontWeight.w700,
          fontSize: 11,
        ),
      ),
    );
  }
}

class _StatRow extends StatelessWidget {
  const _StatRow(this.label, this.value);

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: const TextStyle(
                color: AppColors.secondaryText,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          Text(
            value,
            style: const TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w900,
            ),
          ),
        ],
      ),
    );
  }
}

class _FeatureChip extends StatelessWidget {
  const _FeatureChip(this.label, this.active);

  final String label;
  final bool active;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        children: [
          Icon(
            active ? Icons.check_circle : Icons.radio_button_unchecked,
            size: 16,
            color: active ? AppColors.premium : AppColors.secondaryText,
          ),
          const SizedBox(width: 8),
          Text(
            label,
            style: TextStyle(
              color: active ? AppColors.primaryText : AppColors.secondaryText,
              fontWeight: FontWeight.w600,
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }
}

class _EmptyBox extends StatelessWidget {
  const _EmptyBox({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.panelBorder),
      ),
      child: Text(
        message,
        style: const TextStyle(
          color: AppColors.secondaryText,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
