import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../state/kitchen_command_controller.dart';
import '../../widgets/layout/responsive_columns.dart';
import '../../widgets/sections/section_overview_grid.dart';
import '../../widgets/sections/section_system_capabilities.dart';
import '../../widgets/sections/smart_routing_panel.dart';

class SectionManagementView extends StatelessWidget {
  const SectionManagementView({super.key, required this.controller});

  final KitchenCommandController controller;

  @override
  Widget build(BuildContext context) {
    if (controller.sectionsLoading && controller.sectionManagement == null) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(48),
          child: CircularProgressIndicator(),
        ),
      );
    }

    final snapshot = controller.sectionManagement;
    if (snapshot == null) {
      return _EmptyState(
        message: controller.sectionsErrorMessage ?? 'Sections unavailable',
        onRetry: () => controller.refreshSections(),
      );
    }

    final overview = snapshot.overview;
    final stats = overview.stats;

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
                    'System 4 · Multi Kitchen Section Management',
                    style: TextStyle(
                      color: AppColors.primaryText,
                      fontWeight: FontWeight.w900,
                      fontSize: 18,
                    ),
                  ),
                  SizedBox(height: 4),
                  Text(
                    '11 kitchen sections · smart routing · AI load balancing',
                    style: TextStyle(
                      color: AppColors.secondaryText,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
              OutlinedButton.icon(
                onPressed: controller.sectionsLoading
                    ? null
                    : () => controller.refreshSections(),
                icon: const Icon(Icons.refresh, size: 18),
                label: const Text('Refresh'),
              ),
            ],
          ),
        ),
        if (controller.sectionsActionMessage != null) ...[
          const SizedBox(height: 12),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.primary.withAlpha(20),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              controller.sectionsActionMessage!,
              style: const TextStyle(
                color: AppColors.primary,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
        ],
        const SizedBox(height: 14),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            _StatChip('${stats.totalSections} sections', AppColors.primary),
            _StatChip('${stats.onlineSections} online', AppColors.info),
            _StatChip('Busiest · ${stats.busiestSection}', AppColors.warning),
            _StatChip(
              'Avg load ${(stats.avgLoad * 100).round()}%',
              AppColors.premium,
            ),
          ],
        ),
        const SizedBox(height: 12),
        const SectionSystemCapabilitiesExpandable(),
        const SizedBox(height: 18),
        SectionOverviewGrid(
          sections: overview.sections,
          controller: controller,
        ),
        const SizedBox(height: 18),
        ResponsiveColumns(
          children: [
            SmartRoutingPanel(
              routing: snapshot.routing,
              controller: controller,
            ),
          ],
        ),
      ],
    );
  }
}

class _StatChip extends StatelessWidget {
  const _StatChip(this.label, this.color);

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withAlpha(24),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        label,
        style: TextStyle(color: color, fontWeight: FontWeight.w800, fontSize: 12),
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
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.panelBorder),
      ),
      child: Column(
        children: [
          const Icon(Icons.hub_outlined, size: 48, color: AppColors.primary),
          const SizedBox(height: 12),
          Text(message, textAlign: TextAlign.center),
          const SizedBox(height: 16),
          FilledButton.icon(
            onPressed: onRetry,
            icon: const Icon(Icons.refresh),
            label: const Text('Retry'),
          ),
        ],
      ),
    );
  }
}
