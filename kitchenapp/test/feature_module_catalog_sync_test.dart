import 'package:flutter_test/flutter_test.dart';
import 'package:kitchenapp/data/enterprise_feature_catalog.dart';
import 'package:kitchenapp/data/feature_module_catalog.dart';

void main() {
  test('generated catalog matches enterprise feature catalog', () {
    expect(FeatureModuleCatalog.systemCount, 49);
    expect(FeatureModuleCatalog.modules.length, 49);
    expect(EnterpriseFeatureCatalog.systems.length, 49);

    for (final meta in FeatureModuleCatalog.modules) {
      final system = EnterpriseFeatureCatalog.systems.firstWhere(
        (entry) => entry.number == meta.number,
      );
      expect(system.title, meta.title, reason: 'System ${meta.number} title');
      expect(system.number, meta.number);
      expect(meta.key, 'system_${meta.number}');
    }
  });
}
