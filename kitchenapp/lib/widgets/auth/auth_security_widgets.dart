import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../core/constants/app_spacing.dart';
import '../../data/staff_role_registry.dart';
import '../../data/auth_system_catalog.dart';
import '../../models/auth/login_method.dart';
import '../../models/auth/staff_role.dart';

class AuthLoginMethodsGrid extends StatelessWidget {
  const AuthLoginMethodsGrid({
    super.key,
    this.activeMethod,
    this.compact = false,
  });

  final String? activeMethod;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: LoginMethod.values.map((method) {
        final isActive = activeMethod != null &&
            (activeMethod == method.name ||
                activeMethod == method.label ||
                activeMethod == method.sessionKey);
        return _AuthCapabilityChip(
          icon: method.icon,
          label: method.label,
          active: isActive,
          compact: compact,
        );
      }).toList(),
    );
  }
}

class AuthStaffRolesGrid extends StatelessWidget {
  const AuthStaffRolesGrid({
    super.key,
    this.highlightRole,
    this.compact = false,
  });

  final StaffRole? highlightRole;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: StaffRoleRegistry.rolesForCurrentApp.map((role) {
        final isActive = highlightRole != null && role == highlightRole;
        return _AuthCapabilityChip(
          icon: role.icon,
          label: role.label,
          active: isActive,
          compact: compact,
        );
      }).toList(),
    );
  }
}

class AuthSecurityFeaturesGrid extends StatelessWidget {
  const AuthSecurityFeaturesGrid({super.key, this.compact = false});

  final bool compact;

  static const _icons = [
    Icons.schedule_rounded,
    Icons.phonelink_lock_rounded,
    Icons.timer_outlined,
    Icons.devices_other_outlined,
    Icons.emergency_outlined,
    Icons.location_on_outlined,
    Icons.history_rounded,
    Icons.admin_panel_settings_outlined,
    Icons.verified_user_outlined,
  ];

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        for (var i = 0; i < AuthSystemCatalog.securityFeatures.length; i++)
          _AuthCapabilityChip(
            icon: _icons[i],
            label: AuthSystemCatalog.securityFeatures[i],
            active: false,
            compact: compact,
          ),
      ],
    );
  }
}

class AuthSecurityFeatureTile extends StatelessWidget {
  const AuthSecurityFeatureTile({
    super.key,
    required this.icon,
    required this.label,
    required this.subtitle,
    required this.enabled,
  });

  final IconData icon;
  final String label;
  final String subtitle;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final color = enabled ? AppColors.primary : AppColors.secondaryText;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: enabled
            ? AppColors.primary.withValues(alpha: 0.06)
            : AppColors.chipBackground,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: enabled
              ? AppColors.primary.withValues(alpha: 0.22)
              : AppColors.panelBorder,
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: color, size: 18),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: TextStyle(
                    fontWeight: FontWeight.w800,
                    color: enabled
                        ? AppColors.primaryText
                        : AppColors.secondaryText,
                    fontSize: 13,
                  ),
                ),
                Text(
                  subtitle,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: AppColors.secondaryText,
                    fontSize: 11,
                    height: 1.3,
                  ),
                ),
              ],
            ),
          ),
          Icon(
            enabled ? Icons.check_circle_rounded : Icons.radio_button_unchecked,
            color: enabled ? AppColors.primary : AppColors.panelBorder,
            size: 18,
          ),
        ],
      ),
    );
  }
}

class AuthSectionHeader extends StatelessWidget {
  const AuthSectionHeader({
    super.key,
    required this.title,
    this.subtitle,
  });

  final String title;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(
              fontWeight: FontWeight.w900,
              color: AppColors.primaryText,
              fontSize: 14,
            ),
          ),
          if (subtitle != null)
            Text(
              subtitle!,
              style: const TextStyle(
                color: AppColors.secondaryText,
                fontSize: 12,
              ),
            ),
        ],
      ),
    );
  }
}

class _AuthCapabilityChip extends StatelessWidget {
  const _AuthCapabilityChip({
    required this.icon,
    required this.label,
    required this.active,
    required this.compact,
  });

  final IconData icon;
  final String label;
  final bool active;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: compact ? 8 : 10,
        vertical: compact ? 5 : 7,
      ),
      decoration: BoxDecoration(
        color: active
            ? AppColors.primary.withValues(alpha: 0.14)
            : Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: active ? AppColors.primary : AppColors.panelBorder,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            icon,
            size: compact ? 14 : 16,
            color: active ? AppColors.primary : AppColors.secondaryText,
          ),
          const SizedBox(width: 6),
          Text(
            label,
            style: TextStyle(
              fontSize: compact ? 11 : 12,
              fontWeight: FontWeight.w700,
              color: active ? AppColors.primary : AppColors.bodyText,
            ),
          ),
        ],
      ),
    );
  }
}
