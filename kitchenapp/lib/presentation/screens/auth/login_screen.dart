import 'package:flutter/material.dart';

import 'package:kitchenapp/core/config/app_variant_content.dart';
import 'package:kitchenapp/core/constants/app_colors.dart';
import 'package:kitchenapp/presentation/widgets/common/app_logo.dart';
import 'package:kitchenapp/presentation/widgets/common/primary_button.dart';
import 'package:kitchenapp/models/auth/staff_role.dart';
import 'package:kitchenapp/state/auth_controller.dart';
import 'package:kitchenapp/widgets/auth/auth_system_capabilities.dart';
import 'package:kitchenapp/widgets/auth/login_form_panel.dart';
import 'package:kitchenapp/widgets/auth/staff_role_dropdown.dart';

class LoginScreen extends StatelessWidget {
  const LoginScreen({super.key, required this.auth});

  final AuthController auth;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: AppVariantContent.backgroundGradient,
          ),
        ),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 480),
                child: _LoginColumn(auth: auth),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _LoginColumn extends StatelessWidget {
  const _LoginColumn({required this.auth});

  final AuthController auth;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Center(child: AppLogo(size: 52)),
        const SizedBox(height: 20),
        Text(
          AppVariantContent.loginTitle,
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 28,
            fontWeight: FontWeight.w900,
            color: AppColors.primaryText,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          AppVariantContent.loginSubtitle,
          textAlign: TextAlign.center,
          style: TextStyle(
            color: AppColors.secondaryText,
            fontWeight: FontWeight.w500,
            height: 1.4,
          ),
        ),
        const SizedBox(height: 20),
        LoginFormPanel(auth: auth),
        const SizedBox(height: 12),
        const AuthSystemCapabilitiesExpandable(),
        const SizedBox(height: 16),
        Wrap(
          alignment: WrapAlignment.center,
          crossAxisAlignment: WrapCrossAlignment.center,
          spacing: 4,
          children: [
            TextButton(
              onPressed: () => Navigator.push(
                context,
                MaterialPageRoute<void>(
                  builder: (_) => ForgotPasswordScreen(auth: auth),
                ),
              ),
              child: const Text('Forgot password?'),
            ),
            Text('·', style: TextStyle(color: AppColors.panelBorder)),
            TextButton(
              onPressed: () => Navigator.push(
                context,
                MaterialPageRoute<void>(
                  builder: (_) => SignupScreen(auth: auth),
                ),
              ),
              child: const Text('Request access'),
            ),
          ],
        ),
      ],
    );
  }
}

class SignupScreen extends StatefulWidget {
  const SignupScreen({super.key, required this.auth});

  final AuthController auth;

  @override
  State<SignupScreen> createState() => _SignupScreenState();
}

class _SignupScreenState extends State<SignupScreen> {
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _phoneController = TextEditingController();
  final _staffCodeController = TextEditingController();
  bool _loading = false;
  String? _errorMessage;
  StaffRole _selectedRole = StaffRole.lineCook;

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _staffCodeController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final name = _nameController.text.trim();
    final email = _emailController.text.trim();
    final phone = _phoneController.text.trim();
    final staffCode = _staffCodeController.text.trim();

    if (name.isEmpty || email.isEmpty || phone.isEmpty || staffCode.isEmpty) {
      setState(() => _errorMessage = 'Please fill in all fields.');
      return;
    }

    setState(() {
      _loading = true;
      _errorMessage = null;
    });

    final success = await widget.auth.submitAccessRequest(
      name: name,
      email: email,
      phone: phone,
      staffCode: staffCode,
      role: _selectedRole,
    );

    if (!mounted) return;
    setState(() => _loading = false);

    if (!success) {
      setState(() => _errorMessage = widget.auth.errorMessage);
      return;
    }

    await showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        title: const Text('Registration submitted'),
        content: const Text(
          'Your kitchen admin will review and activate your staff account. '
          'You will receive credentials via SMS once approved.',
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              Navigator.pop(context);
            },
            child: const Text('Back to login'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Request kitchen access')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Join the kitchen team',
              style: TextStyle(
                fontSize: 26,
                fontWeight: FontWeight.w900,
                color: AppColors.primaryText,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Submit your details. An administrator will approve your access.',
              style: TextStyle(color: AppColors.secondaryText, height: 1.4),
            ),
            const SizedBox(height: 24),
            _field('Full name', _nameController, Icons.person_outline),
            const SizedBox(height: 14),
            _field('Work email', _emailController, Icons.email_outlined),
            const SizedBox(height: 14),
            _field(
              'Mobile number',
              _phoneController,
              Icons.phone_outlined,
              hint: '+1XXXXXXXXXX',
            ),
            const SizedBox(height: 14),
            _field(
              'Requested staff code',
              _staffCodeController,
              Icons.badge_outlined,
              hint: 'Staff code',
            ),
            const SizedBox(height: 14),
            StaffRoleDropdown(
              value: _selectedRole,
              enabled: !_loading,
              onChanged: (role) {
                if (role != null) {
                  setState(() => _selectedRole = role);
                }
              },
            ),
            if (_errorMessage != null) ...[
              const SizedBox(height: 16),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.danger.withAlpha(20),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: AppColors.danger.withAlpha(80)),
                ),
                child: Text(
                  _errorMessage!,
                  style: TextStyle(
                    color: AppColors.danger,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
            const SizedBox(height: 28),
            PrimaryButton(
              label: 'Submit registration',
              loading: _loading,
              icon: Icons.send_rounded,
              onPressed: _submit,
            ),
          ],
        ),
      ),
    );
  }

  Widget _field(
    String label,
    TextEditingController controller,
    IconData icon, {
    String? hint,
  }) {
    return TextField(
      controller: controller,
      decoration: InputDecoration(
        labelText: label,
        hintText: hint,
        prefixIcon: Icon(icon),
        filled: true,
        fillColor: AppColors.surface,
      ),
    );
  }
}

class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key, required this.auth});

  final AuthController auth;

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final _phoneController = TextEditingController();
  final _otpController = TextEditingController();
  bool _otpSent = false;

  @override
  void dispose() {
    _phoneController.dispose();
    _otpController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_otpSent) {
      final ok = await widget.auth.requestOtp(_phoneController.text.trim());
      if (ok && mounted) {
        setState(() => _otpSent = true);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('OTP sent to your registered mobile')),
        );
      }
      return;
    }

    final ok = await widget.auth.verifyOtp(
      _phoneController.text.trim(),
      _otpController.text.trim(),
    );
    if (ok && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Verified — you are now signed in')),
      );
      Navigator.popUntil(context, (route) => route.isFirst);
    } else if (mounted && widget.auth.errorMessage != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(widget.auth.errorMessage!),
          backgroundColor: AppColors.danger,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final loading = widget.auth.status == AuthStatus.loading;

    return Scaffold(
      appBar: AppBar(title: const Text('Reset access')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: AppColors.info.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.info.withValues(alpha: 0.2)),
              ),
              child: Row(
                children: [
                  Icon(Icons.lock_reset_rounded, color: AppColors.info),
                  SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      'Enter your registered mobile number. We will send a one-time password to verify your identity.',
                      style: TextStyle(color: AppColors.bodyText, height: 1.4),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            TextField(
              controller: _phoneController,
              enabled: !_otpSent,
              decoration: InputDecoration(
                labelText: 'Mobile number',
                prefixIcon: Icon(Icons.phone_outlined),
                filled: true,
                fillColor: AppColors.surface,
              ),
            ),
            if (_otpSent) ...[
              const SizedBox(height: 14),
              TextField(
                controller: _otpController,
                decoration: InputDecoration(
                  labelText: 'OTP code',
                  prefixIcon: Icon(Icons.pin_outlined),
                  hintText: '6-digit OTP',
                  filled: true,
                  fillColor: AppColors.surface,
                ),
              ),
            ],
            const SizedBox(height: 28),
            PrimaryButton(
              label: _otpSent ? 'Verify & sign in' : 'Send OTP',
              loading: loading,
              onPressed: loading ? null : _submit,
            ),
          ],
        ),
      ),
    );
  }
}
