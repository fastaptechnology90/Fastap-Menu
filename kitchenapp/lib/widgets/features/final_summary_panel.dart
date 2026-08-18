import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../data/final_system_summary.dart';
import '../common/mini_chip.dart';
import '../common/panel_card.dart';

class FinalSummaryPanel extends StatelessWidget {
  const FinalSummaryPanel({super.key});

  @override
  Widget build(BuildContext context) {
    return PanelCard(
      title: 'Final System Summary',
      icon: Icons.verified_outlined,
      expandChild: false,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Fastap Kitchen App includes',
            style: TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children:
                FinalSystemSummary.includedCapabilities.map(MiniChip.new).toList(),
          ),
          const SizedBox(height: 16),
          const Text(
            'System scalable for',
            style: TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: FinalSystemSummary.scalableFor.map(MiniChip.new).toList(),
          ),
        ],
      ),
    );
  }
}
