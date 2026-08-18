import 'package:flutter/material.dart';

import 'package:kitchenapp/core/constants/app_colors.dart';
import 'package:kitchenapp/core/constants/app_spacing.dart';
import 'package:kitchenapp/presentation/screens/profile/profile_widgets.dart';
import 'package:kitchenapp/presentation/widgets/common/primary_button.dart';
import 'package:kitchenapp/state/auth_controller.dart';

class DeleteAccountScreen extends StatefulWidget {
  const DeleteAccountScreen({super.key, required this.auth});

  final AuthController auth;

  @override
  State<DeleteAccountScreen> createState() => _DeleteAccountScreenState();
}

class _DeleteAccountScreenState extends State<DeleteAccountScreen> {
  final _passwordController = TextEditingController();
  final _confirmController = TextEditingController();
  bool _loading = false;
  bool _acknowledged = false;

  @override
  void dispose() {
    _passwordController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_acknowledged) {
      showProfileSnackBar(
        context,
        'Please acknowledge the consequences first',
        error: true,
      );
      return;
    }

    setState(() => _loading = true);
    final ok = await widget.auth.deleteAccount(
      password: _passwordController.text,
      confirmation: _confirmController.text.trim(),
    );
    if (!mounted) return;
    setState(() => _loading = false);

    if (ok) {
      if (!context.mounted) return;
      Navigator.of(context).popUntil((route) => route.isFirst);
      return;
    }

    showProfileSnackBar(
      context,
      widget.auth.errorMessage ?? 'Unable to delete account',
      error: true,
    );
  }

  @override
  Widget build(BuildContext context) {
    return ProfileScreenScaffold(
      title: 'Delete account',
      subtitle: 'Permanent removal from kitchen workspace',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.all(AppSpacing.lg),
            decoration: BoxDecoration(
              color: AppColors.danger.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
              border: Border.all(color: AppColors.danger.withValues(alpha: 0.24)),
            ),
            child: const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(Icons.warning_amber_rounded, color: AppColors.danger),
                    SizedBox(width: 10),
                    Text(
                      'This action is irreversible',
                      style: TextStyle(
                        color: AppColors.danger,
                        fontWeight: FontWeight.w900,
                        fontSize: 16,
                      ),
                    ),
                  ],
                ),
                SizedBox(height: 10),
                Text(
                  'Deleting your account removes access to KDS, shifts, alerts, and all kitchen modules. '
                  'Your admin may need to re-provision access if you return.',
                  style: TextStyle(color: AppColors.bodyText, height: 1.45),
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.xl),
          CheckboxListTile(
            value: _acknowledged,
            onChanged: (value) => setState(() => _acknowledged = value ?? false),
            contentPadding: EdgeInsets.zero,
            controlAffinity: ListTileControlAffinity.leading,
            title: const Text(
              'I understand this permanently deletes my account',
              style: TextStyle(fontWeight: FontWeight.w600),
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          ProfileFormField(
            label: 'Account password',
            controller: _passwordController,
            icon: Icons.lock_outline,
            obscureText: true,
          ),
          const SizedBox(height: AppSpacing.md),
          ProfileFormField(
            label: 'Type DELETE to confirm',
            controller: _confirmController,
            icon: Icons.delete_forever_outlined,
          ),
          const SizedBox(height: AppSpacing.xxl),
          PrimaryButton(
            label: 'Delete my account',
            icon: Icons.delete_outline,
            loading: _loading,
            onPressed: _loading || !_acknowledged ? null : _submit,
          ),
        ],
      ),
    );
  }
}
