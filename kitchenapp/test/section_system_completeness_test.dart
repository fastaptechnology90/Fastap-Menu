import 'package:flutter_test/flutter_test.dart';

import 'package:kitchenapp/core/api/auth_endpoints.dart';
import 'package:kitchenapp/core/api/mock_kitchen_api_client.dart';
import 'package:kitchenapp/core/api/section_endpoints.dart';
import 'package:kitchenapp/data/enterprise_feature_catalog.dart';
import 'package:kitchenapp/data/mock/mock_section_engine.dart';
import 'package:kitchenapp/data/mock/mock_section_registry.dart';
import 'package:kitchenapp/data/section_system_catalog.dart';
import 'package:kitchenapp/models/sections/section_overview_snapshot.dart';

void main() {
  group('System 4 catalog parity', () {
    final system4 = EnterpriseFeatureCatalog.systems[3];

    test('enterprise catalog system 4 matches section catalog', () {
      expect(system4.title, SectionSystemCatalog.title);
      expect(system4.groups[0].items, SectionSystemCatalog.kitchenSections);
      expect(system4.groups[1].items, SectionSystemCatalog.smartRoutingFeatures);
    });

    test('mock section registry exposes all kitchen sections', () {
      final labels = MockSectionRegistry.kitchenSections
          .map((section) => section.label)
          .toList();
      expect(labels.length, SectionSystemCatalog.kitchenSectionCount);
      expect(labels, SectionSystemCatalog.kitchenSections);
    });

    test('mock section engine enables all smart routing flags', () {
      final routing = MockSectionEngine.buildRoutingBoard();
      final flags = routing['smartRouting'] as Map<String, dynamic>;
      expect(flags['autoSectionAssignment'], isTrue);
      expect(flags['multiSectionSplitting'], isTrue);
      expect(flags['parallelPreparation'], isTrue);
      expect(flags['aiLoadBalancing'], isTrue);
      expect(flags['smartChefAllocation'], isTrue);
      expect(flags['queueOptimization'], isTrue);
    });
  });

  group('section management API', () {
    late MockKitchenApiClient api;

    setUp(() async {
      api = MockKitchenApiClient();
      await api.post(
        AuthEndpoints.otpRequest,
        body: {'phone': '+919876543210', 'deviceId': 'section-test-device'},
      );
      await api.post(
        AuthEndpoints.otpVerify,
        body: {
          'phone': '+919876543210',
          'otp': '123456',
          'deviceId': 'section-test-device',
          'latitude': 19.076,
          'longitude': 72.8777,
        },
      );
    });

    test('overview payload includes all sections and routing board', () async {
      final response = await api.get(
        SectionEndpoints.overview,
        query: {'section': 'All', 'includeRouting': 'true'},
      );

      final snapshot = SectionManagementSnapshot.fromJson(
        response['data'] as Map<String, dynamic>,
      );

      expect(
        snapshot.overview.sections.length,
        SectionSystemCatalog.kitchenSectionCount,
      );
      expect(snapshot.routing.smartRouting.aiLoadBalancing, isTrue);
      expect(snapshot.routing.splitOrders, isNotEmpty);
    });

    test('optimize and assign-chef endpoints work', () async {
      final optimize = await api.post(SectionEndpoints.optimize);
      expect(optimize['success'], isTrue);

      await api.post(
        SectionEndpoints.assignChef('main'),
        body: {'chefName': 'Relief · Chef Arjun Mehta'},
      );
    });
  });
}
