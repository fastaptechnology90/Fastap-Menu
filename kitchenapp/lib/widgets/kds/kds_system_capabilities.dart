import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../data/kds_system_catalog.dart';

/// Flat expandable reference for System 3 — no hero card wrapper.
class KdsSystemCapabilitiesExpandable extends StatelessWidget {
  const KdsSystemCapabilitiesExpandable({super.key});

  @override
  Widget build(BuildContext context) {
    return Theme(
      data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
      child: ExpansionTile(
        initiallyExpanded: false,
        tilePadding: EdgeInsets.zero,
        childrenPadding: const EdgeInsets.only(bottom: 8),
        title: Text(
          KdsSystemCatalog.title,
          style: TextStyle(
            fontWeight: FontWeight.w800,
            color: AppColors.primaryText,
            fontSize: 14,
          ),
        ),
        subtitle: Text(
          '${KdsSystemCatalog.kdsFeatureCount} KDS features · '
          '${KdsSystemCatalog.smartDisplayFeatureCount} smart display · '
          '${KdsSystemCatalog.statusTypeCount} status types',
          style: TextStyle(
            color: AppColors.secondaryText,
            fontSize: 12,
          ),
        ),
        children: [
          _FeatureSection(
            title: 'KDS features',
            items: KdsSystemCatalog.kdsFeatures,
          ),
          const SizedBox(height: 12),
          _FeatureSection(
            title: 'Smart display',
            items: KdsSystemCatalog.smartDisplayFeatures,
          ),
          const SizedBox(height: 12),
          _FeatureSection(
            title: 'KOT information',
            items: KdsSystemCatalog.kotInformation,
          ),
          const SizedBox(height: 12),
          _FeatureSection(
            title: 'Status types',
            items: KdsSystemCatalog.statusTypes,
          ),
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
