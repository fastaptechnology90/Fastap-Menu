import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../data/staff_role_registry.dart';
import '../../models/auth/staff_role.dart';

class StaffRoleDropdown extends StatelessWidget {
  const StaffRoleDropdown({
    super.key,
    required this.value,
    required this.onChanged,
    this.enabled = true,
  });

  final StaffRole value;
  final ValueChanged<StaffRole?>? onChanged;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Staff role',
          style: TextStyle(
            color: AppColors.primaryText,
            fontWeight: FontWeight.w800,
            fontSize: 13,
          ),
        ),
        const SizedBox(height: 8),
        DropdownButtonFormField<StaffRole>(
          initialValue: value,
          isExpanded: true,
          decoration: InputDecoration(
            filled: true,
            fillColor: Colors.white,
            prefixIcon: Icon(value.icon, color: AppColors.primary),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: AppColors.panelBorder),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: AppColors.panelBorder),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
            ),
            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
          ),
          items: StaffRoleRegistry.rolesForCurrentApp
              .map(
                (role) => DropdownMenuItem(
                  value: role,
                  child: Row(
                    children: [
                      Icon(role.icon, size: 20, color: AppColors.primary),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          role.label,
                          style: const TextStyle(
                            color: AppColors.primaryText,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              )
              .toList(),
          onChanged: enabled ? onChanged : null,
        ),
      ],
    );
  }
}
