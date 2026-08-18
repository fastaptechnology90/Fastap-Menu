import '../models/enterprise_feature_system.dart';
import 'enterprise_feature_catalog.dart';
import 'feature_module_status_resolver.dart';

enum EnterpriseCatalogFilter {
  all('All'),
  ai('AI'),
  critical('Critical'),
  integration('Integration'),
  recovery('Recovery');

  const EnterpriseCatalogFilter(this.label);

  final String label;
}

class EnterpriseCatalogFilterEngine {
  const EnterpriseCatalogFilterEngine._();

  static List<EnterpriseFeatureSystem> filter({
    required String query,
    required EnterpriseCatalogFilter category,
  }) {
    final normalizedQuery = query.trim().toLowerCase();

    return EnterpriseFeatureCatalog.systems.where((system) {
      if (!_matchesCategory(system.number, category)) {
        return false;
      }
      if (normalizedQuery.isEmpty) {
        return true;
      }
      return _matchesQuery(system, normalizedQuery);
    }).toList();
  }

  static bool _matchesCategory(
    int systemNumber,
    EnterpriseCatalogFilter category,
  ) {
    return switch (category) {
      EnterpriseCatalogFilter.all => true,
      EnterpriseCatalogFilter.ai =>
        {11, 12, 32, 35, 39, 40, 48}.contains(systemNumber),
      EnterpriseCatalogFilter.critical =>
        {1, 3, 5, 9, 14, 18, 19, 37, 38, 44, 45}.contains(systemNumber),
      EnterpriseCatalogFilter.integration =>
        {23, 31, 41, 42, 43}.contains(systemNumber),
      EnterpriseCatalogFilter.recovery =>
        {37, 38, 44, 45, 47}.contains(systemNumber),
    };
  }

  static bool _matchesQuery(
    EnterpriseFeatureSystem system,
    String normalizedQuery,
  ) {
    if (system.number.toString().contains(normalizedQuery)) {
      return true;
    }
    if (system.title.toLowerCase().contains(normalizedQuery)) {
      return true;
    }

    for (final group in system.groups) {
      if (group.title.toLowerCase().contains(normalizedQuery)) {
        return true;
      }
      for (final item in group.items) {
        if (item.toLowerCase().contains(normalizedQuery)) {
          return true;
        }
      }
    }

    final status = FeatureModuleStatusResolver.statusFor(system.number);
    if (status.label.toLowerCase().contains(normalizedQuery)) {
      return true;
    }

    return false;
  }

  static int countForCategory(EnterpriseCatalogFilter category) {
    return filter(query: '', category: category).length;
  }
}
