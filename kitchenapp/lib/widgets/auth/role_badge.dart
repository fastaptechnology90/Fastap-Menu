import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../models/auth/staff_role.dart';

class RoleBadge extends StatelessWidget {
  const RoleBadge({super.key, required this.role, this.compact = false});

  final StaffRole role;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: compact ? 10 : 12,
        vertical: compact ? 6 : 8,
      ),
      decoration: BoxDecoration(
        color: AppColors.primary.withAlpha(24),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.primary.withAlpha(60)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(role.icon, size: compact ? 16 : 18, color: AppColors.primary),
          const SizedBox(width: 6),
          Text(
            role.label,
            style: TextStyle(
              color: AppColors.primary,
              fontWeight: FontWeight.w800,
              fontSize: compact ? 12 : 13,
            ),
          ),
        ],
      ),
    );
  }
}
