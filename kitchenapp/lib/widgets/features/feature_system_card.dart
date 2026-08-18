import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../data/feature_module_status_resolver.dart';
import '../../models/enterprise_feature_system.dart';
import '../common/panel_card.dart';
import 'feature_hook_chip.dart';
import 'feature_workflow_row.dart';

class FeatureSystemCard extends StatelessWidget {
  const FeatureSystemCard({
    super.key,
    required this.system,
    this.onOpenModule,
  });

  final EnterpriseFeatureSystem system;
  final VoidCallback? onOpenModule;

  @override
  Widget build(BuildContext context) {
    final status = FeatureModuleStatusResolver.statusFor(system.number);
    final hooks = FeatureModuleStatusResolver.hooksFor(system.number);

    return PanelCard(
      title: '${system.number}. ${system.title}',
      icon: status.icon,
      expandChild: false,
      trailing: Text(
        '${system.featureCount}',
        style: const TextStyle(
          color: AppColors.primary,
          fontWeight: FontWeight.w900,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 7,
                ),
                decoration: BoxDecoration(
                  color: status.color.withAlpha(22),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(status.icon, color: status.color, size: 16),
                    const SizedBox(width: 6),
                    Text(
                      status.label,
                      style: TextStyle(
                        color: status.color,
                        fontSize: 12,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              const Expanded(
                child: Text(
                  'UI + state + audit surface',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: AppColors.secondaryText,
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          for (final group in system.groups) ...[
            Text(
              group.title,
              style: const TextStyle(
                color: AppColors.primaryText,
                fontWeight: FontWeight.w900,
              ),
            ),
            const SizedBox(height: 8),
            Column(
              children: group.items
                  .map(
                    (item) => Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: FeatureWorkflowRow(label: item),
                    ),
                  )
                  .toList(),
            ),
            const SizedBox(height: 14),
          ],
          const Text(
            'Implementation Hooks',
            style: TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: hooks.map(FeatureHookChip.new).toList(),
          ),
          if (onOpenModule != null) ...[
            const SizedBox(height: 14),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: onOpenModule,
                icon: const Icon(Icons.open_in_new, size: 16),
                label: const Text('Open module'),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
