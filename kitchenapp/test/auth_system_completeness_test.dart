import 'package:flutter_test/flutter_test.dart';

import 'package:kitchenapp/core/api/auth_endpoints.dart';
import 'package:kitchenapp/core/api/mock_kitchen_api_client.dart';
import 'package:kitchenapp/data/auth_system_catalog.dart';
import 'package:kitchenapp/data/enterprise_feature_catalog.dart';
import 'package:kitchenapp/data/mock/mock_staff_directory.dart';
import 'package:kitchenapp/models/auth/login_method.dart';
import 'package:kitchenapp/models/auth/staff_role.dart';

void main() {
  group('System 1 catalog parity', () {
    final system1 = EnterpriseFeatureCatalog.systems.first;

    test('enterprise catalog system 1 matches auth catalog', () {
      expect(system1.title, AuthSystemCatalog.title);
      expect(system1.groups[0].items, AuthSystemCatalog.loginMethods);
      expect(system1.groups[1].items, AuthSystemCatalog.staffRoles);
      expect(system1.groups[2].items, AuthSystemCatalog.securityFeatures);
    });

    test('login method enum covers all catalog entries', () {
      expect(LoginMethod.values.length, AuthSystemCatalog.loginMethodCount);
      expect(
        LoginMethod.values.map((method) => method.label).toList(),
        AuthSystemCatalog.loginMethods,
      );
    });

    test('staff role enum covers all catalog entries', () {
      expect(StaffRole.values.length, AuthSystemCatalog.staffRoleCount);
      expect(
        StaffRole.values.map((role) => role.label).toList(),
        AuthSystemCatalog.staffRoles,
      );
    });
  });

  group('mock staff directory', () {
    test('demo staff includes every staff role', () {
      final roles = MockStaffDirectory.all
          .map((staff) => staff['role'] as String)
          .toSet();

      for (final role in StaffRole.values) {
        expect(roles.contains(role.name), isTrue, reason: role.label);
      }
      expect(MockStaffDirectory.all.length, AuthSystemCatalog.staffRoleCount);
    });
  });

  group('auth API login methods', () {
    late MockKitchenApiClient api;

    setUp(() {
      api = MockKitchenApiClient();
    });

    const deviceId = 'test-device-001';
    const geo = {'latitude': 19.076, 'longitude': 72.8777};

    Future<Map<String, dynamic>> loginOtp() => api.post(
          AuthEndpoints.otpVerify,
          body: {
            'phone': '+919876543210',
            'otp': '123456',
            'deviceId': deviceId,
            ...geo,
          },
        );

    test('mobile OTP login succeeds', () async {
      await api.post(
        AuthEndpoints.otpRequest,
        body: {'phone': '+919876543210', 'deviceId': deviceId},
      );
      final response = await loginOtp();
      final session = response['data'] as Map<String, dynamic>;
      expect(session['loginMethod'], 'otp');
      expect(session['shiftId'], isNotEmpty);
      expect(session['geoVerified'], isTrue);
    });

    test('PIN login succeeds', () async {
      final response = await api.post(
        AuthEndpoints.pinLogin,
        body: {
          'staffCode': 'KCH-001',
          'pin': '4521',
          'deviceId': deviceId,
          ...geo,
        },
      );
      expect((response['data'] as Map)['loginMethod'], 'pin');
    });

    test('password login succeeds', () async {
      final response = await api.post(
        AuthEndpoints.passwordLogin,
        body: {
          'staffCode': 'KCH-001',
          'password': 'chef@123',
          'deviceId': deviceId,
          ...geo,
        },
      );
      expect((response['data'] as Map)['loginMethod'], 'password');
    });

    test('QR staff login succeeds', () async {
      final response = await api.post(
        AuthEndpoints.qrVerify,
        body: {'qrToken': 'KCH-001', 'deviceId': deviceId, ...geo},
      );
      expect((response['data'] as Map)['loginMethod'], 'qr');
    });

    test('NFC login succeeds', () async {
      final response = await api.post(
        AuthEndpoints.biometricLogin,
        body: {
          'staffCode': 'KCH-001',
          'biometricType': 'nfc',
          'deviceId': deviceId,
          ...geo,
        },
      );
      expect((response['data'] as Map)['loginMethod'], 'nfc');
    });

    test('face recognition login succeeds', () async {
      final response = await api.post(
        AuthEndpoints.biometricLogin,
        body: {
          'staffCode': 'KCH-001',
          'biometricType': 'face',
          'deviceId': deviceId,
          'deviceVerified': true,
          'hardwareToken': 'local-auth-verified',
          ...geo,
        },
      );
      expect((response['data'] as Map)['loginMethod'], 'face');
    });

    test('fingerprint login succeeds', () async {
      final response = await api.post(
        AuthEndpoints.biometricLogin,
        body: {
          'staffCode': 'KCH-001',
          'biometricType': 'fingerprint',
          'deviceId': deviceId,
          'deviceVerified': true,
          'hardwareToken': 'local-auth-verified',
          ...geo,
        },
      );
      expect((response['data'] as Map)['loginMethod'], 'fingerprint');
    });

    test('face login requires device verification', () async {
      await expectLater(
        api.post(
          AuthEndpoints.biometricLogin,
          body: {
            'staffCode': 'KCH-001',
            'biometricType': 'face',
            'deviceId': deviceId,
            ...geo,
          },
        ),
        throwsA(isA<Exception>()),
      );
    });

    test('multi-device restriction blocks second device', () async {
      await api.post(
        AuthEndpoints.otpRequest,
        body: {'phone': '+919876543210', 'deviceId': deviceId},
      );
      await loginOtp();

      expect(
        () => api.post(
          AuthEndpoints.pinLogin,
          body: {
            'staffCode': 'KCH-001',
            'pin': '4521',
            'deviceId': 'other-device',
            ...geo,
          },
        ),
        throwsA(
          predicate(
            (error) =>
                error.toString().contains('another device') ||
                error.toString().contains('DEVICE_CONFLICT'),
          ),
        ),
      );
    });

    test('shift current endpoint returns active shift', () async {
      await api.post(
        AuthEndpoints.otpRequest,
        body: {'phone': '+919876543210', 'deviceId': deviceId},
      );
      await loginOtp();

      final shift = await api.get(AuthEndpoints.shiftCurrent);
      expect(shift['shift'], isA<Map<String, dynamic>>());
      expect((shift['shift'] as Map)['id'], isNotEmpty);
    });

    test('access registration submits successfully', () async {
      final response = await api.post(
        AuthEndpoints.register,
        body: {
          'name': 'New Prep Cook',
          'email': 'prep@kitchen.example',
          'phone': '+919999999999',
          'staffCode': 'KCH-099',
          'role': 'lineCook',
        },
      );
      expect(response['success'], isTrue);
      expect(response['message'], isNotEmpty);
      expect(response['role'], 'lineCook');
    });

    test('password login rejects mismatched role', () async {
      await expectLater(
        api.post(
          AuthEndpoints.passwordLogin,
          body: {
            'staffCode': 'KCH-001',
            'password': 'chef@123',
            'deviceId': deviceId,
            'role': 'lineCook',
            ...geo,
          },
        ),
        throwsA(
          isA<Exception>().having(
            (error) => error.toString(),
            'message',
            contains('role'),
          ),
        ),
      );
    });

    test('emergency logout clears sessions', () async {
      await api.post(
        AuthEndpoints.otpRequest,
        body: {'phone': '+919876543210', 'deviceId': deviceId},
      );
      await loginOtp();
      await api.post(AuthEndpoints.emergencyLogout);
      expect(
        () => api.get(AuthEndpoints.session),
        throwsA(isA<Exception>()),
      );
    });
  });

  test('login method display labels resolve session keys', () {
    expect(LoginMethod.displayLabel('otp'), 'Mobile OTP login');
    expect(LoginMethod.displayLabel('face'), 'Face recognition login');
    expect(LoginMethod.displayLabel('fingerprint'), 'Fingerprint login');
  });
}
