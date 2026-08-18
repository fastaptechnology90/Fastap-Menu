import 'package:flutter/material.dart';

import 'package:kitchenapp/core/constants/app_colors.dart';
import 'package:kitchenapp/core/constants/app_spacing.dart';
import 'package:kitchenapp/presentation/screens/profile/profile_widgets.dart';
import 'package:kitchenapp/state/auth_controller.dart';

class PermissionsScreen extends StatefulWidget {
  const PermissionsScreen({super.key, required this.auth});

  final AuthController auth;

  @override
  State<PermissionsScreen> createState() => _PermissionsScreenState();
}

class _PermissionsScreenState extends State<PermissionsScreen> {
  List<String> _permissions = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _permissions = widget.auth.session?.permissions ?? [];
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final permissions = await widget.auth.refreshPermissions();
      if (!mounted) return;
      setState(() {
        _permissions = permissions;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = widget.auth.errorMessage ?? 'Unable to load permissions';
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return ProfileScreenScaffold(
      title: 'Permissions',
      subtitle: _loading
          ? 'Loading capabilities…'
          : '${_permissions.length} capabilities granted',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const ProfileInfoBanner(
            icon: Icons.security_rounded,
            color: AppColors.primary,
            message:
                'These permissions control what you can view and action in the kitchen command center.',
          ),
          const SizedBox(height: AppSpacing.lg),
          if (_loading)
            const Center(
              child: Padding(
                padding: EdgeInsets.all(48),
                child: CircularProgressIndicator(),
              ),
            )
          else if (_error != null)
            _PermissionsError(message: _error!, onRetry: _load)
          else if (_permissions.isEmpty)
            const _PermissionsEmpty()
          else
            ..._permissions.map(
              (permission) => Padding(
                padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                child: Container(
                  padding: const EdgeInsets.all(AppSpacing.lg),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
                    border: Border.all(color: AppColors.panelBorder),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 36,
                        height: 36,
                        decoration: BoxDecoration(
                          color: AppColors.primary.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Icon(
                          _iconFor(permission),
                          color: AppColors.primary,
                          size: 18,
                        ),
                      ),
                      const SizedBox(width: AppSpacing.md),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              _labelFor(permission),
                              style: const TextStyle(
                                fontWeight: FontWeight.w800,
                                color: AppColors.primaryText,
                              ),
                            ),
                            Text(
                              permission,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                color: AppColors.secondaryText,
                                fontSize: 11,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const Icon(
                        Icons.check_circle_rounded,
                        color: AppColors.primary,
                        size: 20,
                      ),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  static IconData _iconFor(String permission) {
    if (permission.contains('emergency')) return Icons.emergency_rounded;
    if (permission.contains('staff')) return Icons.groups_rounded;
    if (permission.contains('inventory')) return Icons.inventory_2_outlined;
    if (permission.contains('report')) return Icons.analytics_outlined;
    if (permission.contains('order')) return Icons.receipt_long_outlined;
    return Icons.verified_outlined;
  }

  static String _labelFor(String permission) {
    return permission
        .split('.')
        .map(
          (part) => part.isEmpty
              ? part
              : '${part[0].toUpperCase()}${part.substring(1)}',
        )
        .join(' · ');
  }
}

class _PermissionsEmpty extends StatelessWidget {
  const _PermissionsEmpty();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.xl),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
        border: Border.all(color: AppColors.panelBorder),
      ),
      child: const Column(
        children: [
          Icon(Icons.lock_open_rounded, color: AppColors.secondaryText, size: 40),
          SizedBox(height: 12),
          Text(
            'No permissions assigned',
            style: TextStyle(
              fontWeight: FontWeight.w800,
              color: AppColors.primaryText,
            ),
          ),
          SizedBox(height: 6),
          Text(
            'Contact your kitchen admin to grant access to modules and actions.',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppColors.secondaryText, height: 1.4),
          ),
        ],
      ),
    );
  }
}

class _PermissionsError extends StatelessWidget {
  const _PermissionsError({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.xl),
      decoration: BoxDecoration(
        color: AppColors.danger.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
        border: Border.all(color: AppColors.danger.withValues(alpha: 0.2)),
      ),
      child: Column(
        children: [
          Text(
            message,
            textAlign: TextAlign.center,
            style: const TextStyle(color: AppColors.bodyText),
          ),
          const SizedBox(height: 12),
          OutlinedButton(onPressed: onRetry, child: const Text('Retry')),
        ],
      ),
    );
  }
}
