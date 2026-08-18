import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../core/config/app_variant_config.dart';
import '../../data/staff_role_registry.dart';
import '../../data/auth_system_catalog.dart';
import 'auth_security_widgets.dart';

/// Flat expandable reference for System 1 — no hero card wrapper.
class AuthSystemCapabilitiesExpandable extends StatelessWidget {
  const AuthSystemCapabilitiesExpandable({super.key});

  @override
  Widget build(BuildContext context) {
    return Theme(
      data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
      child: ExpansionTile(
        tilePadding: EdgeInsets.zero,
        childrenPadding: const EdgeInsets.only(bottom: 8),
        title: const Text(
          AuthSystemCatalog.title,
          style: TextStyle(
            fontWeight: FontWeight.w800,
            color: AppColors.primaryText,
            fontSize: 14,
          ),
        ),
        subtitle: Text(
          '${AuthSystemCatalog.loginMethodCount} login methods · '
          '${StaffRoleRegistry.rolesForCurrentApp.length} staff roles · '
          '${AuthSystemCatalog.securityFeatureCount} security controls',
          style: const TextStyle(
            color: AppColors.secondaryText,
            fontSize: 12,
          ),
        ),
        children: [
          const AuthSectionHeader(
            title: 'Login methods',
            subtitle: 'All supported sign-in options',
          ),
          const AuthLoginMethodsGrid(),
          const SizedBox(height: 16),
          AuthSectionHeader(
            title: 'Staff roles',
            subtitle: '${AppVariantConfig.variantLabel} role mapping',
          ),
          const AuthStaffRolesGrid(),
          const SizedBox(height: 16),
          const AuthSectionHeader(
            title: 'Security features',
            subtitle: 'Enterprise controls enabled in-app',
          ),
          const AuthSecurityFeaturesGrid(),
        ],
      ),
    );
  }
}
