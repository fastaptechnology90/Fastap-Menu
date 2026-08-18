import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../models/staff_wellness/staff_wellness_snapshot.dart';

class BurnoutPredictionList extends StatelessWidget {
  const BurnoutPredictionList({
    super.key,
    required this.predictions,
    required this.onAction,
  });

  final List<BurnoutPrediction> predictions;
  final ValueChanged<(BurnoutPrediction prediction, String action)> onAction;

  @override
  Widget build(BuildContext context) {
    if (predictions.isEmpty) {
      return const _EmptyBox(message: 'No burnout predictions');
    }

    return Column(
      children: predictions
          .map(
            (prediction) => _WellnessCard(
              title: prediction.staffName,
              subtitle:
                  '${prediction.section} · ${prediction.riskLevel} risk · score ${prediction.riskScore}',
              body: prediction.predictionSummary,
              tagLabel: 'Burnout AI',
              tagColor: AppColors.premium,
              actions: prediction.availableActions,
              onAction: (action) => onAction((prediction, action)),
            ),
          )
          .toList(),
    );
  }
}

class SlowPerformanceAlertList extends StatelessWidget {
  const SlowPerformanceAlertList({
    super.key,
    required this.alerts,
    required this.onAction,
  });

  final List<SlowPerformanceAlert> alerts;
  final ValueChanged<(SlowPerformanceAlert alert, String action)> onAction;

  @override
  Widget build(BuildContext context) {
    if (alerts.isEmpty) {
      return const _EmptyBox(message: 'No slow performance alerts');
    }

    return Column(
      children: alerts
          .map(
            (alert) => _WellnessCard(
              title: alert.staffName,
              subtitle:
                  '${alert.section} · ${alert.slowdownPercent}% slower · ${alert.detectedAt}',
              body: 'AI detected prep slowdown vs baseline',
              tagLabel: alert.status,
              tagColor: AppColors.warning,
              actions: alert.availableActions,
              onAction: (action) => onAction((alert, action)),
            ),
          )
          .toList(),
    );
  }
}

class OverworkAlertList extends StatelessWidget {
  const OverworkAlertList({
    super.key,
    required this.alerts,
    required this.onAction,
  });

  final List<OverworkAlert> alerts;
  final ValueChanged<(OverworkAlert alert, String action)> onAction;

  @override
  Widget build(BuildContext context) {
    if (alerts.isEmpty) {
      return const _EmptyBox(message: 'No overwork alerts');
    }

    return Column(
      children: alerts
          .map(
            (alert) => _WellnessCard(
              title: alert.staffName,
              subtitle:
                  '${alert.section} · ${alert.hoursOnShift}h on shift · limit ${alert.thresholdHours}h',
              body: 'Overwork threshold exceeded · wellness intervention advised',
              tagLabel: alert.status,
              tagColor: AppColors.danger,
              actions: alert.availableActions,
              onAction: (action) => onAction((alert, action)),
            ),
          )
          .toList(),
    );
  }
}

class BreakRecommendationList extends StatelessWidget {
  const BreakRecommendationList({
    super.key,
    required this.recommendations,
    required this.onAction,
  });

  final List<BreakRecommendation> recommendations;
  final ValueChanged<(BreakRecommendation recommendation, String action)>
      onAction;

  @override
  Widget build(BuildContext context) {
    if (recommendations.isEmpty) {
      return const _EmptyBox(message: 'No break recommendations');
    }

    return Column(
      children: recommendations
          .map(
            (recommendation) => _WellnessCard(
              title: recommendation.staffName,
              subtitle:
                  '${recommendation.section} · break in ${recommendation.recommendedBreakIn}',
              body: recommendation.reason,
              tagLabel: recommendation.status,
              tagColor: AppColors.primary,
              actions: recommendation.availableActions,
              onAction: (action) => onAction((recommendation, action)),
              primaryActions: const {'apply_break'},
            ),
          )
          .toList(),
    );
  }
}

class StaffWellnessSidePanel extends StatelessWidget {
  const StaffWellnessSidePanel({
    super.key,
    required this.stats,
    required this.flags,
    required this.onRunScan,
    required this.processing,
  });

  final StaffWellnessStats stats;
  final StaffWellnessFeatureFlags flags;
  final VoidCallback onRunScan;
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
            'Wellness AI metrics',
            style: TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w900,
              fontSize: 16,
            ),
          ),
          const SizedBox(height: 12),
          _StatRow('High burnout risk', '${stats.highBurnoutRisk}'),
          _StatRow('Slow performance', '${stats.activeSlowAlerts}'),
          _StatRow('Overwork alerts', '${stats.overworkAlerts}'),
          _StatRow('Pending breaks', '${stats.pendingBreaks}'),
          _StatRow('AI scans today', '${stats.aiScansToday}'),
          _StatRow('Avg risk score', '${stats.avgRiskScore}'),
          const SizedBox(height: 16),
          const Text(
            'AI modules',
            style: TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 8),
          _FeatureChip('Burnout prediction', flags.burnoutPrediction),
          _FeatureChip(
            'Slow performance detection',
            flags.slowPerformanceDetection,
          ),
          _FeatureChip('Overwork alerts', flags.overworkAlerts),
          _FeatureChip('Break recommendations', flags.breakRecommendations),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: processing ? null : onRunScan,
              icon: const Icon(Icons.psychology_alt_outlined, size: 18),
              label: const Text('Run AI wellness scan'),
            ),
          ),
        ],
      ),
    );
  }
}

class _WellnessCard extends StatelessWidget {
  const _WellnessCard({
    required this.title,
    required this.subtitle,
    required this.body,
    required this.tagLabel,
    required this.tagColor,
    required this.actions,
    required this.onAction,
    this.primaryActions = const {},
  });

  final String title;
  final String subtitle;
  final String body;
  final String tagLabel;
  final Color tagColor;
  final List<String> actions;
  final ValueChanged<String> onAction;
  final Set<String> primaryActions;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: tagColor.withValues(alpha: 0.25)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(
                    color: AppColors.primaryText,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              _Tag(label: tagLabel, color: tagColor),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            subtitle,
            style: const TextStyle(
              color: AppColors.secondaryText,
              fontWeight: FontWeight.w600,
              fontSize: 12,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            body,
            style: const TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w600,
              fontSize: 12,
            ),
          ),
          if (actions.isNotEmpty) ...[
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: actions
                  .map(
                    (action) => primaryActions.contains(action)
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
        ],
      ),
    );
  }

  static String _actionLabel(String action) {
    return switch (action) {
      'acknowledge_alert' => 'Acknowledge',
      'schedule_break' => 'Schedule break',
      'escalate_supervisor' => 'Escalate',
      'dismiss_alert' => 'Dismiss',
      'apply_break' => 'Apply break',
      'snooze_recommendation' => 'Snooze',
      'dismiss_recommendation' => 'Dismiss',
      _ => action,
    };
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
