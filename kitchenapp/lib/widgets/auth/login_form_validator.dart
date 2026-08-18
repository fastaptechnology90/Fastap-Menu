import '../../models/auth/login_method.dart';

class LoginFormValidator {
  const LoginFormValidator._();

  static String? validate({
    required LoginMethod method,
    required String phone,
    required String otp,
    required String staffCode,
    required String secret,
    required String qrToken,
    required bool otpSent,
  }) {
    return switch (method) {
      LoginMethod.otp => _validateOtp(phone: phone, otp: otp, otpSent: otpSent),
      LoginMethod.pin => _validatePin(staffCode: staffCode, pin: secret),
      LoginMethod.password =>
        _validatePassword(staffCode: staffCode, password: secret),
      LoginMethod.qr => _validateQr(qrToken),
      LoginMethod.nfc ||
      LoginMethod.face ||
      LoginMethod.fingerprint =>
        _validateStaffCode(staffCode),
    };
  }

  static String? _validateOtp({
    required String phone,
    required String otp,
    required bool otpSent,
  }) {
    if (phone.length < 8) {
      return 'Enter your registered mobile number.';
    }
    if (!otpSent) {
      return null;
    }
    if (otp.length < 4) {
      return 'Enter the OTP sent to your mobile.';
    }
    return null;
  }

  static String? _validatePin({
    required String staffCode,
    required String pin,
  }) {
    final staffError = _validateStaffCode(staffCode);
    if (staffError != null) {
      return staffError;
    }
    if (pin.length < 4) {
      return 'Enter your 4-digit PIN.';
    }
    return null;
  }

  static String? _validatePassword({
    required String staffCode,
    required String password,
  }) {
    final staffError = _validateStaffCode(staffCode);
    if (staffError != null) {
      return staffError;
    }
    if (password.length < 4) {
      return 'Enter your password.';
    }
    return null;
  }

  static String? _validateQr(String qrToken) {
    if (qrToken.trim().isEmpty) {
      return 'Scan your staff QR badge or enter the token.';
    }
    return null;
  }

  static String? _validateStaffCode(String staffCode) {
    if (staffCode.trim().isEmpty) {
      return 'Enter your staff code or tap your NFC badge.';
    }
    return null;
  }
}
