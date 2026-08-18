import 'package:flutter/material.dart';

import 'package:kitchenapp/core/constants/app_colors.dart';
import 'package:kitchenapp/core/constants/app_spacing.dart';
import 'package:kitchenapp/presentation/screens/main/widgets/home_summary.dart';
import 'package:kitchenapp/state/kitchen_command_controller.dart';

class KitchenFloorHeader extends StatelessWidget {
  const KitchenFloorHeader({
    super.key,
    required this.controller,
    required this.onRefresh,
  });

  final KitchenCommandController controller;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) {
    final kdsStats = controller.kds?.stats;
    final syncing = controller.kdsLoading || controller.refreshing;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        HomeSectionTitle(
          title: 'Kitchen floor',
          subtitle: 'Section ${controller.selectedSection}',
          trailing: IconButton(
            onPressed: syncing ? null : onRefresh,
            icon: syncing
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.refresh_rounded),
          ),
        ),
        if (kdsStats != null) ...[
          const SizedBox(height: AppSpacing.sm),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: [
              _LiveChip(
                icon: Icons.receipt_long_rounded,
                label: '${kdsStats.total} live KOTs',
              ),
              _LiveChip(
                icon: Icons.timer_off_rounded,
                label: '${kdsStats.delayed} delayed',
              ),
              _LiveChip(
                icon: Icons.workspace_premium_outlined,
                label: '${kdsStats.vip} VIP',
              ),
              _LiveChip(
                icon: Icons.priority_high_rounded,
                label: '${kdsStats.priority} priority',
              ),
            ],
          ),
        ],
      ],
    );
  }
}

class _LiveChip extends StatelessWidget {
  const _LiveChip({required this.icon, required this.label});

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
            style: const TextStyle(
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

class KitchenSubTabBar extends StatelessWidget {
  const KitchenSubTabBar({
    super.key,
    required this.controller,
    required this.tabs,
    required this.badges,
  });

  final TabController controller;
  final List<KitchenSubTab> tabs;
  final List<String?> badges;

  @override
  Widget build(BuildContext context) {
    return TabBar(
      controller: controller,
      isScrollable: true,
      tabAlignment: TabAlignment.start,
      labelColor: AppColors.primary,
      unselectedLabelColor: AppColors.secondaryText,
      indicatorColor: AppColors.primary,
      dividerColor: AppColors.panelBorder,
      tabs: [
        for (var i = 0; i < tabs.length; i++)
          Tab(
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(tabs[i].icon, size: 18),
                const SizedBox(width: 6),
                Text(tabs[i].label),
                if (badges[i] != null) ...[
                  const SizedBox(width: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 6,
                      vertical: 2,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.primary.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(
                      badges[i]!,
                      style: const TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
      ],
    );
  }
}

class KitchenSubTab {
  const KitchenSubTab(this.label, this.icon, this.navIndex);

  final String label;
  final IconData icon;
  final int navIndex;
}

class KitchenOpenModuleButton extends StatelessWidget {
  const KitchenOpenModuleButton({
    super.key,
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.onTap,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
          child: Row(
            children: [
              Icon(icon, color: AppColors.primary, size: 22),
              const SizedBox(width: AppSpacing.lg),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        fontWeight: FontWeight.w900,
                        color: AppColors.primaryText,
                        fontSize: 15,
                      ),
                    ),
                    Text(
                      subtitle,
                      style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.secondaryText,
                      ),
                    ),
                  ],
                ),
              ),
              const Icon(
                Icons.chevron_right_rounded,
                color: AppColors.secondaryText,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
