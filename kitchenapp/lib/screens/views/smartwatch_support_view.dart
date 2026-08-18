import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../state/kitchen_command_controller.dart';
import '../../widgets/smartwatch_support/smartwatch_support_widgets.dart';

class SmartwatchSupportView extends StatelessWidget {
  const SmartwatchSupportView({super.key, required this.controller});

  final KitchenCommandController controller;

  @override
  Widget build(BuildContext context) {
    if (controller.smartwatchSupportLoading &&
        controller.smartwatchSupport == null) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(48),
          child: CircularProgressIndicator(),
        ),
      );
    }

    final snapshot = controller.smartwatchSupport;
    if (snapshot == null) {
      return _EmptyState(
        message: controller.smartwatchSupportErrorMessage ??
            'Smartwatch support unavailable',
        onRetry: () => controller.refreshSmartwatchSupport(),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: AppColors.panelBorder),
          ),
          child: Wrap(
            spacing: 12,
            runSpacing: 10,
            alignment: WrapAlignment.spaceBetween,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'System 42 · Smartwatch Support',
                    style: TextStyle(
                      color: AppColors.primaryText,
                      fontWeight: FontWeight.w900,
                      fontSize: 18,
                    ),
                  ),
                  SizedBox(height: 4),
                  Text(
                    'Order · delay · emergency · task alerts to watches',
                    style: TextStyle(
                      color: AppColors.secondaryText,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
              OutlinedButton.icon(
                onPressed: controller.smartwatchSupportLoading
                    ? null
                    : () => controller.refreshSmartwatchSupport(),
                icon: const Icon(Icons.refresh, size: 18),
                label: const Text('Refresh'),
              ),
            ],
          ),
        ),
        if (controller.smartwatchSupportActionMessage != null) ...[
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
              controller.smartwatchSupportActionMessage!,
              style: const TextStyle(
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
                const _SectionTitle('Order alerts'),
                WatchOrderAlertList(
                  alerts: snapshot.orderAlerts,
                  onAction: (entry) => controller.performWatchOrderAction(
                    alertId: entry.$1.id,
                    action: entry.$2,
                  ),
                ),
                const _SectionTitle('Delay alerts'),
                WatchDelayAlertList(
                  alerts: snapshot.delayAlerts,
                  onAction: (entry) => controller.performWatchDelayAction(
                    alertId: entry.$1.id,
                    action: entry.$2,
                  ),
                ),
                const _SectionTitle('Emergency alerts'),
                WatchEmergencyAlertList(
                  alerts: snapshot.emergencyAlerts,
                  onAction: (entry) => controller.performWatchEmergencyAction(
                    alertId: entry.$1.id,
                    action: entry.$2,
                  ),
                ),
                const _SectionTitle('Task notifications'),
                WatchTaskNotificationList(
                  tasks: snapshot.taskNotifications,
                  onAction: (entry) => controller.performWatchTaskAction(
                    taskId: entry.$1.id,
                    action: entry.$2,
                  ),
                ),
              ],
            );
            final side = SmartwatchSupportSidePanel(
              stats: snapshot.stats,
              features: snapshot.smartwatchFeatures,
              onPushAll: controller.pushAllSmartwatchAlerts,
              processing: controller.smartwatchSupportLoading,
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

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.label);

  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 8, bottom: 12),
      child: Text(
        label,
        style: const TextStyle(
          color: AppColors.primaryText,
          fontWeight: FontWeight.w800,
          fontSize: 16,
        ),
      ),
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
          Text(message, style: const TextStyle(color: AppColors.secondaryText)),
          const SizedBox(height: 12),
          OutlinedButton(onPressed: onRetry, child: const Text('Retry')),
        ],
      ),
    );
  }
}
