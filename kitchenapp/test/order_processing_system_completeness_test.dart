import 'package:flutter_test/flutter_test.dart';

import 'package:kitchenapp/core/api/auth_endpoints.dart';
import 'package:kitchenapp/core/api/mock_kitchen_api_client.dart';
import 'package:kitchenapp/core/api/order_processing_endpoints.dart';
import 'package:kitchenapp/data/enterprise_feature_catalog.dart';
import 'package:kitchenapp/data/mock/mock_order_processing_engine.dart';
import 'package:kitchenapp/data/mock/mock_order_store.dart';
import 'package:kitchenapp/data/order_processing_system_catalog.dart';
import 'package:kitchenapp/models/processing/processing_snapshot.dart';

void main() {
  group('System 5 catalog parity', () {
    final system5 = EnterpriseFeatureCatalog.systems[4];

    test('enterprise catalog system 5 matches processing catalog', () {
      expect(system5.title, OrderProcessingSystemCatalog.title);
      expect(system5.groups[0].items, OrderProcessingSystemCatalog.orderActions);
      expect(
        system5.groups[1].items,
        OrderProcessingSystemCatalog.smartProcessingFeatures,
      );
    });

    test('order action keys align with catalog labels', () {
      expect(
        OrderProcessingSystemCatalog.orderActionKeys.length,
        OrderProcessingSystemCatalog.orderActionCount,
      );
    });

    test('seed orders expose every catalog order action', () {
      final supported = <String>{};
      for (final order in MockOrderStore.orders) {
        supported.addAll(MockOrderStore.availableActions(order));
      }

      for (final action in OrderProcessingSystemCatalog.orderActionKeys) {
        expect(supported, contains(action), reason: action);
      }
    });
  });

  group('order processing API', () {
    late MockKitchenApiClient api;

    setUp(() async {
      api = MockKitchenApiClient();
      await api.post(
        AuthEndpoints.otpRequest,
        body: {'phone': '+919876543210', 'deviceId': 'processing-test-device'},
      );
      await api.post(
        AuthEndpoints.otpVerify,
        body: {
          'phone': '+919876543210',
          'otp': '123456',
          'deviceId': 'processing-test-device',
          'latitude': 19.076,
          'longitude': 72.8777,
        },
      );
    });

    test('processing payload exposes smart features and queue', () async {
      final response = await api.get(
        OrderProcessingEndpoints.processing,
        query: {'section': 'All'},
      );

      final snapshot = ProcessingSnapshot.fromJson(
        response['data'] as Map<String, dynamic>,
      );

      expect(snapshot.orders, isNotEmpty);
      expect(snapshot.smartProcessing.autoQueueSorting, isTrue);
      expect(snapshot.smartProcessing.vipPrioritization, isTrue);
      expect(snapshot.smartProcessing.batchCookingManagement, isTrue);
      expect(snapshot.smartProcessing.smartCookingSequence, isTrue);
    });

    test('process and optimize endpoints work', () async {
      final initial = await api.get(
        OrderProcessingEndpoints.processing,
        query: {'section': 'All'},
      );
      final orders =
          (initial['data']['orders'] as List).cast<Map<String, dynamic>>();
      final orderId = orders.first['id'] as String;

      await api.post(
        OrderProcessingEndpoints.process(orderId),
        body: {'action': 'accept'},
      );

      final optimized = await api.post(OrderProcessingEndpoints.optimize);
      expect(optimized['success'], isTrue);

      final engine = MockOrderProcessingEngine.buildSnapshot(section: 'All');
      final flags = engine['smartProcessing'] as Map<String, dynamic>;
      expect(flags['aiPriorityHandling'], isTrue);
      expect(flags['rushHourOptimization'], isA<bool>());
    });
  });
}
