import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../state/kitchen_command_controller.dart';
import '../../widgets/live_alerts/live_alert_widgets.dart';

class LiveAlertView extends StatelessWidget {
  const LiveAlertView({
    super.key,
    required this.controller,
    this.embedded = false,
  });

  final KitchenCommandController controller;
  final bool embedded;

  @override
  Widget build(BuildContext context) {
    if (controller.liveAlertLoading && controller.liveAlerts == null) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(48),
          child: CircularProgressIndicator(),
        ),
      );
    }

    final snapshot = controller.liveAlerts;
    if (snapshot == null) {
      return _EmptyState(
        message: controller.liveAlertErrorMessage ??
            'Live alert engine unavailable',
        onRetry: () => controller.refreshLiveAlerts(),
      );
    }

    final activeAlerts = snapshot.alerts
        .where((alert) => alert.status == 'active' || alert.status == 'escalated')
        .toList();
    final otherAlerts = snapshot.alerts
        .where((alert) => alert.status != 'active' && alert.status != 'escalated')
        .toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (!embedded)
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
                      'System 36 · Live Alert Engine',
                      style: TextStyle(
                        color: AppColors.primaryText,
                        fontWeight: FontWeight.w900,
                        fontSize: 18,
                      ),
                    ),
                    SizedBox(height: 4),
                    Text(
                      'Delay · VIP · emergency · stock · equipment · hygiene',
                      style: TextStyle(
                        color: AppColors.secondaryText,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
                OutlinedButton.icon(
                  onPressed: controller.liveAlertLoading
                      ? null
                      : () => controller.refreshLiveAlerts(),
                  icon: const Icon(Icons.refresh, size: 18),
                  label: const Text('Refresh'),
                ),
              ],
            ),
          ),
        if (controller.liveAlertActionMessage != null) ...[
          const SizedBox(height: 12),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.danger.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.danger.withValues(alpha: 0.2)),
            ),
            child: Text(
              controller.liveAlertActionMessage!,
              style: TextStyle(
                color: AppColors.danger,
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
                  'Active alerts',
                  style: TextStyle(
                    color: AppColors.primaryText,
                    fontWeight: FontWeight.w800,
                    fontSize: 16,
                  ),
                ),
                const SizedBox(height: 12),
                if (activeAlerts.isEmpty)
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: AppColors.panelBorder),
                    ),
                    child: Text(
                      'No active alerts',
                      style: TextStyle(
                        color: AppColors.secondaryText,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  )
                else
                  ...activeAlerts.map(
                    (alert) => LiveAlertCard(
                      alert: alert,
                      onAction: (action) => controller.performLiveAlertAction(
                        alertId: alert.id,
                        action: action,
                      ),
                    ),
                  ),
                const SizedBox(height: 8),
                Text(
                  'Recent / handled alerts',
                  style: TextStyle(
                    color: AppColors.primaryText,
                    fontWeight: FontWeight.w800,
                    fontSize: 16,
                  ),
                ),
                const SizedBox(height: 12),
                ...otherAlerts.map(
                  (alert) => LiveAlertCard(
                    alert: alert,
                    onAction: (action) => controller.performLiveAlertAction(
                      alertId: alert.id,
                      action: action,
                    ),
                  ),
                ),
              ],
            );
            final side = LiveAlertSidePanel(
              stats: snapshot.stats,
              flags: snapshot.alertFeatures,
              onSyncAll: controller.syncAllLiveAlerts,
              processing: controller.liveAlertLoading,
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
