class AuthEndpoints {
  const AuthEndpoints._();

  static const register = '/auth/register';
  static const otpRequest = '/auth/otp/request';
  static const otpVerify = '/auth/otp/verify';
  static const pinLogin = '/auth/pin';
  static const passwordLogin = '/auth/password';
  static const qrVerify = '/auth/qr/verify';
  static const biometricLogin = '/auth/biometric';
  static const logout = '/auth/logout';
  static const emergencyLogout = '/auth/emergency-logout';
  static const session = '/auth/session';
  static const permissions = '/auth/permissions';
  static const deviceBind = '/auth/device/bind';
  static const shiftCurrent = '/auth/shift/current';
  static const activity = '/auth/activity';
  static const profile = '/auth/profile';
  static const changeEmail = '/auth/profile/email';
  static const changePassword = '/auth/profile/password';
  static const deleteAccount = '/auth/profile/delete';
}
