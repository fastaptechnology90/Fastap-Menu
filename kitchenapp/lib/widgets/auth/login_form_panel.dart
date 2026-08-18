import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/config/api_config.dart';
import '../../core/config/app_variant_config.dart';
import '../../data/staff_role_registry.dart';
import '../../core/constants/app_colors.dart';
import '../../models/auth/login_method.dart';
import '../../models/auth/staff_role.dart';
import '../../services/device_login_service.dart';
import '../../state/auth_controller.dart';
import 'auth_text_field.dart';
import 'login_form_validator.dart';
import 'login_method_selector.dart';
import 'qr_scanner_sheet.dart';
import 'staff_role_dropdown.dart';

class LoginFormPanel extends StatefulWidget {
  const LoginFormPanel({super.key, required this.auth});

  final AuthController auth;

  @override
  State<LoginFormPanel> createState() => _LoginFormPanelState();
}

class _LoginFormPanelState extends State<LoginFormPanel> {
  LoginMethod _method = LoginMethod.password;
  final _phoneController = TextEditingController();
  final _otpController = TextEditingController();
  final _staffCodeController = TextEditingController();
  final _secretController = TextEditingController();
  final _qrController = TextEditingController();
  final DeviceLoginService _deviceLogin = DeviceLoginService();

  bool _otpSent = false;
  int _otpResendSeconds = 0;
  Timer? _otpTimer;
  bool _hardwareBusy = false;
  bool _biometricVerified = false;
  StaffRole _selectedRole = StaffRoleRegistry.defaultRoleForCurrentApp;

  @override
  void initState() {
    super.initState();
    _selectedRole = StaffRoleRegistry.defaultRoleForCurrentApp;
    if (ApiConfig.useMockApi) {
      switch (AppVariantConfig.variant) {
        case StaffAppVariant.waiter:
          _staffCodeController.text = 'KCH-013';
          _secretController.text = 'wait@123';
        case StaffAppVariant.housekeeping:
          _staffCodeController.text = 'KCH-014';
          _secretController.text = 'clean@123';
        case StaffAppVariant.kitchen:
          _staffCodeController.text = 'KCH-001';
          _secretController.text = 'chef@123';
      }
    }
  }

  /// Staff codes (KCH-001) are upper-cased; email addresses must stay lower-case.
  String _normalizeStaffCode(String value) {
    final v = value.trim();
    return v.contains('@') ? v.toLowerCase() : v.toUpperCase();
  }

  Widget _staffCodeField({String hint = 'Staff code, email or phone'}) {
    return AuthTextField(
      label: 'Staff code',
      controller: _staffCodeController,
      hint: hint,
      prefixIcon: Icons.badge_outlined,
      keyboardType: TextInputType.emailAddress,
      textCapitalization: TextCapitalization.none,
      inputFormatters: [
        // The API accepts staff code, email or phone (staff-auth.ts:27) — the old
        // filter stripped "@" and "." which made email login impossible (BUG.md #11).
        FilteringTextInputFormatter.allow(RegExp(r'[a-zA-Z0-9@._+\-]')),
      ],
    );
  }

  @override
  void dispose() {
    _otpTimer?.cancel();
    _phoneController.dispose();
    _otpController.dispose();
    _staffCodeController.dispose();
    _secretController.dispose();
    _qrController.dispose();
    super.dispose();
  }

  bool get _loading =>
      widget.auth.status == AuthStatus.loading || _hardwareBusy;

  void _showMessage(String message, {bool isError = true}) {
    if (!mounted) {
      return;
    }
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError ? AppColors.danger : AppColors.primary,
      ),
    );
  }

  void _startOtpCooldown() {
    _otpTimer?.cancel();
    setState(() => _otpResendSeconds = ApiConfig.otpResendSeconds);
    _otpTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }
      if (_otpResendSeconds <= 1) {
        timer.cancel();
        setState(() => _otpResendSeconds = 0);
        return;
      }
      setState(() => _otpResendSeconds -= 1);
    });
  }

  Future<void> _sendOtp() async {
    final phone = _phoneController.text.trim();
    final validation = LoginFormValidator.validate(
      method: LoginMethod.otp,
      phone: phone,
      otp: '',
      staffCode: '',
      secret: '',
      qrToken: '',
      otpSent: false,
    );
    if (validation != null) {
      _showMessage(validation);
      return;
    }

    final success = await widget.auth.requestOtp(phone, role: _selectedRole);
    if (!mounted) {
      return;
    }
    if (success) {
      setState(() => _otpSent = true);
      _startOtpCooldown();
      _showMessage('OTP sent to your registered mobile.', isError: false);
      return;
    }
    if (widget.auth.errorMessage != null) {
      _showMessage(widget.auth.errorMessage!);
    }
  }

  Future<void> _scanQr() async {
    final token = await QrScannerSheet.show(context);
    if (!mounted || token == null || token.isEmpty) {
      return;
    }
    setState(() => _qrController.text = token);
    _showMessage('QR token captured.', isError: false);
  }

  Future<bool> _prepareNfcStaffCode() async {
    if (_staffCodeController.text.trim().isNotEmpty) {
      return true;
    }

    setState(() => _hardwareBusy = true);
    final result = await _deviceLogin.readNfcStaffCode();
    if (!mounted) {
      return false;
    }
    setState(() => _hardwareBusy = false);

    if (!result.success) {
      _showMessage(result.message ?? 'NFC read failed.');
      return false;
    }

    if (result.hardwareToken != null && result.hardwareToken!.isNotEmpty) {
      _staffCodeController.text = result.hardwareToken!;
    }
    return _staffCodeController.text.trim().isNotEmpty;
  }

  Future<bool> _verifyDeviceBiometric(LoginMethod method) async {
    setState(() {
      _hardwareBusy = true;
      _biometricVerified = false;
    });
    final result = await _deviceLogin.verifyBiometric(method);
    if (!mounted) {
      return false;
    }
    setState(() => _hardwareBusy = false);

    if (!result.success) {
      _showMessage(result.message ?? 'Biometric verification failed.');
      return false;
    }

    if (result.skippedHardware) {
      setState(() => _biometricVerified = true);
      _showMessage(
        'Device biometrics unavailable on this platform — continuing with server verification.',
        isError: false,
      );
      return true;
    }

    setState(() => _biometricVerified = true);
    _showMessage('Biometric verified. Tap sign in to continue.', isError: false);
    return true;
  }

  Future<void> _submit() async {
    final auth = widget.auth;
    final role = _selectedRole;

    final validation = LoginFormValidator.validate(
      method: _method,
      phone: _phoneController.text.trim(),
      otp: _otpController.text.trim(),
      staffCode: _normalizeStaffCode(_staffCodeController.text),
      secret: _secretController.text.trim(),
      qrToken: _qrController.text.trim(),
      otpSent: _otpSent,
    );

    if (_method == LoginMethod.otp && !_otpSent) {
      await _sendOtp();
      return;
    }

    if (validation != null) {
      _showMessage(validation);
      return;
    }

    var success = false;

    switch (_method) {
      case LoginMethod.otp:
        success = await auth.verifyOtp(
          _phoneController.text.trim(),
          _otpController.text.trim(),
          role: role,
        );
      case LoginMethod.pin:
        success = await auth.loginWithPin(
          _normalizeStaffCode(_staffCodeController.text),
          _secretController.text.trim(),
          role: role,
        );
      case LoginMethod.password:
        success = await auth.loginWithPassword(
          _normalizeStaffCode(_staffCodeController.text),
          _secretController.text.trim(),
          role: role,
        );
      case LoginMethod.qr:
        success = await auth.loginWithQr(
          _qrController.text.trim(),
          role: role,
        );
      case LoginMethod.nfc:
        if (!await _prepareNfcStaffCode()) {
          return;
        }
        success = await auth.loginWithBiometric(
          staffCode: _normalizeStaffCode(_staffCodeController.text),
          method: _method,
          role: role,
          deviceVerified: true,
          hardwareToken: _normalizeStaffCode(_staffCodeController.text),
        );
      case LoginMethod.face:
      case LoginMethod.fingerprint:
        if (!await _verifyDeviceBiometric(_method)) {
          return;
        }
        success = await auth.loginWithBiometric(
          staffCode: _normalizeStaffCode(_staffCodeController.text),
          method: _method,
          role: role,
          deviceVerified: true,
          hardwareToken: 'local-auth-verified',
        );
    }

    if (!success && mounted && auth.errorMessage != null) {
      _showMessage(auth.errorMessage!);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color: ApiConfig.useMockApi
                ? AppColors.primary.withValues(alpha: 0.08)
                : AppColors.warning.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: ApiConfig.useMockApi
                  ? AppColors.primary.withValues(alpha: 0.25)
                  : AppColors.warning.withValues(alpha: 0.35),
            ),
          ),
          child: Row(
            children: [
              Icon(
                ApiConfig.useMockApi ? Icons.science_outlined : Icons.cloud_outlined,
                size: 18,
                color: ApiConfig.useMockApi ? AppColors.primary : AppColors.warning,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  ApiConfig.useMockApi
                      ? 'Demo mode · Mock API active — use Password login below'
                      : 'Live API · ${ApiConfig.activeBaseUrl}',
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: AppColors.bodyText,
                    height: 1.35,
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        Row(
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(_method.icon, color: AppColors.primary),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    _method.label,
                    style: const TextStyle(
                      color: AppColors.primaryText,
                      fontSize: 18,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  Text(
                    _methodHint(_method),
                    style: const TextStyle(
                      color: AppColors.secondaryText,
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 18),
        LoginMethodSelector(
          selected: _method,
          onSelected: (method) => setState(() {
            _method = method;
            _otpSent = false;
            _biometricVerified = false;
            _otpTimer?.cancel();
            _otpResendSeconds = 0;
          }),
        ),
        const SizedBox(height: 24),
        StaffRoleDropdown(
          value: _selectedRole,
          enabled: !_loading,
          onChanged: (role) {
            if (role != null) {
              setState(() => _selectedRole = role);
            }
          },
        ),
        const SizedBox(height: 16),
        ..._fieldsForMethod(),
        if (widget.auth.errorMessage != null) ...[
          const SizedBox(height: 12),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.danger.withAlpha(20),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.danger.withAlpha(80)),
            ),
            child: Text(
              widget.auth.errorMessage!,
              style: const TextStyle(
                color: AppColors.danger,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
        const SizedBox(height: 20),
        SizedBox(
          width: double.infinity,
          child: FilledButton.icon(
            onPressed: _loading ? null : _submit,
            icon: _loading
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                : Icon(_submitIcon()),
            label: Text(_submitLabel()),
          ),
        ),
        if (_method == LoginMethod.otp && _otpSent) ...[
          const SizedBox(height: 10),
          Align(
            alignment: Alignment.centerRight,
            child: TextButton(
              onPressed: _otpResendSeconds > 0 || _loading ? null : _sendOtp,
              child: Text(
                _otpResendSeconds > 0
                    ? 'Resend OTP in ${_otpResendSeconds}s'
                    : 'Resend OTP',
              ),
            ),
          ),
        ],
        if (ApiConfig.useMockApi) ...[
          const SizedBox(height: 16),
          const _DemoCredentialsCard(),
        ],
      ],
    );
  }

  List<Widget> _fieldsForMethod() {
    return switch (_method) {
      LoginMethod.otp => [
          AuthTextField(
            label: 'Registered mobile',
            controller: _phoneController,
            hint: '+1XXXXXXXXXX',
            prefixIcon: Icons.phone_android_outlined,
            keyboardType: TextInputType.phone,
          ),
          if (_otpSent) ...[
            const SizedBox(height: 16),
            AuthTextField(
              label: 'OTP code',
              controller: _otpController,
              hint: '6-digit OTP',
              prefixIcon: Icons.sms_outlined,
              keyboardType: TextInputType.number,
              maxLength: 6,
            ),
          ],
        ],
      LoginMethod.pin => [
          _staffCodeField(),
          const SizedBox(height: 16),
          AuthTextField(
            label: 'PIN',
            controller: _secretController,
            hint: '4-digit PIN',
            prefixIcon: Icons.pin_outlined,
            obscureText: true,
            keyboardType: TextInputType.number,
            maxLength: 4,
          ),
        ],
      LoginMethod.password => [
          _staffCodeField(),
          const SizedBox(height: 16),
          AuthTextField(
            label: 'Password',
            controller: _secretController,
            hint: 'Enter password',
            prefixIcon: Icons.lock_outline,
            obscureText: true,
            keyboardType: TextInputType.visiblePassword,
          ),
        ],
      LoginMethod.qr => [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: AppColors.chipBackground,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.panelBorder),
            ),
            child: Column(
              children: [
                const Icon(
                  Icons.qr_code_scanner_rounded,
                  size: 64,
                  color: AppColors.primary,
                ),
                const SizedBox(height: 10),
                const Text(
                  'Scan staff badge QR or enter token below',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: AppColors.secondaryText,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  onPressed: _loading ? null : _scanQr,
                  icon: const Icon(Icons.qr_code_scanner),
                  label: const Text('Open QR scanner'),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          AuthTextField(
            label: 'QR staff token',
            controller: _qrController,
            hint: 'QR token',
            prefixIcon: Icons.qr_code_2_outlined,
          ),
        ],
      LoginMethod.nfc => [
          _staffCodeField(hint: 'Optional if using NFC badge'),
          const SizedBox(height: 16),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(22),
            decoration: BoxDecoration(
              color: AppColors.chipBackground,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.panelBorder),
            ),
            child: Column(
              children: [
                const Icon(Icons.nfc, size: 56, color: AppColors.primary),
                const SizedBox(height: 10),
                const Text(
                  'Hold your NFC staff badge near the device reader',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: AppColors.secondaryText,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  onPressed: _loading ? null : _prepareNfcStaffCode,
                  icon: const Icon(Icons.nfc),
                  label: const Text('Read NFC badge'),
                ),
              ],
            ),
          ),
        ],
      LoginMethod.face || LoginMethod.fingerprint => [
          _staffCodeField(),
          const SizedBox(height: 16),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(22),
            decoration: BoxDecoration(
              color: AppColors.chipBackground,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.panelBorder),
            ),
            child: Column(
              children: [
                Icon(_method.icon, size: 56, color: AppColors.primary),
                const SizedBox(height: 10),
                Text(
                  _method == LoginMethod.face
                      ? 'Device face recognition verifies you first, then the server confirms your shift.'
                      : 'Place your registered finger on the sensor to verify, then sign in.',
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: AppColors.secondaryText,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                if (_biometricVerified) ...[
                  const SizedBox(height: 12),
                  const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.check_circle, color: AppColors.primary, size: 18),
                      SizedBox(width: 6),
                      Text(
                        'Biometric verified',
                        style: TextStyle(
                          color: AppColors.primary,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ],
                  ),
                ],
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  onPressed: _loading ? null : () => _verifyDeviceBiometric(_method),
                  icon: Icon(_method == LoginMethod.face ? Icons.face : Icons.fingerprint),
                  label: Text(
                    _method == LoginMethod.face
                        ? 'Verify face now'
                        : 'Verify fingerprint now',
                  ),
                ),
              ],
            ),
          ),
        ],
    };
  }

  String _methodHint(LoginMethod method) {
    return switch (method) {
      LoginMethod.otp => 'One-time password to registered mobile',
      LoginMethod.pin => '4-digit staff PIN',
      LoginMethod.password => 'Staff code and password',
      LoginMethod.qr => 'QR badge token verification',
      LoginMethod.nfc => 'NFC badge tap authentication',
      LoginMethod.face => 'Face recognition match',
      LoginMethod.fingerprint => 'Fingerprint biometric match',
    };
  }

  IconData _submitIcon() {
    return switch (_method) {
      LoginMethod.otp when !_otpSent => Icons.send_outlined,
      LoginMethod.qr => Icons.qr_code_scanner,
      LoginMethod.nfc => Icons.nfc,
      LoginMethod.face => Icons.face,
      LoginMethod.fingerprint => Icons.fingerprint,
      _ => Icons.login,
    };
  }

  String _submitLabel() {
    if (_method == LoginMethod.otp && !_otpSent) {
      return 'Send OTP';
    }
    if (_method == LoginMethod.nfc) {
      return 'Sign in with NFC';
    }
    if (_method == LoginMethod.face) {
      return 'Verify Face & Sign In';
    }
    if (_method == LoginMethod.fingerprint) {
      return 'Verify Fingerprint & Sign In';
    }
    return 'Secure Sign In';
  }
}

class _DemoCredentialsCard extends StatelessWidget {
  const _DemoCredentialsCard();

  static String _mockApiHintText() {
    return switch (AppVariantConfig.variant) {
      StaffAppVariant.waiter =>
        'Password login: KCH-013 / wait@123 · role Waiter\n'
            'PIN login: staff code KCH-013 · PIN 1313\n'
            'OTP login: phone +919900000013 · OTP 123456\n'
            'Face / Fingerprint / QR / NFC: use staff code KCH-013',
      StaffAppVariant.housekeeping =>
        'Password login: KCH-014 / clean@123 · role Housekeeping\n'
            'PIN login: staff code KCH-014 · PIN 1414\n'
            'OTP login: phone +919900000014 · OTP 123456\n'
            'Face / Fingerprint / QR / NFC: use staff code KCH-014',
      StaffAppVariant.kitchen =>
        'Password login (recommended): KCH-001 / chef@123 · role Head chef\n'
            'PIN login: same staff code + PIN 4521\n'
            'OTP login: phone +919876543210 · OTP 123456\n'
            'Waiter and housekeeping staff use their dedicated apps\n'
            'Face / Fingerprint: enter staff code, verify biometrics, match role\n'
            'QR/NFC token: KCH-001. Fields are pre-filled for head chef.',
    };
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.info.withAlpha(18),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.info.withAlpha(60)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Local mock API',
            style: TextStyle(
              color: AppColors.info,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            _mockApiHintText(),
            style: const TextStyle(color: AppColors.bodyText, height: 1.5),
          ),
        ],
      ),
    );
  }
}
