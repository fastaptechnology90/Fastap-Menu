import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../data/enterprise_systems_catalog.dart';
import '../../data/feature_module_status_resolver.dart';

/// Expandable feature reference for any enterprise system (1–48).
class EnterpriseSystemCapabilitiesExpandable extends StatelessWidget {
  const EnterpriseSystemCapabilitiesExpandable({
    super.key,
    required this.systemNumber,
  });

  final int systemNumber;

  @override
  Widget build(BuildContext context) {
    final system = EnterpriseSystemsCatalog.system(systemNumber);
    final status = FeatureModuleStatusResolver.statusFor(systemNumber);
    final featureTotal = EnterpriseSystemsCatalog.featureCount(systemNumber);

    return Theme(
      data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
      child: ExpansionTile(
        initiallyExpanded: false,
        tilePadding: EdgeInsets.zero,
        childrenPadding: const EdgeInsets.only(bottom: 8),
        title: Text(
          'System $systemNumber · ${system.title}',
          style: TextStyle(
            fontWeight: FontWeight.w800,
            color: AppColors.primaryText,
            fontSize: 14,
          ),
        ),
        subtitle: Text(
          '$featureTotal features · ${status.label}',
          style: TextStyle(
            color: AppColors.secondaryText,
            fontSize: 12,
          ),
        ),
        children: [
          for (var i = 0; i < system.groups.length; i++) ...[
            if (i > 0) const SizedBox(height: 12),
            _FeatureSection(
              title: system.groups[i].title,
              items: system.groups[i].items,
            ),
          ],
        ],
      ),
    );
  }
}

class _FeatureSection extends StatelessWidget {
  const _FeatureSection({required this.title, required this.items});

  final String title;
  final List<String> items;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: TextStyle(
            fontWeight: FontWeight.w900,
            color: AppColors.primaryText,
            fontSize: 13,
          ),
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: items
              .map(
                (item) => Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: AppColors.chipBackground,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppColors.panelBorder),
                  ),
                  child: Text(
                    item,
                    style: TextStyle(
                      color: AppColors.bodyText,
                      fontWeight: FontWeight.w600,
                      fontSize: 12,
                    ),
                  ),
                ),
              )
              .toList(),
        ),
      ],
    );
  }
}
