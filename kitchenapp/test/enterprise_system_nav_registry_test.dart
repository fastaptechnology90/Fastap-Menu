import 'package:flutter_test/flutter_test.dart';

import 'package:kitchenapp/data/enterprise_system_nav_registry.dart';
import 'package:kitchenapp/data/feature_module_status_resolver.dart';
import 'package:kitchenapp/data/enterprise_feature_catalog.dart';

void main() {
  test('every catalog system maps to a nav tab or auth surface', () {
    expect(EnterpriseFeatureCatalog.systems.length, 49);

    for (final system in EnterpriseFeatureCatalog.systems) {
      final navIndex = EnterpriseSystemNavRegistry.navIndexForSystem(
        system.number,
      );

      if (system.number == 1) {
        expect(navIndex, isNull);
        continue;
      }

      expect(
        navIndex,
        isNotNull,
        reason: 'System ${system.number} should map to a tab',
      );
      expect(navIndex, inInclusiveRange(0, 48));
    }
  });

  test('all catalog systems are marked live in-app', () {
    for (final system in EnterpriseFeatureCatalog.systems) {
      final status = FeatureModuleStatusResolver.statusFor(system.number);
      expect(
        status.label,
        'Live · In-app',
        reason: 'System ${system.number} should be live',
      );
    }
  });

  test('key systems map to expected tabs', () {
    expect(EnterpriseSystemNavRegistry.navIndexForSystem(2), 0);
    expect(EnterpriseSystemNavRegistry.navIndexForSystem(3), 1);
    expect(EnterpriseSystemNavRegistry.navIndexForSystem(9), 9);
    expect(EnterpriseSystemNavRegistry.navIndexForSystem(10), 7);
    expect(EnterpriseSystemNavRegistry.navIndexForSystem(48), 47);
    expect(EnterpriseSystemNavRegistry.navIndexForSystem(49), 48);
  });

  test('nav indices resolve back to module labels', () {
    expect(EnterpriseSystemNavRegistry.systemNumberForNavIndex(0), 2);
    expect(EnterpriseSystemNavRegistry.systemNumberForNavIndex(47), 48);
    expect(EnterpriseSystemNavRegistry.systemNumberForNavIndex(48), 49);
    expect(EnterpriseSystemNavRegistry.systemNumberForNavIndex(8), isNull);
    expect(
      EnterpriseSystemNavRegistry.moduleLabelForNavIndex(47),
      contains('Future AI Expansion Features'),
    );
    expect(
      EnterpriseSystemNavRegistry.moduleLabelForNavIndex(48),
      contains('Waiter Auto Assignment'),
    );
    expect(
      EnterpriseSystemNavRegistry.moduleLabelForNavIndex(49),
      'Enterprise Features Catalog',
    );
  });

  test('nav mapping is reversible for catalog systems', () {
    for (final system in EnterpriseFeatureCatalog.systems) {
      final navIndex = EnterpriseSystemNavRegistry.navIndexForSystem(
        system.number,
      );
      if (navIndex == null) {
        continue;
      }

      expect(
        EnterpriseSystemNavRegistry.systemNumberForNavIndex(navIndex),
        system.number,
      );
    }
  });
}
