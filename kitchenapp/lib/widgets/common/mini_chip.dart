import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';

class MiniChip extends StatelessWidget {
  const MiniChip(this.label, {super.key});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Chip(
      visualDensity: VisualDensity.compact,
      side: const BorderSide(color: AppColors.panelBorder),
      backgroundColor: AppColors.chipBackground,
      label: Text(
        label,
        style: const TextStyle(
          color: AppColors.bodyText,
          fontSize: 12,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}
