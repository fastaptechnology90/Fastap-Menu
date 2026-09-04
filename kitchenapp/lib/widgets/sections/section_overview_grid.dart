import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../core/theme/section_icons.dart';
import '../../models/sections/kitchen_section.dart';
import '../../state/kitchen_command_controller.dart';
import '../common/mini_chip.dart';
import '../common/panel_card.dart';
import '../common/station_load.dart';

class SectionOverviewGrid extends StatelessWidget {
  const SectionOverviewGrid({
    super.key,
    required this.sections,
    required this.controller,
  });

  final List<KitchenSectionProfile> sections;
  final KitchenCommandController controller;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final columns = constraints.maxWidth > 1100
            ? 4
            : constraints.maxWidth > 760
                ? 3
                : constraints.maxWidth > 480
                    ? 2
                    : 1;
        const spacing = 12.0;
        final cardWidth = columns == 1
            ? constraints.maxWidth
            : (constraints.maxWidth - spacing * (columns - 1)) / columns;

        return Wrap(
          spacing: spacing,
          runSpacing: spacing,
          children: [
            for (final section in sections)
              SizedBox(
                width: cardWidth,
                child: SectionCard(
                  section: section,
                  controller: controller,
                ),
              ),
          ],
        );
      },
    );
  }
}

class SectionCard extends StatelessWidget {
  const SectionCard({
    super.key,
    required this.section,
    required this.controller,
  });

  final KitchenSectionProfile section;
  final KitchenCommandController controller;

  @override
  Widget build(BuildContext context) {
    final color = section.isCritical
        ? AppColors.danger
        : section.isRush
            ? AppColors.warning
            : AppColors.primary;

    return PanelCard(
      title: section.label,
      icon: SectionIcons.forKey(section.iconKey),
      compact: true,
      trailing: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: color.withAlpha(24),
          borderRadius: BorderRadius.circular(6),
        ),
        child: Text(
          section.status.toUpperCase(),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            color: color,
            fontWeight: FontWeight.w900,
            fontSize: 10,
          ),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            'Head chef · ${section.headChef}',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: AppColors.secondaryText,
              fontWeight: FontWeight.w700,
              fontSize: 12,
            ),
          ),
          const SizedBox(height: 10),
          StationLoad(
            name: 'Section load',
            value: section.load.clamp(0.0, 1.0),
            meta: '${section.activeOrders}/${section.capacity} KOTs',
            color: color,
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              MiniChip('${section.staffAssigned} staff'),
              if (section.parallelPrep) const MiniChip('Parallel prep'),
              if (section.delayedOrders > 0)
                MiniChip('${section.delayedOrders} delayed'),
            ],
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton(
              onPressed: () => controller.selectSection(section.name),
              child: Text('Focus ${section.name}'),
            ),
          ),
        ],
      ),
    );
  }
}
