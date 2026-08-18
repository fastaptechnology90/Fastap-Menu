import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';

class FeatureHookChip extends StatelessWidget {
  const FeatureHookChip(this.label, {super.key});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: AppColors.info.withAlpha(18),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(
            Icons.cable_outlined,
            color: AppColors.info,
            size: 15,
          ),
          const SizedBox(width: 6),
          Text(
            label,
            style: const TextStyle(
              color: AppColors.info,
              fontSize: 12,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}
