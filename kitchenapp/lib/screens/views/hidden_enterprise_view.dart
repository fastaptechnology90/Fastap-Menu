import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../state/kitchen_command_controller.dart';
import '../../widgets/hidden_enterprise/hidden_enterprise_widgets.dart';

class HiddenEnterpriseView extends StatelessWidget {
  const HiddenEnterpriseView({super.key, required this.controller});

  final KitchenCommandController controller;

  @override
  Widget build(BuildContext context) {
    if (controller.hiddenEnterpriseLoading &&
        controller.hiddenEnterprise == null) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(48),
          child: CircularProgressIndicator(),
        ),
      );
    }

    final snapshot = controller.hiddenEnterprise;
    if (snapshot == null) {
      return _EmptyState(
        message: controller.hiddenEnterpriseErrorMessage ??
            'Hidden enterprise features unavailable',
        onRetry: () => controller.refreshHiddenEnterprise(),
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
                    'System 47 · Hidden Enterprise Features',
                    style: TextStyle(
                      color: AppColors.primaryText,
                      fontWeight: FontWeight.w900,
                      fontSize: 18,
                    ),
                  ),
                  SizedBox(height: 4),
                  Text(
                    'Recovery · replay · tracking · lockdown · queue restore',
                    style: TextStyle(
                      color: AppColors.secondaryText,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
              OutlinedButton.icon(
                onPressed: controller.hiddenEnterpriseLoading
                    ? null
                    : () => controller.refreshHiddenEnterprise(),
                icon: const Icon(Icons.refresh, size: 18),
                label: const Text('Refresh'),
              ),
            ],
          ),
        ),
        if (controller.hiddenEnterpriseActionMessage != null) ...[
          const SizedBox(height: 12),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.danger.withValues(alpha: 0.06),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.danger.withValues(alpha: 0.2)),
            ),
            child: Text(
              controller.hiddenEnterpriseActionMessage!,
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
                HiddenEnterpriseSection(
                  title: 'Soft delete recovery',
                  emptyMessage: 'No soft-deleted items',
                  items: snapshot.softDeleteItems.map(softDeleteItemView).toList(),
                  onAction: controller.performSoftDeleteAction,
                ),
                HiddenEnterpriseSection(
                  title: 'Restore deleted orders',
                  emptyMessage: 'No deleted orders',
                  items: snapshot.deletedOrders.map(deletedOrderItemView).toList(),
                  onAction: controller.performDeletedOrderAction,
                ),
                HiddenEnterpriseSection(
                  title: 'Action replay',
                  emptyMessage: 'No action replays',
                  items: snapshot.actionReplays.map(actionReplayItemView).toList(),
                  onAction: controller.performActionReplayAction,
                ),
                HiddenEnterpriseSection(
                  title: 'Version logs',
                  emptyMessage: 'No version logs',
                  items: snapshot.versionLogs.map(versionLogItemView).toList(),
                  onAction: controller.performVersionLogAction,
                ),
                HiddenEnterpriseSection(
                  title: 'Device tracking',
                  emptyMessage: 'No tracked devices',
                  items:
                      snapshot.deviceTracking.map(deviceTrackingItemView).toList(),
                  onAction: controller.performDeviceTrackingAction,
                ),
                HiddenEnterpriseSection(
                  title: 'Session logs',
                  emptyMessage: 'No session logs',
                  items: snapshot.sessionLogs.map(sessionLogItemView).toList(),
                  onAction: controller.performSessionLogAction,
                ),
                HiddenEnterpriseSection(
                  title: 'Emergency lockdown mode',
                  emptyMessage: 'No lockdown profiles',
                  items: snapshot.emergencyLockdowns.map(lockdownItemView).toList(),
                  onAction: controller.performLockdownAction,
                ),
                HiddenEnterpriseSection(
                  title: 'Queue recovery engine',
                  emptyMessage: 'No queue recoveries',
                  items:
                      snapshot.queueRecoveries.map(queueRecoveryItemView).toList(),
                  onAction: controller.performHiddenQueueRecoveryAction,
                ),
              ],
            );
            final side = HiddenEnterpriseSidePanel(
              stats: snapshot.stats,
              features: snapshot.hiddenFeatures,
              onActivateAll: controller.activateAllHiddenEnterprise,
              processing: controller.hiddenEnterpriseLoading,
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
