import 'package:flutter/material.dart';

import 'package:kitchenapp/core/constants/app_colors.dart';
import 'package:kitchenapp/core/constants/app_spacing.dart';
import 'package:kitchenapp/navigation/module_screen_builder.dart';
import 'package:kitchenapp/presentation/screens/profile/change_email_screen.dart';
import 'package:kitchenapp/presentation/screens/profile/change_password_screen.dart';
import 'package:kitchenapp/presentation/screens/profile/delete_account_screen.dart';
import 'package:kitchenapp/presentation/screens/profile/edit_profile_screen.dart';
import 'package:kitchenapp/presentation/screens/profile/permissions_screen.dart';
import 'package:kitchenapp/presentation/screens/profile/profile_widgets.dart';
import 'package:kitchenapp/presentation/screens/profile/settings_screen.dart';
import 'package:kitchenapp/state/auth_controller.dart';
import 'package:kitchenapp/state/kitchen_command_controller.dart';

class ProfileTab extends StatelessWidget {
  const ProfileTab({
    super.key,
    required this.auth,
    required this.controller,
  });

  final AuthController auth;
  final KitchenCommandController controller;

  void _open<T extends Widget>(BuildContext context, T screen) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(builder: (_) => screen),
    );
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: auth,
      builder: (context, _) {
        final session = auth.session;
        final user = session?.user;
        final permissions = session?.permissions ?? [];

        return CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
                child: ProfileHeroCard(
                  user: user,
                  shiftId: session?.shiftId,
                  permissionCount: permissions.length,
                  onEdit: () => _open(context, EditProfileScreen(auth: auth)),
                ),
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 24),
              sliver: SliverList(
                delegate: SliverChildListDelegate([
                  const ProfileSectionTitle(
                    'Account',
                    subtitle: 'Manage your identity and security',
                  ),
                  ProfileMenuTile(
                    icon: Icons.person_outline,
                    title: 'Edit profile',
                    subtitle: 'Name, phone, and section',
                    onTap: () =>
                        _open(context, EditProfileScreen(auth: auth)),
                  ),
                  ProfileMenuTile(
                    icon: Icons.alternate_email_rounded,
                    title: 'Change email',
                    subtitle: user?.email.isNotEmpty == true
                        ? user!.email
                        : 'Add your work email',
                    color: AppColors.info,
                    onTap: () =>
                        _open(context, ChangeEmailScreen(auth: auth)),
                  ),
                  ProfileMenuTile(
                    icon: Icons.lock_reset_rounded,
                    title: 'Change password',
                    subtitle: 'Update your sign-in password',
                    color: const Color(0xff4338ca),
                    onTap: () =>
                        _open(context, ChangePasswordScreen(auth: auth)),
                  ),
                  ProfileMenuTile(
                    icon: Icons.settings_outlined,
                    title: 'Settings',
                    subtitle: 'Notifications, display, and app options',
                    onTap: () => _open(context, SettingsScreen(auth: auth)),
                  ),
                  ProfileMenuTile(
                    icon: Icons.security_rounded,
                    title: 'Permissions',
                    subtitle: '${permissions.length} capabilities granted',
                    onTap: () => _open(
                      context,
                      PermissionsScreen(auth: auth),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  const ProfileSectionTitle(
                    'Workspace',
                    subtitle: 'Staff tools linked to your role',
                  ),
                  if (auth.canAccessNav(8))
                    ProfileMenuTile(
                      icon: Icons.shield_outlined,
                      title: 'Authentication & Security',
                      subtitle:
                          'System 1 · login methods, roles, and security status',
                      color: AppColors.primary,
                      onTap: () => ModuleScreenBuilder.open(
                        context,
                        navIndex: 8,
                        controller: controller,
                        auth: auth,
                      ),
                    ),
                  if (auth.canAccessNav(8))
                    ProfileMenuTile(
                      icon: Icons.groups_2_outlined,
                      title: 'Staff command center',
                      subtitle: 'Tasks, performance, and wellness overview',
                      onTap: () => ModuleScreenBuilder.open(
                        context,
                        navIndex: 8,
                        controller: controller,
                        auth: auth,
                      ),
                    ),
                  if (auth.canAccessNav(33))
                    ProfileMenuTile(
                      icon: Icons.schedule_outlined,
                      title: 'My shifts',
                      onTap: () => ModuleScreenBuilder.open(
                        context,
                        navIndex: 33,
                        controller: controller,
                        auth: auth,
                      ),
                    ),
                  if (auth.canAccessNav(34))
                    ProfileMenuTile(
                      icon: Icons.self_improvement_outlined,
                      title: 'Wellness',
                      onTap: () => ModuleScreenBuilder.open(
                        context,
                        navIndex: 34,
                        controller: controller,
                        auth: auth,
                      ),
                    ),
                  const SizedBox(height: AppSpacing.sm),
                  const ProfileSectionTitle('Session'),
                  ProfileMenuTile(
                    icon: Icons.logout_rounded,
                    title: 'Sign out',
                    subtitle: 'End session on this device',
                    destructive: true,
                    onTap: () => _confirmSignOut(context),
                  ),
                  if (auth.canEmergencyLogout)
                    ProfileMenuTile(
                      icon: Icons.emergency_rounded,
                      title: 'Emergency logout',
                      subtitle: 'Instant lockdown — clears all kitchen sessions',
                      destructive: true,
                      onTap: () => _confirmEmergencyLogout(context),
                    ),
                  ProfileMenuTile(
                    icon: Icons.delete_forever_outlined,
                    title: 'Delete account',
                    subtitle: 'Permanently remove your access',
                    destructive: true,
                    onTap: () =>
                        _open(context, DeleteAccountScreen(auth: auth)),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                ]),
              ),
            ),
          ],
        );
      },
    );
  }

  Future<void> _confirmEmergencyLogout(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        title: const Text('Emergency logout?'),
        content: const Text(
          'This immediately ends your session and triggers a kitchen-wide '
          'security lockdown. Use only in emergencies.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.danger,
            ),
            child: const Text('Emergency logout'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      await auth.logout(emergency: true);
    }
  }

  Future<void> _confirmSignOut(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        title: const Text('Sign out?'),
        content: const Text(
          'You will need to sign in again to access the kitchen command center.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.danger,
            ),
            child: const Text('Sign out'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      await auth.logout();
    }
  }
}
