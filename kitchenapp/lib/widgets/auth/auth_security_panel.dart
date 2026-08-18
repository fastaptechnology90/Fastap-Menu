import 'package:flutter/material.dart';

import '../../core/config/api_config.dart';
import '../../core/constants/app_colors.dart';
import '../../core/constants/app_spacing.dart';
import '../../models/auth/login_method.dart';
import '../../presentation/screens/profile/profile_widgets.dart';
import '../../state/auth_controller.dart';
import '../../widgets/auth/role_badge.dart';
import '../common/mini_chip.dart';
import '../common/panel_card.dart';
import '../common/station_load.dart';
import 'auth_security_widgets.dart';

String _formatShiftEnd(Object? value) {
  if (value == null) return '—';
  final parsed = DateTime.tryParse(value.toString());
  if (parsed == null) return value.toString();
  final hour = parsed.hour % 12 == 0 ? 12 : parsed.hour % 12;
  final minute = parsed.minute.toString().padLeft(2, '0');
  final period = parsed.hour >= 12 ? 'PM' : 'AM';
  return '$hour:$minute $period';
}

class AuthSecurityPanel extends StatelessWidget {
  const AuthSecurityPanel({super.key, required this.auth});

  final AuthController auth;

  @override
  Widget build(BuildContext context) {
    final session = auth.session;
    if (session == null) {
      return const SizedBox.shrink();
    }

    final user = session.user;
    final expiresIn = session.expiresAt.difference(DateTime.now());
    final hoursLeft = expiresIn.inHours;
    final minutesLeft = expiresIn.inMinutes.remainder(60);
    final sessionRatio =
        (expiresIn.inMinutes / (ApiConfig.sessionTimeoutMinutes * 60))
            .clamp(0.0, 1.0);

    return PanelCard(
      title: 'System 1 · Authentication & Security',
      icon: Icons.shield_outlined,
      expandChild: false,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ProfileAvatarImage(
                name: user.name,
                avatarUrl: user.avatarUrl,
                size: 56,
                borderRadius: 18,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      user.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: AppColors.primaryText,
                        fontWeight: FontWeight.w900,
                        fontSize: 16,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${user.staffCode} · ${user.section}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(color: AppColors.secondaryText),
                    ),
                    const SizedBox(height: 8),
                    RoleBadge(role: user.role, compact: true),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),
          StationLoad(
            name: 'Session validity',
            value: sessionRatio,
            meta: '${hoursLeft}h ${minutesLeft}m remaining',
            color: sessionRatio < 0.2 ? AppColors.danger : AppColors.primary,
          ),
          const SizedBox(height: AppSpacing.md),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              MiniChip('Login: ${LoginMethod.displayLabel(session.loginMethod)}'),
              MiniChip('Shift: ${session.shiftId}'),
              MiniChip(session.geoVerified ? 'Geo verified' : 'Geo blocked'),
              MiniChip('Device ${session.deviceId.substring(0, 8)}'),
              if (auth.canEmergencyLogout)
                const MiniChip('Emergency logout enabled'),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),
          const AuthSectionHeader(
            title: 'Login method used',
            subtitle: 'All 7 enterprise login methods supported',
          ),
          AuthLoginMethodsGrid(activeMethod: session.loginMethod, compact: true),
          const SizedBox(height: AppSpacing.lg),
          const AuthSectionHeader(
            title: 'Staff role',
            subtitle: '12 kitchen roles with permission mapping',
          ),
          AuthStaffRolesGrid(highlightRole: user.role, compact: true),
          const SizedBox(height: AppSpacing.lg),
          AuthSectionHeader(
            title: 'Active permissions',
            subtitle: '${session.permissions.length} capabilities granted',
          ),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: session.permissions.map(MiniChip.new).toList(),
          ),
          const SizedBox(height: AppSpacing.lg),
          const AuthSectionHeader(
            title: 'Security controls',
            subtitle: 'Live status from your authenticated session',
          ),
          FutureBuilder<Map<String, dynamic>>(
            future: auth.authService.fetchCurrentShift(),
            builder: (context, snapshot) {
              final shift = snapshot.data;
              final subtitle = shift != null
                  ? 'Shift ${shift['id']} · ends ${_formatShiftEnd(shift['endsAt'])}'
                  : 'Active shift ${session.shiftId}';
              return AuthSecurityFeatureTile(
                icon: Icons.schedule_rounded,
                label: 'Shift-based login',
                subtitle: subtitle,
                enabled: session.shiftId.isNotEmpty,
              );
            },
          ),
          const SizedBox(height: 8),
          AuthSecurityFeatureTile(
            icon: Icons.phonelink_lock_rounded,
            label: 'Device binding',
            subtitle: 'Bound to ${session.deviceId.substring(0, 12)}…',
            enabled: session.deviceId.isNotEmpty,
          ),
          const SizedBox(height: 8),
          AuthSecurityFeatureTile(
            icon: Icons.timer_outlined,
            label: 'Session timeout',
            subtitle:
                '${ApiConfig.sessionTimeoutMinutes ~/ 60}h idle · 8h absolute',
            enabled: !session.isExpired,
          ),
          const SizedBox(height: 8),
          AuthSecurityFeatureTile(
            icon: Icons.devices_other_outlined,
            label: 'Multi-device restriction',
            subtitle: 'Single active device per staff account',
            enabled: true,
          ),
          const SizedBox(height: 8),
          AuthSecurityFeatureTile(
            icon: Icons.emergency_outlined,
            label: 'Emergency logout',
            subtitle: auth.canEmergencyLogout
                ? 'Authorized for this role'
                : 'Requires emergency.logout permission',
            enabled: auth.canEmergencyLogout,
          ),
          const SizedBox(height: 8),
          AuthSecurityFeatureTile(
            icon: Icons.location_on_outlined,
            label: 'Geo restriction',
            subtitle: session.geoVerified
                ? 'Kitchen perimeter verified'
                : 'Outside allowed kitchen zone',
            enabled: session.geoVerified,
          ),
          const SizedBox(height: 8),
          AuthSecurityFeatureTile(
            icon: Icons.history_rounded,
            label: 'Activity tracking',
            subtitle: 'Login and workspace actions audited',
            enabled: true,
          ),
          const SizedBox(height: 8),
          AuthSecurityFeatureTile(
            icon: Icons.admin_panel_settings_outlined,
            label: 'Permission control',
            subtitle: '${session.permissions.length} scoped capabilities',
            enabled: session.permissions.isNotEmpty,
          ),
          const SizedBox(height: 8),
          AuthSecurityFeatureTile(
            icon: Icons.verified_user_outlined,
            label: 'Secure session handling',
            subtitle: 'Token-bound API session with restore',
            enabled: session.token.isNotEmpty,
          ),
        ],
      ),
    );
  }
}
