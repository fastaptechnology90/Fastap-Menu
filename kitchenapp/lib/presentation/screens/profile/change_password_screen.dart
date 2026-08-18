import 'package:flutter/material.dart';

import 'package:kitchenapp/core/constants/app_colors.dart';
import 'package:kitchenapp/core/constants/app_spacing.dart';
import 'package:kitchenapp/presentation/screens/profile/profile_widgets.dart';
import 'package:kitchenapp/presentation/widgets/common/primary_button.dart';
import 'package:kitchenapp/state/auth_controller.dart';

class ChangePasswordScreen extends StatefulWidget {
  const ChangePasswordScreen({super.key, required this.auth});

  final AuthController auth;

  @override
  State<ChangePasswordScreen> createState() => _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends State<ChangePasswordScreen> {
  final _currentController = TextEditingController();
  final _newController = TextEditingController();
  final _confirmController = TextEditingController();
  bool _loading = false;
  bool _showCurrent = false;
  bool _showNew = false;
  bool _showConfirm = false;

  @override
  void dispose() {
    _currentController.dispose();
    _newController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  String get _strengthLabel {
    final value = _newController.text;
    if (value.length < 6) return 'Too short';
    if (value.length < 8) return 'Fair';
    if (RegExp(r'[A-Z]').hasMatch(value) && RegExp(r'[0-9]').hasMatch(value)) {
      return 'Strong';
    }
    return 'Good';
  }

  Color get _strengthColor {
    return switch (_strengthLabel) {
      'Too short' => AppColors.danger,
      'Fair' => AppColors.warning,
      'Good' => AppColors.info,
      _ => AppColors.primary,
    };
  }

  Future<void> _submit() async {
    final current = _currentController.text;
    final next = _newController.text;
    final confirm = _confirmController.text;

    if (current.isEmpty || next.isEmpty) {
      showProfileSnackBar(context, 'Fill in all password fields', error: true);
      return;
    }
    if (next.length < 6) {
      showProfileSnackBar(
        context,
        'New password must be at least 6 characters',
        error: true,
      );
      return;
    }
    if (next != confirm) {
      showProfileSnackBar(context, 'New passwords do not match', error: true);
      return;
    }

    setState(() => _loading = true);
    final ok = await widget.auth.changePassword(
      currentPassword: current,
      newPassword: next,
    );
    if (!mounted) return;
    setState(() => _loading = false);

    if (ok) {
      showProfileSnackBar(context, 'Password changed successfully');
      Navigator.pop(context);
      return;
    }

    showProfileSnackBar(
      context,
      widget.auth.errorMessage ?? 'Unable to change password',
      error: true,
    );
  }

  @override
  Widget build(BuildContext context) {
    return ProfileScreenScaffold(
      title: 'Change password',
      subtitle: 'Keep your kitchen account secure',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const ProfileInfoBanner(
            icon: Icons.shield_outlined,
            color: AppColors.primary,
            message:
                'Use a unique password with letters and numbers. You will stay signed in after updating.',
          ),
          const SizedBox(height: AppSpacing.xl),
          ProfileFormField(
            label: 'Current password',
            controller: _currentController,
            icon: Icons.lock_outline,
            obscureText: !_showCurrent,
          ),
          Align(
            alignment: Alignment.centerRight,
            child: TextButton(
              onPressed: () => setState(() => _showCurrent = !_showCurrent),
              child: Text(_showCurrent ? 'Hide' : 'Show'),
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          ProfileFormField(
            label: 'New password',
            controller: _newController,
            icon: Icons.lock_reset_rounded,
            obscureText: !_showNew,
            onChanged: (_) => setState(() {}),
          ),
          Align(
            alignment: Alignment.centerRight,
            child: TextButton(
              onPressed: () => setState(() => _showNew = !_showNew),
              child: Text(_showNew ? 'Hide new password' : 'Show new password'),
            ),
          ),
          if (_newController.text.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.sm),
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: _strengthColor.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    'Strength: $_strengthLabel',
                    style: TextStyle(
                      color: _strengthColor,
                      fontWeight: FontWeight.w800,
                      fontSize: 12,
                    ),
                  ),
                ),
              ],
            ),
          ],
          const SizedBox(height: AppSpacing.md),
          ProfileFormField(
            label: 'Confirm new password',
            controller: _confirmController,
            icon: Icons.verified_user_outlined,
            obscureText: !_showConfirm,
          ),
          Align(
            alignment: Alignment.centerRight,
            child: TextButton(
              onPressed: () => setState(() => _showConfirm = !_showConfirm),
              child: Text(_showConfirm ? 'Hide confirm password' : 'Show confirm password'),
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          PrimaryButton(
            label: 'Update password',
            icon: Icons.check_circle_outline,
            loading: _loading,
            onPressed: _loading ? null : _submit,
          ),
        ],
      ),
    );
  }
}
