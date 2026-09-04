import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../state/kitchen_command_controller.dart';
import '../../widgets/staff_wellness/staff_wellness_widgets.dart';

class StaffWellnessView extends StatelessWidget {
  const StaffWellnessView({super.key, required this.controller});

  final KitchenCommandController controller;

  @override
  Widget build(BuildContext context) {
    if (controller.staffWellnessLoading && controller.staffWellness == null) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(48),
          child: CircularProgressIndicator(),
        ),
      );
    }

    final snapshot = controller.staffWellness;
    if (snapshot == null) {
      return _EmptyState(
        message: controller.staffWellnessErrorMessage ??
            'Staff wellness system unavailable',
        onRetry: () => controller.refreshStaffWellness(),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: AppColors.panelBorder),
          ),
          child: Wrap(
            spacing: 12,
            runSpacing: 10,
            alignment: WrapAlignment.spaceBetween,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'System 35 · Staff Fatigue & Wellness AI',
                    style: TextStyle(
                      color: AppColors.primaryText,
                      fontWeight: FontWeight.w900,
                      fontSize: 18,
                    ),
                  ),
                  SizedBox(height: 4),
                  Text(
                    'Burnout · slowdown · overwork · break recommendations',
                    style: TextStyle(
                      color: AppColors.secondaryText,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
              OutlinedButton.icon(
                onPressed: controller.staffWellnessLoading
                    ? null
                    : () => controller.refreshStaffWellness(),
                icon: const Icon(Icons.refresh, size: 18),
                label: const Text('Refresh'),
              ),
            ],
          ),
        ),
        if (controller.staffWellnessActionMessage != null) ...[
          const SizedBox(height: 12),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.premium.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.premium.withValues(alpha: 0.2)),
            ),
            child: Text(
              controller.staffWellnessActionMessage!,
              style: TextStyle(
                color: AppColors.premium,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
        const SizedBox(height: 16),
        LayoutBuilder(
          builder: (context, constraints) {
            final wide = constraints.maxWidth > 960;
            final main = Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Burnout predictions',
                  style: TextStyle(
                    color: AppColors.primaryText,
                    fontWeight: FontWeight.w800,
                    fontSize: 16,
                  ),
                ),
                const SizedBox(height: 12),
                BurnoutPredictionList(
                  predictions: snapshot.burnoutPredictions,
                  onAction: (entry) => controller.performStaffWellnessAlertAction(
                    alertId: entry.$1.id,
                    action: entry.$2,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Slow performance detection',
                  style: TextStyle(
                    color: AppColors.primaryText,
                    fontWeight: FontWeight.w800,
                    fontSize: 16,
                  ),
                ),
                const SizedBox(height: 12),
                SlowPerformanceAlertList(
                  alerts: snapshot.slowPerformanceAlerts,
                  onAction: (entry) => controller.performStaffWellnessAlertAction(
                    alertId: entry.$1.id,
                    action: entry.$2,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Overwork alerts',
                  style: TextStyle(
                    color: AppColors.primaryText,
                    fontWeight: FontWeight.w800,
                    fontSize: 16,
                  ),
                ),
                const SizedBox(height: 12),
                OverworkAlertList(
                  alerts: snapshot.overworkAlerts,
                  onAction: (entry) => controller.performStaffWellnessAlertAction(
                    alertId: entry.$1.id,
                    action: entry.$2,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Break recommendations',
                  style: TextStyle(
                    color: AppColors.primaryText,
                    fontWeight: FontWeight.w800,
                    fontSize: 16,
                  ),
                ),
                const SizedBox(height: 12),
                BreakRecommendationList(
                  recommendations: snapshot.breakRecommendations,
                  onAction: (entry) =>
                      controller.performStaffWellnessRecommendationAction(
                    recommendationId: entry.$1.id,
                    action: entry.$2,
                  ),
                ),
              ],
            );
            final side = StaffWellnessSidePanel(
              stats: snapshot.stats,
              flags: snapshot.wellnessFeatures,
              onRunScan: controller.runStaffWellnessScan,
              processing: controller.staffWellnessLoading,
            );

            if (wide) {
              return Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(flex: 3, child: main),
                  const SizedBox(width: 16),
                  Expanded(flex: 2, child: side),
                ],
              );
            }

            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                main,
                const SizedBox(height: 16),
                side,
              ],
            );
          },
        ),
      ],
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(message, style: TextStyle(color: AppColors.secondaryText)),
          const SizedBox(height: 12),
          OutlinedButton(onPressed: onRetry, child: const Text('Retry')),
        ],
      ),
    );
  }
}
