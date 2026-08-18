import 'package:flutter_test/flutter_test.dart';

import 'package:kitchenapp/core/api/auth_endpoints.dart';
import 'package:kitchenapp/core/api/dashboard_endpoints.dart';
import 'package:kitchenapp/core/api/mock_kitchen_api_client.dart';
import 'package:kitchenapp/data/enterprise_feature_catalog.dart';
import 'package:kitchenapp/data/kitchen_dashboard_catalog.dart';
import 'package:kitchenapp/data/mock/mock_dashboard_calculator.dart';
import 'package:kitchenapp/data/mock/mock_kitchen_orders.dart';
import 'package:kitchenapp/models/dashboard/dashboard_snapshot.dart';

void main() {
  group('System 2 catalog parity', () {
    final system2 = EnterpriseFeatureCatalog.systems[1];

    test('enterprise catalog system 2 matches kitchen dashboard catalog', () {
      expect(system2.title, KitchenDashboardCatalog.title);
      expect(system2.groups[0].items, KitchenDashboardCatalog.dashboardWidgets);
      expect(system2.groups[1].items, KitchenDashboardCatalog.realtimeMetrics);
    });

    test('mock dashboard builder exposes every widget label', () {
      final payload = MockDashboardCalculator.buildDashboard(
        section: 'All',
        orders: MockKitchenOrders.orders,
      );
      final labels = (payload['widgets'] as List)
          .map((item) => (item as Map)['label'] as String)
          .toList();

      expect(labels.length, KitchenDashboardCatalog.dashboardWidgetCount);
      expect(labels, KitchenDashboardCatalog.dashboardWidgets);
    });

    test('mock dashboard builder exposes every metric label', () {
      final payload = MockDashboardCalculator.buildDashboard(
        section: 'All',
        orders: MockKitchenOrders.orders,
      );
      final labels = (payload['metrics'] as List)
          .map((item) => (item as Map)['label'] as String)
          .toList();

      expect(labels.length, KitchenDashboardCatalog.realtimeMetricCount);
      expect(labels, KitchenDashboardCatalog.realtimeMetrics);
    });
  });

  group('dashboard API', () {
    late MockKitchenApiClient api;

    setUp(() async {
      api = MockKitchenApiClient();
      await api.post(
        AuthEndpoints.otpRequest,
        body: {'phone': '+919876543210', 'deviceId': 'dash-test-device'},
      );
      await api.post(
        AuthEndpoints.otpVerify,
        body: {
          'phone': '+919876543210',
          'otp': '123456',
          'deviceId': 'dash-test-device',
          'latitude': 19.076,
          'longitude': 72.8777,
        },
      );
    });

    test('full dashboard payload parses into snapshot', () async {
      final response = await api.get(
        DashboardEndpoints.dashboard,
        query: {'section': 'All'},
      );

      final snapshot = DashboardSnapshot.fromJson(
        response['data'] as Map<String, dynamic>,
      );

      expect(snapshot.widgets.length, KitchenDashboardCatalog.dashboardWidgetCount);
      expect(snapshot.metrics.length, KitchenDashboardCatalog.realtimeMetricCount);
      expect(snapshot.sectionWorkload, isNotEmpty);
      expect(snapshot.orders, isNotEmpty);
    });

    test('widgets endpoint returns all dashboard widgets', () async {
      final response = await api.get(
        DashboardEndpoints.widgets,
        query: {'section': 'All'},
      );
      final widgets = response['widgets'] as List;

      expect(widgets.length, KitchenDashboardCatalog.dashboardWidgetCount);
    });

    test('metrics endpoint returns all real-time metrics', () async {
      final response = await api.get(
        DashboardEndpoints.metrics,
        query: {'section': 'All'},
      );
      final metrics = response['metrics'] as List;

      expect(metrics.length, KitchenDashboardCatalog.realtimeMetricCount);
    });

    test('orders endpoint returns live kitchen orders', () async {
      final response = await api.get(
        DashboardEndpoints.orders,
        query: {'section': 'All'},
      );
      final orders = response['orders'] as List;

      expect(orders, isNotEmpty);
    });
  });
}
