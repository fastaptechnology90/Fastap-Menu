import 'package:flutter_test/flutter_test.dart';

import 'package:kitchenapp/core/api/auth_endpoints.dart';
import 'package:kitchenapp/core/api/mock_kitchen_api_client.dart';
import 'package:kitchenapp/data/auth_system_catalog.dart';
import 'package:kitchenapp/data/enterprise_system_api_registry.dart';
import 'package:kitchenapp/data/enterprise_system_nav_registry.dart';
import 'package:kitchenapp/data/enterprise_systems_catalog.dart';
import 'package:kitchenapp/data/feature_module_status_resolver.dart';
import 'package:kitchenapp/data/kds_system_catalog.dart';
import 'package:kitchenapp/data/kitchen_dashboard_catalog.dart';
import 'package:kitchenapp/data/order_processing_system_catalog.dart';
import 'package:kitchenapp/data/section_system_catalog.dart';
void main() {
  group('All 49 enterprise systems', () {
    test('catalog contains 49 systems with non-empty feature groups', () {
      expect(EnterpriseSystemsCatalog.systemCount, 49);
      expect(EnterpriseFeatureCatalog.systems.length, 49);

      for (final system in EnterpriseSystemsCatalog.systems) {
        expect(system.title, isNotEmpty, reason: 'System ${system.number}');
        expect(system.groups, isNotEmpty, reason: 'System ${system.number}');
        for (final group in system.groups) {
          expect(group.items, isNotEmpty, reason: group.title);
        }
        expect(
          EnterpriseSystemsCatalog.featureCount(system.number),
          greaterThan(0),
        );
      }
    });

    test('systems 1-5 match dedicated catalogs', () {
      expect(EnterpriseSystemsCatalog.system(1).title, AuthSystemCatalog.title);
      expect(EnterpriseSystemsCatalog.system(2).title, KitchenDashboardCatalog.title);
      expect(EnterpriseSystemsCatalog.system(3).title, KdsSystemCatalog.title);
      expect(EnterpriseSystemsCatalog.system(4).title, SectionSystemCatalog.title);
      expect(
        EnterpriseSystemsCatalog.system(5).title,
        OrderProcessingSystemCatalog.title,
      );
    });

    test('every system except auth maps to a nav tab', () {
      for (final system in EnterpriseSystemsCatalog.systems) {
        final nav = EnterpriseSystemNavRegistry.navIndexForSystem(
          system.number,
        );
        if (system.number == 1) {
          expect(nav, isNull);
        } else {
          expect(nav, isNotNull, reason: 'System ${system.number}');
          expect(nav, inInclusiveRange(0, 48));
        }
      }
    });

    test('all systems are marked live in-app', () {
      for (var n = 1; n <= 49; n++) {
        expect(
          FeatureModuleStatusResolver.statusFor(n).label,
          'Live · In-app',
          reason: 'System $n',
        );
      }
    });

    test('systems 2-49 have primary API paths', () {
      for (var n = 2; n <= 49; n++) {
        expect(
          EnterpriseSystemApiRegistry.pathForSystem(n),
          isNotNull,
          reason: 'System $n',
        );
      }
    });
  });

  group('Enterprise API smoke tests', () {
    late MockKitchenApiClient api;

    setUp(() async {
      api = MockKitchenApiClient();
      await api.post(
        AuthEndpoints.otpRequest,
        body: {'phone': '+919876543210', 'deviceId': 'enterprise-all-device'},
      );
      await api.post(
        AuthEndpoints.otpVerify,
        body: {
          'phone': '+919876543210',
          'otp': '123456',
          'deviceId': 'enterprise-all-device',
          'latitude': 19.076,
          'longitude': 72.8777,
        },
      );
    });

    for (var system = 2; system <= 49; system++) {
      test('system $system primary API returns success', () async {
        final path = EnterpriseSystemApiRegistry.pathForSystem(system)!;
        final query = <String, String>{
          if (path.contains('sections')) 'includeRouting': 'true',
          if (!path.startsWith('/auth')) 'section': 'All',
        };
        final response = await api.get(
          path,
          query: query.isEmpty ? null : query,
        );
        expect(response['success'], isTrue, reason: path);
        expect(response['data'], isNotNull, reason: path);
      });
    }
  });
}
