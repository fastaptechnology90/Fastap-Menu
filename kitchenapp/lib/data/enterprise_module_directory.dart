import 'enterprise_system_nav_registry.dart';

class EnterpriseModuleDirectory {
  const EnterpriseModuleDirectory._();

  static const int tabCount = 50;

  static List<EnterpriseModuleDestination> destinations() {
    return List.generate(tabCount, (navIndex) {
      return EnterpriseModuleDestination(
        navIndex: navIndex,
        label: EnterpriseSystemNavRegistry.moduleLabelForNavIndex(navIndex),
        systemNumber: EnterpriseSystemNavRegistry.systemNumberForNavIndex(
          navIndex,
        ),
      );
    });
  }

  static List<EnterpriseModuleDestination> search(String query) {
    final normalized = query.trim().toLowerCase();
    final items = destinations();

    if (normalized.isEmpty) {
      return items;
    }

    return items.where((item) {
      if (item.label.toLowerCase().contains(normalized)) {
        return true;
      }
      if (item.systemNumber?.toString().contains(normalized) ?? false) {
        return true;
      }
      return item.navIndex.toString().contains(normalized);
    }).toList();
  }
}

class EnterpriseModuleDestination {
  const EnterpriseModuleDestination({
    required this.navIndex,
    required this.label,
    required this.systemNumber,
  });

  final int navIndex;
  final String label;
  final int? systemNumber;
}
