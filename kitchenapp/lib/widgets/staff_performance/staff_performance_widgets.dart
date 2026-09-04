import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../models/staff_performance/staff_performance_snapshot.dart';

class StaffPerformanceCard extends StatelessWidget {
  const StaffPerformanceCard({
    super.key,
    required this.record,
    required this.onAction,
  });

  final StaffPerformanceRecord record;
  final ValueChanged<String> onAction;

  @override
  Widget build(BuildContext context) {
    final trendColor = record.trend == 'up'
        ? AppColors.primary
        : record.trend == 'down' || record.trend == 'coaching'
            ? AppColors.danger
            : AppColors.warning;

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
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
                  record.staffName,
                  style: TextStyle(
                    color: AppColors.primaryText,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              _Tag(label: record.rankLabel, color: AppColors.info),
              const SizedBox(width: 8),
              _Tag(label: record.trend, color: trendColor),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            '${record.role} · ${record.section}',
            style: TextStyle(
              color: AppColors.secondaryText,
              fontWeight: FontWeight.w600,
              fontSize: 12,
            ),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 16,
            runSpacing: 8,
            children: [
              _MetricChip('Orders', '${record.ordersCompleted}'),
              _MetricChip('Prep speed', record.preparationSpeed),
              _MetricChip('Delay', '${record.delayRatio}%'),
              _MetricChip('Complaints', '${record.complaintRatio}%'),
              _MetricChip('Quality', '${record.qualityScore}'),
              _MetricChip('Productivity', '${record.productivityScore}'),
            ],
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: record.availableActions
                .map(
                  (action) => action.startsWith('apply_')
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

  static String _actionLabel(String action) {
    return switch (action) {
      'refresh_metrics' => 'Refresh',
      'apply_speed_incentive' => 'Speed bonus',
      'apply_quality_reward' => 'Quality reward',
      'apply_performance_bonus' => 'Bonus',
      'flag_coaching' => 'Flag coaching',
      'acknowledge_review' => 'Acknowledge',
      _ => action,
    };
  }
}

class PerformanceIncentiveList extends StatelessWidget {
  const PerformanceIncentiveList({
    super.key,
    required this.incentives,
    required this.onAction,
  });

  final List<PerformanceIncentive> incentives;
  final ValueChanged<(PerformanceIncentive incentive, String action)> onAction;

  @override
  Widget build(BuildContext context) {
    if (incentives.isEmpty) {
      return const _EmptyBox(message: 'No incentives queued');
    }

    return Column(
      children: incentives
          .map(
            (incentive) => Container(
              width: double.infinity,
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.premium.withValues(alpha: 0.06),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: AppColors.premium.withValues(alpha: 0.2),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          incentive.staffName,
                          style: TextStyle(
                            color: AppColors.primaryText,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                      _Tag(
                        label: _incentiveTypeLabel(incentive.incentiveType),
                        color: AppColors.premium,
                      ),
                      const SizedBox(width: 8),
                      _Tag(label: incentive.status, color: AppColors.info),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${incentive.section} · ${incentive.amountLabel} · ${incentive.reason}',
                    style: TextStyle(
                      color: AppColors.secondaryText,
                      fontWeight: FontWeight.w600,
                      fontSize: 12,
                    ),
                  ),
                  if (incentive.availableActions.isNotEmpty) ...[
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: incentive.availableActions
                          .map(
                            (action) => action == 'pay_incentive'
                                ? FilledButton(
                                    onPressed: () =>
                                        onAction((incentive, action)),
                                    child: Text(_actionLabel(action)),
                                  )
                                : OutlinedButton(
                                    onPressed: () =>
                                        onAction((incentive, action)),
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

  static String _incentiveTypeLabel(String type) {
    return switch (type) {
      'speed_incentive' => 'Speed',
      'quality_reward' => 'Quality',
      'performance_bonus' => 'Bonus',
      _ => type,
    };
  }

  static String _actionLabel(String action) {
    return switch (action) {
      'approve_incentive' => 'Approve',
      'pay_incentive' => 'Pay',
      'reject_incentive' => 'Reject',
      _ => action,
    };
  }
}

class StaffPerformanceSidePanel extends StatelessWidget {
  const StaffPerformanceSidePanel({
    super.key,
    required this.stats,
    required this.flags,
    required this.onRecalculate,
    required this.processing,
  });

  final StaffPerformanceStats stats;
  final StaffPerformanceFeatureFlags flags;
  final VoidCallback onRecalculate;
  final bool processing;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.panelBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Performance metrics',
            style: TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w900,
              fontSize: 16,
            ),
          ),
          const SizedBox(height: 12),
          _StatRow('Staff tracked', '${stats.staffTracked}'),
          _StatRow('Avg quality', '${stats.avgQualityScore}'),
          _StatRow('Avg productivity', '${stats.avgProductivity}'),
          _StatRow('Avg delay ratio', '${stats.avgDelayRatio}%'),
          _StatRow('Pending incentives', '${stats.incentivesPending}'),
          _StatRow('Bonuses this month', '${stats.bonusesThisMonth}'),
          const SizedBox(height: 16),
          Text(
            'Active modules',
            style: TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 8),
          _FeatureChip('Orders completed', flags.ordersCompleted),
          _FeatureChip('Preparation speed', flags.preparationSpeed),
          _FeatureChip('Delay ratio', flags.delayRatio),
          _FeatureChip('Complaint ratio', flags.complaintRatio),
          _FeatureChip('Quality score', flags.qualityScore),
          _FeatureChip('Productivity score', flags.productivityScore),
          _FeatureChip('Speed incentives', flags.speedIncentives),
          _FeatureChip('Quality rewards', flags.qualityRewards),
          _FeatureChip('Performance bonuses', flags.performanceBonuses),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: processing ? null : onRecalculate,
              icon: const Icon(Icons.calculate_outlined, size: 18),
              label: const Text('Recalculate metrics'),
            ),
          ),
        ],
      ),
    );
  }
}

class _MetricChip extends StatelessWidget {
  const _MetricChip(this.label, this.value);

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: TextStyle(
            color: AppColors.secondaryText,
            fontWeight: FontWeight.w600,
            fontSize: 11,
          ),
        ),
        Text(
          value,
          style: TextStyle(
            color: AppColors.primaryText,
            fontWeight: FontWeight.w800,
            fontSize: 14,
          ),
        ),
      ],
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
              style: TextStyle(
                color: AppColors.secondaryText,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          Text(
            value,
            style: TextStyle(
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
            color: active ? AppColors.primary : AppColors.secondaryText,
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
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.panelBorder),
      ),
      child: Text(
        message,
        style: TextStyle(
          color: AppColors.secondaryText,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
