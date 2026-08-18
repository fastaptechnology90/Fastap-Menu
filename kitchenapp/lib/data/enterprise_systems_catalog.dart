import 'enterprise_feature_catalog.dart';
import '../models/enterprise_feature_system.dart';

export 'enterprise_feature_catalog.dart';
export 'feature_module_catalog.dart';

/// Unified access to all 49 enterprise kitchen systems.
class EnterpriseSystemsCatalog {
  const EnterpriseSystemsCatalog._();

  static const systemCount = 49;

  static List<EnterpriseFeatureSystem> get systems =>
      EnterpriseFeatureCatalog.systems;

  static EnterpriseFeatureSystem system(int number) {
    return EnterpriseFeatureCatalog.systems.firstWhere(
      (entry) => entry.number == number,
    );
  }

  static List<String> featureGroups(int number) {
    return system(number).groups.map((group) => group.title).toList();
  }

  static List<String> allFeatures(int number) {
    return system(number)
        .groups
        .expand((group) => group.items)
        .toList();
  }

  static int featureCount(int number) => allFeatures(number).length;

  static int get totalFeatureItems => systems
      .map((entry) => featureCount(entry.number))
      .fold(0, (sum, count) => sum + count);
}
