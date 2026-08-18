import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../core/constants/app_spacing.dart';
import '../../models/dashboard/rush_alert.dart';

class RushAlertsPanel extends StatelessWidget {
  const RushAlertsPanel({super.key, required this.alerts});

  final List<RushAlert> alerts;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.xl),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppSpacing.radiusXl),
        border: Border.all(
          color: alerts.isEmpty
              ? AppColors.panelBorder
              : AppColors.warning.withValues(alpha: 0.35),
        ),
        boxShadow: [
          BoxShadow(
            color: (alerts.isEmpty ? Colors.black : AppColors.warning)
                .withValues(alpha: 0.06),
            blurRadius: 14,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                Icons.campaign_rounded,
                color: alerts.isEmpty ? AppColors.primary : AppColors.warning,
                size: 22,
              ),
              const SizedBox(width: AppSpacing.sm),
              const Expanded(
                child: Text(
                  'Rush alerts',
                  style: TextStyle(
                    fontWeight: FontWeight.w900,
                    fontSize: 16,
                    color: AppColors.primaryText,
                  ),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: (alerts.isEmpty ? AppColors.primary : AppColors.warning)
                      .withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  alerts.isEmpty ? 'Stable' : '${alerts.length} active',
                  style: TextStyle(
                    color: alerts.isEmpty ? AppColors.primary : AppColors.warning,
                    fontWeight: FontWeight.w900,
                    fontSize: 11,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),
          if (alerts.isEmpty)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(AppSpacing.lg),
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.06),
                borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
              ),
              child: const Row(
                children: [
                  Icon(Icons.check_circle_outline, color: AppColors.primary),
                  SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Text(
                      'Kitchen flow is within target thresholds.',
                      style: TextStyle(
                        color: AppColors.secondaryText,
                        height: 1.4,
                        fontSize: 13,
                      ),
                    ),
                  ),
                ],
              ),
            )
          else
            ...alerts.map((alert) {
              final color = _colorForSeverity(alert.severity);
              return Container(
                margin: const EdgeInsets.only(bottom: AppSpacing.sm),
                padding: const EdgeInsets.all(AppSpacing.md),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      color.withValues(alpha: 0.12),
                      color.withValues(alpha: 0.04),
                    ],
                  ),
                  borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
                  border: Border.all(color: color.withValues(alpha: 0.25)),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        color: color.withValues(alpha: 0.16),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Icon(
                        _iconForSeverity(alert.severity),
                        color: color,
                        size: 18,
                      ),
                    ),
                    const SizedBox(width: AppSpacing.md),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            alert.title,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontWeight: FontWeight.w800,
                              color: AppColors.primaryText,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            alert.message,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 12,
                              color: AppColors.secondaryText,
                              height: 1.35,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              );
            }),
        ],
      ),
    );
  }

  static Color _colorForSeverity(String severity) {
    return switch (severity) {
      'critical' => AppColors.danger,
      'vip' => AppColors.premium,
      _ => AppColors.warning,
    };
  }

  static IconData _iconForSeverity(String severity) {
    return switch (severity) {
      'critical' => Icons.error_outline_rounded,
      'vip' => Icons.workspace_premium_outlined,
      _ => Icons.bolt_rounded,
    };
  }
}
