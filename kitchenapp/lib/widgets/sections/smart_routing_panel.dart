import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../models/sections/section_routing.dart';
import '../../state/kitchen_command_controller.dart';
import '../common/alert_row.dart';
import '../common/mini_chip.dart';
import '../common/panel_card.dart';

class SmartRoutingPanel extends StatelessWidget {
  const SmartRoutingPanel({
    super.key,
    required this.routing,
    required this.controller,
  });

  final SectionRoutingBoard routing;
  final KitchenCommandController controller;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        PanelCard(
          title: 'Smart Routing Engine',
          icon: Icons.hub_outlined,
          expandChild: false,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  if (routing.smartRouting.autoSectionAssignment)
                    const MiniChip('Auto section assignment'),
                  if (routing.smartRouting.multiSectionSplitting)
                    const MiniChip('Multi-section splitting'),
                  if (routing.smartRouting.parallelPreparation)
                    const MiniChip('Parallel preparation'),
                  if (routing.smartRouting.aiLoadBalancing)
                    const MiniChip('AI load balancing'),
                  if (routing.smartRouting.smartChefAllocation)
                    const MiniChip('Smart chef allocation'),
                  if (routing.smartRouting.queueOptimization)
                    const MiniChip('Queue optimization'),
                ],
              ),
              const SizedBox(height: 14),
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: controller.sectionsLoading
                      ? null
                      : () => controller.optimizeSectionQueue(),
                  icon: const Icon(Icons.auto_fix_high_outlined),
                  label: const Text('Run queue optimization'),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        PanelCard(
          title: 'Multi-Section Split Orders',
          icon: Icons.call_split_outlined,
          expandChild: false,
          child: Column(
            children: routing.splitOrders.map((split) {
              return Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.chipBackground,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppColors.panelBorder),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        split.kotNumber,
                        style: const TextStyle(fontWeight: FontWeight.w900),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        split.reason,
                        style: const TextStyle(color: AppColors.secondaryText),
                      ),
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 6,
                        runSpacing: 6,
                        children: split.sections.map(MiniChip.new).toList(),
                      ),
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 8,
                        children: [
                          OutlinedButton(
                            onPressed: () =>
                                controller.selectSection(split.primarySection),
                            child: Text('Focus ${split.primarySection}'),
                          ),
                          if (split.sections.length > 1)
                            OutlinedButton(
                              onPressed: () => controller.rerouteOrderToSection(
                                orderId: split.orderId,
                                section: split.sections.last,
                              ),
                              child: Text(
                                'Route to ${split.sections.last}',
                              ),
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
              );
            }).toList(),
          ),
        ),
        const SizedBox(height: 14),
        PanelCard(
          title: 'AI Recommendations',
          icon: Icons.psychology_alt_outlined,
          expandChild: false,
          child: Column(
            children: routing.recommendations.map((rec) {
              final color = switch (rec.severity) {
                'critical' => AppColors.danger,
                'warning' => AppColors.warning,
                _ => AppColors.info,
              };
              return Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    AlertRow(
                      title: rec.title,
                      body: rec.message,
                      icon: Icons.lightbulb_outline,
                      color: color,
                    ),
                    if (rec.action != 'none') ...[
                      const SizedBox(height: 8),
                      Align(
                        alignment: Alignment.centerRight,
                        child: FilledButton.tonal(
                          onPressed: controller.sectionsLoading
                              ? null
                              : () => _applyRecommendation(context, rec),
                          child: Text(_recommendationCta(rec.action)),
                        ),
                      ),
                    ],
                  ],
                ),
              );
            }).toList(),
          ),
        ),
        const SizedBox(height: 14),
        PanelCard(
          title: 'Routing Activity Log',
          icon: Icons.history_outlined,
          expandChild: false,
          child: Column(
            children: routing.routingLog.map((entry) {
              return Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(
                      Icons.fiber_manual_record,
                      size: 10,
                      color: AppColors.primary,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        entry.message,
                        style: const TextStyle(
                          color: AppColors.bodyText,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
              );
            }).toList(),
          ),
        ),
      ],
    );
  }

  Future<void> _applyRecommendation(
    BuildContext context,
    RoutingRecommendation rec,
  ) async {
    if (rec.action == 'assign_chef') {
      final chef = await _pickChef(context, rec.targetSection);
      if (!context.mounted || chef == null) {
        return;
      }
      await controller.assignSectionChef(
        sectionName: rec.targetSection,
        chefName: chef,
      );
      return;
    }

    await controller.applyRoutingRecommendation(rec);
  }

  Future<String?> _pickChef(BuildContext context, String sectionName) async {
    final headChef = controller.headChefForSection(sectionName);
    final defaultChef = headChef == null ? null : 'Relief · $headChef';
    final chefInput = TextEditingController(text: defaultChef);

    return showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Assign chef · $sectionName'),
        content: TextField(
          controller: chefInput,
          decoration: const InputDecoration(
            hintText: 'Chef name',
          ),
          autofocus: true,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, chefInput.text.trim()),
            child: const Text('Assign'),
          ),
        ],
      ),
    );
  }

  static String _recommendationCta(String action) {
    return switch (action) {
      'balance_load' => 'Balance load',
      'assign_chef' => 'Assign chef',
      _ => 'Apply',
    };
  }
}
