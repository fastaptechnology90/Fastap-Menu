import 'package:flutter_test/flutter_test.dart';
import 'package:kitchenapp/models/features/feature_entitlements.dart';

void main() {
  group('FeatureEntitlementsSnapshot', () {
    test('isSystemEnabled treats auth as always on', () {
      const snapshot = FeatureEntitlementsSnapshot(
        restaurantId: 1,
        plan: 'pro',
        enabledSystems: [3, 5],
        modules: [],
        workflowLinks: [],
      );

      expect(snapshot.isSystemEnabled(1), isTrue);
      expect(snapshot.isSystemEnabled(3), isTrue);
      expect(snapshot.isSystemEnabled(2), isFalse);
    });

    test('fromJson parses modules and workflow links', () {
      final snapshot = FeatureEntitlementsSnapshot.fromJson({
        'restaurantId': 42,
        'plan': 'enterprise',
        'enabledSystems': [3, 5, 10],
        'modules': [
          {
            'number': 3,
            'key': 'system_3',
            'title': 'Live KDS',
            'category': 'Core',
            'linkedSystems': [5],
            'apiPath': '/kds',
          },
        ],
        'workflowLinks': [
          {'from': 3, 'to': 5, 'label': 'Order Processing'},
        ],
      });

      expect(snapshot.restaurantId, 42);
      expect(snapshot.plan, 'enterprise');
      expect(snapshot.modules, hasLength(1));
      expect(snapshot.modules.first.title, 'Live KDS');
      expect(snapshot.workflowLinks, hasLength(1));
      expect(snapshot.workflowLinks.first.label, 'Order Processing');
    });
  });
}
