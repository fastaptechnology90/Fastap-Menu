import 'package:flutter/material.dart';

import '../../data/enterprise_feature_catalog.dart';
import '../common/mini_chip.dart';
import '../common/panel_card.dart';

class FeatureMatrix extends StatelessWidget {
  const FeatureMatrix({super.key});

  @override
  Widget build(BuildContext context) {
    return PanelCard(
      title: 'Enterprise Architecture Coverage',
      icon: Icons.account_tree_outlined,
      expandChild: false,
      child: Wrap(
        spacing: 8,
        runSpacing: 8,
        children: EnterpriseFeatureCatalog.systems
            .map((system) => MiniChip('${system.number}. ${system.title}'))
            .toList(),
      ),
    );
  }
}
