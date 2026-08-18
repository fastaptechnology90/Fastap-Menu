import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';

class FeatureWorkflowRow extends StatelessWidget {
  const FeatureWorkflowRow({
    super.key,
    required this.label,
  });

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.chipBackground,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.panelBorder),
      ),
      child: Row(
        children: [
          const Icon(
            Icons.check_circle,
            color: AppColors.primary,
            size: 18,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              label,
              style: const TextStyle(
                color: AppColors.bodyText,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          const SizedBox(width: 8),
          const Text(
            'Enabled',
            style: TextStyle(
              color: AppColors.primary,
              fontSize: 12,
              fontWeight: FontWeight.w900,
            ),
          ),
        ],
      ),
    );
  }
}
