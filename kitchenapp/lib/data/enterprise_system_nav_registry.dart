import 'enterprise_feature_catalog.dart';
import 'feature_module_catalog.dart';

class EnterpriseSystemNavRegistry {
  const EnterpriseSystemNavRegistry._();

  /// Maps enterprise catalog system numbers to command-center tab indices.
  /// Returns `null` for System 1 (auth lives on the login surface).
  static int? navIndexForSystem(int systemNumber) {
    if (systemNumber == 1) {
      return null;
    }
    if (systemNumber >= 2 && systemNumber <= 8) {
      return systemNumber - 2;
    }
    if (systemNumber == 9) {
      return 9;
    }
    if (systemNumber == 10) {
      return 7;
    }
    if (systemNumber >= 11 && systemNumber <= 49) {
      return systemNumber - 1;
    }
    return null;
  }

  static int? systemNumberForNavIndex(int navIndex) {
    if (navIndex == 8 || navIndex == 49) {
      return null;
    }

    for (final system in EnterpriseFeatureCatalog.systems) {
      if (navIndexForSystem(system.number) == navIndex) {
        return system.number;
      }
    }
    return null;
  }

  static String moduleLabelForNavIndex(int navIndex) {
    if (navIndex == 8) {
      return 'Staff Command Center';
    }
    if (navIndex == 49) {
      return 'Enterprise Features Catalog';
    }

    final systemNumber = systemNumberForNavIndex(navIndex);
    if (systemNumber == null) {
      return 'Kitchen Command Center';
    }

    return 'System $systemNumber · ${FeatureModuleCatalog.titleFor(systemNumber)}';
  }

  static bool isNavigable(int systemNumber) {
    return navIndexForSystem(systemNumber) != null;
  }

  static int get liveSystemCount => 49;

  static int get navigableModuleCount =>
      EnterpriseSystemNavRegistry.liveSystemCount - 1;
}
