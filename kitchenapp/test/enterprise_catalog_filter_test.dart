import 'package:flutter_test/flutter_test.dart';

import 'package:kitchenapp/data/enterprise_catalog_filter.dart';
import 'package:kitchenapp/data/enterprise_feature_catalog.dart';

void main() {
  test('catalog filter returns all systems by default', () {
    final systems = EnterpriseCatalogFilterEngine.filter(
      query: '',
      category: EnterpriseCatalogFilter.all,
    );

    expect(systems.length, EnterpriseFeatureCatalog.systems.length);
  });

  test('catalog search matches system title and workflow items', () {
    final byTitle = EnterpriseCatalogFilterEngine.filter(
      query: 'KDS',
      category: EnterpriseCatalogFilter.all,
    );
    expect(byTitle.any((system) => system.number == 3), isTrue);

    final byWorkflow = EnterpriseCatalogFilterEngine.filter(
      query: 'soft delete',
      category: EnterpriseCatalogFilter.all,
    );
    expect(byWorkflow.any((system) => system.number == 47), isTrue);
  });

  test('category filters return expected subsets', () {
    final aiSystems = EnterpriseCatalogFilterEngine.filter(
      query: '',
      category: EnterpriseCatalogFilter.ai,
    );
    expect(aiSystems.any((system) => system.number == 48), isTrue);
    expect(aiSystems.any((system) => system.number == 2), isFalse);

    final recoverySystems = EnterpriseCatalogFilterEngine.filter(
      query: '',
      category: EnterpriseCatalogFilter.recovery,
    );
    expect(recoverySystems.any((system) => system.number == 47), isTrue);
  });
}
