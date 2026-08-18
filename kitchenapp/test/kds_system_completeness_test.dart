import 'package:flutter_test/flutter_test.dart';

import 'package:kitchenapp/core/api/auth_endpoints.dart';
import 'package:kitchenapp/core/api/kds_endpoints.dart';
import 'package:kitchenapp/core/api/mock_kitchen_api_client.dart';
import 'package:kitchenapp/data/enterprise_feature_catalog.dart';
import 'package:kitchenapp/data/kds_system_catalog.dart';
import 'package:kitchenapp/data/mock/mock_kds_engine.dart';
import 'package:kitchenapp/models/kds/kds_snapshot.dart';
import 'package:kitchenapp/models/kds/kds_view_mode.dart';

void main() {
  group('System 3 catalog parity', () {
    final system3 = EnterpriseFeatureCatalog.systems[2];

    test('enterprise catalog system 3 matches KDS catalog', () {
      expect(system3.title, KdsSystemCatalog.title);
      expect(system3.groups[0].items, KdsSystemCatalog.kdsFeatures);
      expect(system3.groups[1].items, KdsSystemCatalog.smartDisplayFeatures);
      expect(system3.groups[2].items, KdsSystemCatalog.kotInformation);
      expect(system3.groups[3].items, KdsSystemCatalog.statusTypes);
    });

    test('view modes cover queue timeline section chef category priority vip', () {
      expect(KdsViewMode.values.length, 7);
      expect(
        KdsViewMode.values.map((mode) => mode.label).toList(),
        ['Queue', 'Timeline', 'Section', 'Chef', 'Category', 'Priority', 'VIP'],
      );
    });

    test('status enum covers all catalog status types', () {
      expect(KdsStatus.values.length, KdsSystemCatalog.statusTypeCount);
      expect(
        KdsStatus.values.map((status) => status.label).toList(),
        KdsSystemCatalog.statusTypes,
      );
    });
  });

  group('KDS mock engine', () {
    test('builds grouped section layout', () {
      final payload = MockKdsEngine.buildPayload(
        section: 'All',
        view: 'section',
        filter: 'all',
      );

      final snapshot = KdsSnapshot.fromJson(payload);
      expect(snapshot.isGrouped, isTrue);
      expect(snapshot.groups, isNotEmpty);
    });

    test('priority and vip filters reduce active orders', () {
      final all = MockKdsEngine.buildPayload(
        section: 'All',
        view: 'queue',
        filter: 'all',
      );
      final vip = MockKdsEngine.buildPayload(
        section: 'All',
        view: 'vip',
        filter: 'vip',
      );
      final priority = MockKdsEngine.buildPayload(
        section: 'All',
        view: 'priority',
        filter: 'priority',
      );

      expect((vip['orders'] as List).length,
          lessThan((all['orders'] as List).length));
      expect((priority['orders'] as List).length,
          lessThan((all['orders'] as List).length));
    });

    test('live timer tick advances preparing orders', () {
      final snapshot = KdsSnapshot.fromJson(
        MockKdsEngine.buildPayload(
          section: 'All',
          view: 'queue',
          filter: 'all',
        ),
      );
      final preparing = snapshot.orders
          .firstWhere((order) => order.status == KdsStatus.preparing);
      final ticked = snapshot.withLiveTimerTick();
      final updated = ticked.orders.firstWhere((order) => order.id == preparing.id);

      expect(updated.timerSeconds, preparing.timerSeconds + 1);
      expect(updated.progress, greaterThan(preparing.progress));
    });
  });

  group('KDS API', () {
    late MockKitchenApiClient api;

    setUp(() async {
      api = MockKitchenApiClient();
      await api.post(
        AuthEndpoints.otpRequest,
        body: {'phone': '+919876543210', 'deviceId': 'kds-test-device'},
      );
      await api.post(
        AuthEndpoints.otpVerify,
        body: {
          'phone': '+919876543210',
          'otp': '123456',
          'deviceId': 'kds-test-device',
          'latitude': 19.076,
          'longitude': 72.8777,
        },
      );
    });

    test('kds payload parses with full KOT fields', () async {
      final response = await api.get(
        KdsEndpoints.kds,
        query: {'section': 'All', 'view': 'queue', 'filter': 'all'},
      );

      final snapshot = KdsSnapshot.fromJson(
        response['data'] as Map<String, dynamic>,
      );

      expect(snapshot.orders, isNotEmpty);
      final vipOrder = snapshot.orders.firstWhere((order) => order.vip);
      expect(vipOrder.orderId, isNotEmpty);
      expect(vipOrder.tableNumber ?? vipOrder.roomNumber, isNotNull);
      expect(vipOrder.guestType, isNotEmpty);
      expect(vipOrder.items, isNotEmpty);
      expect(vipOrder.addOns, isNotEmpty);
      expect(vipOrder.modifiers, isNotEmpty);
      expect(vipOrder.cookingNotes, isNotEmpty);
      expect(vipOrder.deliveryType, isNotEmpty);
      expect(vipOrder.allergy, isTrue);
    });

    test('kds action and reorder endpoints work', () async {
      final initial = await api.get(
        KdsEndpoints.kds,
        query: {'section': 'All', 'view': 'queue', 'filter': 'all'},
      );
      final orders = (initial['data']['orders'] as List).cast<Map<String, dynamic>>();
      final firstId = orders.first['id'] as String;

      await api.post(
        KdsEndpoints.orderAction(firstId),
        body: {'action': 'accept'},
      );

      await api.post(
        KdsEndpoints.reorder,
        body: {
          'orderIds': orders.map((order) => order['id']).toList(),
        },
      );

      final updated = await api.get(
        KdsEndpoints.kds,
        query: {'section': 'All', 'view': 'queue', 'filter': 'all'},
      );
      final updatedOrders =
          (updated['data']['orders'] as List).cast<Map<String, dynamic>>();
      expect(updatedOrders.first['status'], isNot('new'));
    });
  });
}
