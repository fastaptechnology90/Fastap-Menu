import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../state/kitchen_command_controller.dart';
import '../../widgets/equipment/equipment_widgets.dart';

class EquipmentView extends StatelessWidget {
  const EquipmentView({super.key, required this.controller});

  final KitchenCommandController controller;

  @override
  Widget build(BuildContext context) {
    if (controller.equipmentLoading && controller.equipment == null) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(48),
          child: CircularProgressIndicator(),
        ),
      );
    }

    final snapshot = controller.equipment;
    if (snapshot == null) {
      return _EmptyState(
        message: controller.equipmentErrorMessage ??
            'Equipment management system unavailable',
        onRetry: () => controller.refreshEquipment(),
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
                    'System 30 · Equipment Management System',
                    style: TextStyle(
                      color: AppColors.primaryText,
                      fontWeight: FontWeight.w900,
                      fontSize: 18,
                    ),
                  ),
                  SizedBox(height: 4),
                  Text(
                    'Health · AMC · maintenance · breakdowns · usage',
                    style: TextStyle(
                      color: AppColors.secondaryText,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
              OutlinedButton.icon(
                onPressed: controller.equipmentLoading
                    ? null
                    : () => controller.refreshEquipment(),
                icon: const Icon(Icons.refresh, size: 18),
                label: const Text('Refresh'),
              ),
            ],
          ),
        ),
        if (controller.equipmentActionMessage != null) ...[
          const SizedBox(height: 12),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.primary.withValues(alpha: 0.2)),
            ),
            child: Text(
              controller.equipmentActionMessage!,
              style: const TextStyle(
                color: AppColors.primary,
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
                  'Equipment health tracking',
                  style: TextStyle(
                    color: AppColors.primaryText,
                    fontWeight: FontWeight.w800,
                    fontSize: 16,
                  ),
                ),
                const SizedBox(height: 12),
                ...snapshot.equipmentAssets.map(
                  (asset) => EquipmentAssetCard(
                    asset: asset,
                    onAction: (action) => controller.performEquipmentAction(
                      assetId: asset.id,
                      action: action,
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'AMC reminders',
                  style: TextStyle(
                    color: AppColors.primaryText,
                    fontWeight: FontWeight.w800,
                    fontSize: 16,
                  ),
                ),
                const SizedBox(height: 12),
                AmcReminderList(reminders: snapshot.amcReminders),
                const SizedBox(height: 8),
                const Text(
                  'Maintenance tickets',
                  style: TextStyle(
                    color: AppColors.primaryText,
                    fontWeight: FontWeight.w800,
                    fontSize: 16,
                  ),
                ),
                const SizedBox(height: 12),
                MaintenanceTicketList(
                  tickets: snapshot.maintenanceTickets,
                  onAction: (entry) => controller.performEquipmentAction(
                    assetId: entry.$1.assetId,
                    action: entry.$2,
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Breakdown alerts',
                  style: TextStyle(
                    color: AppColors.primaryText,
                    fontWeight: FontWeight.w800,
                    fontSize: 16,
                  ),
                ),
                const SizedBox(height: 12),
                BreakdownAlertList(
                  alerts: snapshot.breakdownAlerts,
                  onAction: (entry) => controller.performEquipmentAction(
                    assetId: entry.$1.assetId,
                    action: entry.$2,
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Usage analytics',
                  style: TextStyle(
                    color: AppColors.primaryText,
                    fontWeight: FontWeight.w800,
                    fontSize: 16,
                  ),
                ),
                const SizedBox(height: 12),
                UsageAnalyticsList(entries: snapshot.usageAnalytics),
              ],
            );
            final side = EquipmentSidePanel(
              stats: snapshot.stats,
              flags: snapshot.equipmentFeatures,
              onRaiseMaintenance: controller.raiseEquipmentMaintenance,
              processing: controller.equipmentLoading,
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
