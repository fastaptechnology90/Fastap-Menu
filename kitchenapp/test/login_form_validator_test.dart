import 'package:flutter_test/flutter_test.dart';
import 'package:kitchenapp/models/auth/login_method.dart';
import 'package:kitchenapp/services/device_login_service.dart';
import 'package:kitchenapp/widgets/auth/login_form_validator.dart';

void main() {
  test('OTP requires phone before send', () {
    expect(
      LoginFormValidator.validate(
        method: LoginMethod.otp,
        phone: '123',
        otp: '',
        staffCode: '',
        secret: '',
        qrToken: '',
        otpSent: false,
      ),
      isNotNull,
    );
  });

  test('PIN requires staff code and 4 digits', () {
    expect(
      LoginFormValidator.validate(
        method: LoginMethod.pin,
        phone: '',
        otp: '',
        staffCode: '',
        secret: '12',
        qrToken: '',
        otpSent: false,
      ),
      isNotNull,
    );
  });

  test('QR requires token', () {
    expect(
      LoginFormValidator.validate(
        method: LoginMethod.qr,
        phone: '',
        otp: '',
        staffCode: '',
        secret: '',
        qrToken: '',
        otpSent: false,
      ),
      isNotNull,
    );
  });

  test('parse QR staff token extracts KCH code', () {
    expect(
      parseQrStaffToken('{"staff":"KCH-003"}'),
      'KCH-003',
    );
  });
}
