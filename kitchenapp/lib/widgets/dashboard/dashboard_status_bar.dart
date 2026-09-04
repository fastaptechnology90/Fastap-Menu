import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../core/constants/app_spacing.dart';
import '../../presentation/screens/main/widgets/home_summary.dart';
import '../../state/kitchen_command_controller.dart';

class DashboardStatusBar extends StatelessWidget {
  const DashboardStatusBar({
    super.key,
    required this.controller,
    required this.onRefresh,
  });

  final KitchenCommandController controller;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) {
    final synced = controller.lastSyncedAt;
    final syncLabel = synced == null
        ? 'Waiting for sync'
        : 'Updated ${_formatTime(synced)}';
    final orderCount = controller.dashboard?.orders.length ?? 0;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        HomeSectionTitle(
          title: 'Kitchen Dashboard',
          subtitle: 'Section ${controller.selectedSection}',
          trailing: IconButton(
            onPressed: controller.refreshing ? null : onRefresh,
            icon: controller.refreshing
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.refresh_rounded),
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.sm,
          children: [
            _HeaderChip(icon: Icons.sync_rounded, label: syncLabel),
            _HeaderChip(
              icon: Icons.receipt_long_rounded,
              label: '$orderCount active KOT${orderCount == 1 ? '' : 's'}',
            ),
            _HeaderChip(
              icon: Icons.grid_view_rounded,
              label: '${controller.sections.length} sections',
            ),
          ],
        ),
      ],
    );
  }

  String _formatTime(DateTime time) {
    final hour = time.hour.toString().padLeft(2, '0');
    final minute = time.minute.toString().padLeft(2, '0');
    return '$hour:$minute';
  }
}

class _HeaderChip extends StatelessWidget {
  const _HeaderChip({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: AppColors.chipBackground,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.panelBorder),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: AppColors.primary),
          const SizedBox(width: 6),
          Text(
            label,
            style: TextStyle(
              color: AppColors.bodyText,
              fontSize: 11,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}
