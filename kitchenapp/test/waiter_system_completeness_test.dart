import 'package:flutter_test/flutter_test.dart';

import 'package:kitchenapp/core/api/auth_endpoints.dart';
import 'package:kitchenapp/core/api/mock_kitchen_api_client.dart';
import 'package:kitchenapp/core/api/waiter_auto_assignment_endpoints.dart';
import 'package:kitchenapp/data/enterprise_feature_catalog.dart';
import 'package:kitchenapp/data/waiter_system_catalog.dart';
import 'package:kitchenapp/models/waiter/waiter_assignment_snapshot.dart';

void main() {
  group('System 49 catalog parity', () {
    final system49 = EnterpriseFeatureCatalog.systems.last;

    test('enterprise catalog system 49 matches waiter catalog', () {
      expect(system49.number, 49);
      expect(system49.title, WaiterSystemCatalog.title);
      expect(
        system49.groups[0].items,
        WaiterSystemCatalog.autoAssignmentFeatures,
      );
      expect(
        system49.groups[1].items,
        WaiterSystemCatalog.notificationTypes,
      );
    });
  });

  group('waiter auto assignment API', () {
    late MockKitchenApiClient api;

    setUp(() async {
      api = MockKitchenApiClient();
      await api.post(
        AuthEndpoints.otpRequest,
        body: {'phone': '+919876543210', 'deviceId': 'waiter-test-device'},
      );
      await api.post(
        AuthEndpoints.otpVerify,
        body: {
          'phone': '+919876543210',
          'otp': '123456',
          'deviceId': 'waiter-test-device',
          'latitude': 19.076,
          'longitude': 72.8777,
        },
      );
    });

    test('board payload parses and includes ready notification', () async {
      final response = await api.get(WaiterAutoAssignmentEndpoints.board);
      final snapshot = WaiterAssignmentSnapshot.fromJson(
        response['data'] as Map<String, dynamic>,
      );

      expect(snapshot.notifications, isNotEmpty);
      expect(
        snapshot.notifications.first.title,
        contains('Order Ready'),
      );
      expect(snapshot.featureFlags.autoTaskAllocation, isTrue);
      expect(snapshot.featureFlags.noManualCalling, isTrue);
    });

    test('auto allocate and confirm delivery work', () async {
      await api.get(WaiterAutoAssignmentEndpoints.board);
      final allocate = await api.post(WaiterAutoAssignmentEndpoints.autoAllocate);
      expect(allocate['success'], isTrue);

      final board = await api.get(WaiterAutoAssignmentEndpoints.board);
      final tasks = (board['data'] as Map<String, dynamic>)['tasks']
          as List<dynamic>;
      final task = tasks.first as Map<String, dynamic>;
      final confirm = await api.post(
        WaiterAutoAssignmentEndpoints.taskAction(task['id'] as String),
        body: {'action': 'confirm_delivery'},
      );
      expect(confirm['success'], isTrue);
    });
  });
}
