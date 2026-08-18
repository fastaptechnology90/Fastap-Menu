import 'package:flutter_test/flutter_test.dart';

import 'package:kitchenapp/models/auth/auth_session.dart';

void main() {
  test('auth session parses API payload', () {
    final session = AuthSession.fromJson({
      'token': 'demo-token-001',
      'user': {
        'id': 'STF-001',
        'name': 'Chef Arjun Mehta',
        'role': 'headChef',
        'section': 'Main',
        'phone': '+919876543210',
        'staffCode': 'KCH-001',
      },
      'expiresAt': DateTime.now()
          .add(const Duration(hours: 8))
          .toIso8601String(),
      'deviceId': 'device-001',
      'shiftId': 'SHIFT-1012',
      'permissions': ['kds.view', 'order.accept', 'emergency.logout'],
      'loginMethod': 'password',
      'geoVerified': true,
    });

    expect(session.user.name, 'Chef Arjun Mehta');
    expect(session.user.staffCode, 'KCH-001');
    expect(session.hasPermission('emergency.logout'), isTrue);
    expect(session.geoVerified, isTrue);
    expect(session.isExpired, isFalse);
  });

  test('auth session serializes back to json', () {
    final session = AuthSession.fromJson({
      'token': 'demo-token-002',
      'user': {
        'id': 'STF-011',
        'name': 'Omar Expeditor',
        'role': 'expeditor',
        'section': 'Main',
        'phone': '+919700000011',
        'staffCode': 'KCH-011',
      },
      'expiresAt': DateTime.now()
          .add(const Duration(hours: 4))
          .toIso8601String(),
      'deviceId': 'device-002',
      'shiftId': 'SHIFT-1013',
      'permissions': ['kds.view', 'dispatch.approve'],
      'loginMethod': 'pin',
    });

    final json = session.toJson();
    final restored = AuthSession.fromJson(json);

    expect(restored.user.staffCode, 'KCH-011');
    expect(restored.loginMethod, 'pin');
  });
}
