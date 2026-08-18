import 'package:flutter/material.dart';

import 'package:kitchenapp/core/constants/app_spacing.dart';
import 'package:kitchenapp/presentation/screens/profile/profile_widgets.dart';
import 'package:kitchenapp/presentation/widgets/common/primary_button.dart';
import 'package:kitchenapp/state/auth_controller.dart';

class ChangeEmailScreen extends StatefulWidget {
  const ChangeEmailScreen({super.key, required this.auth});

  final AuthController auth;

  @override
  State<ChangeEmailScreen> createState() => _ChangeEmailScreenState();
}

class _ChangeEmailScreenState extends State<ChangeEmailScreen> {
  late final TextEditingController _emailController;
  final _passwordController = TextEditingController();
  bool _loading = false;
  bool _obscure = true;

  @override
  void initState() {
    super.initState();
    _emailController = TextEditingController(
      text: widget.auth.session?.user.email ?? '',
    );
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final email = _emailController.text.trim();
    final password = _passwordController.text;
    if (email.isEmpty || !email.contains('@')) {
      showProfileSnackBar(context, 'Enter a valid email address', error: true);
      return;
    }
    if (password.isEmpty) {
      showProfileSnackBar(context, 'Enter your password to confirm', error: true);
      return;
    }

    setState(() => _loading = true);
    final ok = await widget.auth.changeEmail(
      email: email,
      password: password,
    );
    if (!mounted) return;
    setState(() => _loading = false);

    if (ok) {
      showProfileSnackBar(context, 'Work email updated successfully');
      Navigator.pop(context);
      return;
    }

    showProfileSnackBar(
      context,
      widget.auth.errorMessage ?? 'Unable to change email',
      error: true,
    );
  }

  @override
  Widget build(BuildContext context) {
    return ProfileScreenScaffold(
      title: 'Change email',
      subtitle: 'Update your work email address',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const ProfileInfoBanner(
            icon: Icons.email_outlined,
            message:
                'This email is used for kitchen alerts, shift summaries, and admin communications.',
          ),
          const SizedBox(height: AppSpacing.xl),
          ProfileFormField(
            label: 'New work email',
            controller: _emailController,
            icon: Icons.alternate_email_rounded,
            keyboardType: TextInputType.emailAddress,
          ),
          const SizedBox(height: AppSpacing.md),
          ProfileFormField(
            label: 'Current password',
            controller: _passwordController,
            icon: Icons.lock_outline,
            obscureText: _obscure,
          ),
          Align(
            alignment: Alignment.centerRight,
            child: TextButton(
              onPressed: () => setState(() => _obscure = !_obscure),
              child: Text(_obscure ? 'Show password' : 'Hide password'),
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          PrimaryButton(
            label: 'Update email',
            icon: Icons.mark_email_read_outlined,
            loading: _loading,
            onPressed: _loading ? null : _submit,
          ),
        ],
      ),
    );
  }
}
