import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../state/kitchen_command_controller.dart';
import '../../widgets/offline_failover/offline_failover_widgets.dart';

class OfflineFailoverView extends StatelessWidget {
  const OfflineFailoverView({super.key, required this.controller});

  final KitchenCommandController controller;

  @override
  Widget build(BuildContext context) {
    if (controller.offlineFailoverLoading && controller.offlineFailover == null) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(48),
          child: CircularProgressIndicator(),
        ),
      );
    }

    final snapshot = controller.offlineFailover;
    if (snapshot == null) {
      return _EmptyState(
        message: controller.offlineFailoverErrorMessage ??
            'Offline failover system unavailable',
        onRetry: () => controller.refreshOfflineFailover(),
      );
    }

    final connectivityColor = switch (snapshot.connectivityStatus) {
      'online' => AppColors.primary,
      'degraded' => AppColors.warning,
      _ => AppColors.danger,
    };

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
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'System 38 · Offline Mode & Failover System',
                    style: TextStyle(
                      color: AppColors.primaryText,
                      fontWeight: FontWeight.w900,
                      fontSize: 18,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Connectivity ${snapshot.connectivityStatus} · offline KDS · queue recovery',
                    style: TextStyle(
                      color: connectivityColor,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
              OutlinedButton.icon(
                onPressed: controller.offlineFailoverLoading
                    ? null
                    : () => controller.refreshOfflineFailover(),
                icon: const Icon(Icons.refresh, size: 18),
                label: const Text('Refresh'),
              ),
            ],
          ),
        ),
        if (controller.offlineFailoverActionMessage != null) ...[
          const SizedBox(height: 12),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.info.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.info.withValues(alpha: 0.2)),
            ),
            child: Text(
              controller.offlineFailoverActionMessage!,
              style: const TextStyle(
                color: AppColors.info,
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
                const Text(
                  'Offline modules',
                  style: TextStyle(
                    color: AppColors.primaryText,
                    fontWeight: FontWeight.w800,
                    fontSize: 16,
                  ),
                ),
                const SizedBox(height: 12),
                ...snapshot.offlineModules.map(
                  (module) => OfflineModuleCard(
                    module: module,
                    onAction: (action) => controller.performOfflineModuleAction(
                      moduleId: module.id,
                      action: action,
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Failover queue',
                  style: TextStyle(
                    color: AppColors.primaryText,
                    fontWeight: FontWeight.w800,
                    fontSize: 16,
                  ),
                ),
                const SizedBox(height: 12),
                FailoverQueueList(
                  items: snapshot.queuedItems,
                  onAction: (entry) => controller.performFailoverQueueAction(
                    queueId: entry.$1.id,
                    action: entry.$2,
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Queue recovery jobs',
                  style: TextStyle(
                    color: AppColors.primaryText,
                    fontWeight: FontWeight.w800,
                    fontSize: 16,
                  ),
                ),
                const SizedBox(height: 12),
                QueueRecoveryList(
                  jobs: snapshot.recoveryJobs,
                  onAction: (entry) => controller.performQueueRecoveryAction(
                    recoveryId: entry.$1.id,
                    action: entry.$2,
                  ),
                ),
              ],
            );
            final side = OfflineFailoverSidePanel(
              stats: snapshot.stats,
              flags: snapshot.failoverFeatures,
              onRestoreSync: controller.restoreOfflineSync,
              onSyncAll: controller.syncAllOfflineFailover,
              processing: controller.offlineFailoverLoading,
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
          Text(message, style: const TextStyle(color: AppColors.secondaryText)),
          const SizedBox(height: 12),
          OutlinedButton(onPressed: onRetry, child: const Text('Retry')),
        ],
      ),
    );
  }
}
