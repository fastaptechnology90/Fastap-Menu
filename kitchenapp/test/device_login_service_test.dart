import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kitchenapp/models/auth/login_method.dart';
import 'package:kitchenapp/services/device_login_service.dart';
import 'package:local_auth/error_codes.dart' as auth_error;
import 'package:local_auth/local_auth.dart';

void main() {
  group('DeviceLoginService platform errors', () {
    test('maps not enrolled face error', () {
      expect(
        DeviceLoginService.platformErrorMessage(
          PlatformException(code: auth_error.notEnrolled),
          LoginMethod.face,
        ),
        contains('face'),
      );
    });

    test('maps not enrolled fingerprint error', () {
      expect(
        DeviceLoginService.platformErrorMessage(
          PlatformException(code: auth_error.notEnrolled),
          LoginMethod.fingerprint,
        ),
        contains('fingerprint'),
      );
    });

    test('maps iOS simulator error', () {
      expect(
        DeviceLoginService.platformErrorMessage(
          PlatformException(code: auth_error.otherOperatingSystem),
          LoginMethod.face,
        ),
        contains('Simulator'),
      );
    });
  });

  group('DeviceLoginService capability helpers', () {
    test('face support includes weak biometrics', () {
      expect(
        DeviceLoginService.supportsFace([BiometricType.weak]),
        isTrue,
      );
    });

    test('fingerprint support includes strong biometrics', () {
      expect(
        DeviceLoginService.supportsFingerprint([BiometricType.strong]),
        isTrue,
      );
    });
  });
}
