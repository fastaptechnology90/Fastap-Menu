import 'enterprise_system_nav_registry.dart';
import '../models/auth/staff_role.dart';

/// Role-based visibility for shell tabs, modules, and quick actions.
enum MainShellTab {
  home('Home'),
  kitchen('Kitchen'),
  operations('Operations'),
  alerts('Alerts'),
  profile('Profile');

  const MainShellTab(this.label);

  final String label;
}

class StaffRoleAccessPolicy {
  const StaffRoleAccessPolicy._();

  static const catalogViewPermission = 'catalog.view';
  static const staffCommandPermission = 'staff.command.view';

  static String systemViewPermission(int systemNumber) =>
      'system.$systemNumber.view';

  static bool canAccessSystem({
    required StaffRole role,
    required List<String> permissions,
    required int systemNumber,
  }) {
    if (systemNumber == 1) {
      return false;
    }
    final key = systemViewPermission(systemNumber);
    if (permissions.contains(key)) {
      return true;
    }
    if (permissions.isNotEmpty) {
      return false;
    }
    return _defaultSystemsFor(role).contains(systemNumber);
  }

  static bool canAccessNavIndex({
    required StaffRole role,
    required List<String> permissions,
    required int navIndex,
  }) {
    if (navIndex == 49) {
      return _hasCatalogAccess(role, permissions);
    }
    if (navIndex == 8) {
      return _hasStaffCommandAccess(role, permissions);
    }

    final systemNumber =
        EnterpriseSystemNavRegistry.systemNumberForNavIndex(navIndex);
    if (systemNumber == null) {
      return false;
    }
    return canAccessSystem(
      role: role,
      permissions: permissions,
      systemNumber: systemNumber,
    );
  }

  static List<int> allowedSystemNumbers({
    required StaffRole role,
    required List<String> permissions,
  }) {
    return [
      for (var n = 2; n <= 49; n++)
        if (canAccessSystem(role: role, permissions: permissions, systemNumber: n))
          n,
    ];
  }

  static List<MainShellTab> visibleShellTabs({
    required StaffRole role,
    required List<String> permissions,
  }) {
    final tabs = <MainShellTab>[MainShellTab.home];

    if (_kitchenNavIndices.any(
      (navIndex) => canAccessNavIndex(
        role: role,
        permissions: permissions,
        navIndex: navIndex,
      ),
    )) {
      tabs.add(MainShellTab.kitchen);
    }

    if (allowedSystemNumbers(role: role, permissions: permissions).isNotEmpty) {
      tabs.add(MainShellTab.operations);
    }

    if (_alertsNavIndices.any(
      (navIndex) => canAccessNavIndex(
        role: role,
        permissions: permissions,
        navIndex: navIndex,
      ),
    )) {
      tabs.add(MainShellTab.alerts);
    }

    tabs.add(MainShellTab.profile);
    return tabs;
  }

  static List<int> quickActionNavIndices({
    required StaffRole role,
    required List<String> permissions,
  }) {
    // These are NAV indices, not system numbers — the two differ by one above system 10
    // (see EnterpriseSystemNavRegistry.navIndexForSystem). Entries written as system
    // numbers resolved to modules the role has no access to and were silently filtered
    // out, leaving the waiter with 3 of 6 buttons and housekeeping with 2 of 4.
    //   waiter       : 48 = Waiter tasks (sys 49), 35 = Alerts (sys 36),
    //                  0 = Dashboard (sys 2), 49 = Modules catalog
    //   housekeeping : 27 = Room service (sys 28), 28 = Cleaning (sys 29),
    //                  35 = Alerts (sys 36), 0 = Dashboard (sys 2)
    final candidates = switch (role) {
      StaffRole.waiter => [48, 35, 0, 49],
      StaffRole.housekeeping => [27, 28, 35, 0, 49],
      StaffRole.packingStaff => [1, 21, 22, 35, 49],
      StaffRole.expeditor => [1, 20, 21, 12, 35],
      StaffRole.headChef || StaffRole.kitchenManager => [
          0, 1, 13, 35, 33, 8, 49,
        ],
      StaffRole.sousChef => [0, 1, 7, 13, 35, 49],
      StaffRole.kitchenHelper => [1, 5, 28, 35, 49],
      StaffRole.beverageChef => [1, 23, 5, 35, 49],
      StaffRole.dessertChef || StaffRole.bakeryChef => [1, 24, 5, 35, 49],
      StaffRole.tandoorChef || StaffRole.chineseChef => [1, 2, 5, 7, 35, 49],
      _ => [1, 5, 7, 35, 33, 49],
    };

    return candidates
        .where(
          (navIndex) => canAccessNavIndex(
            role: role,
            permissions: permissions,
            navIndex: navIndex,
          ),
        )
        .toList();
  }

  static List<int> kitchenSubTabNavIndices({
    required StaffRole role,
    required List<String> permissions,
  }) {
    return _kitchenNavIndices
        .where(
          (navIndex) => canAccessNavIndex(
            role: role,
            permissions: permissions,
            navIndex: navIndex,
          ),
        )
        .toList();
  }

  static List<int> defaultSystemNumbers(StaffRole role) =>
      _defaultSystemsFor(role).toList()..sort();

  static List<String> defaultPermissionsFor(StaffRole role) {
    final permissions = <String>{
      for (final system in _defaultSystemsFor(role))
        systemViewPermission(system),
      ..._actionPermissionsFor(role),
    };
    return permissions.toList()..sort();
  }

  static Set<int> _defaultSystemsFor(StaffRole role) {
    return switch (role) {
      StaffRole.headChef || StaffRole.kitchenManager => _allSystems,
      StaffRole.sousChef => <int>{
          for (var n = 2; n <= 45; n++) n,
          48,
          49,
        },
      StaffRole.expeditor => <int>{
          2, 3, 4, 11, 12, 17, 19, 20, 21, 22, 35, 36,
        },
      StaffRole.waiter => <int>{2, 12, 26, 27, 35, 36, 49},
      StaffRole.housekeeping => <int>{2, 12, 28, 29, 35, 36},
      StaffRole.packingStaff => <int>{3, 4, 20, 21, 22, 35},
      StaffRole.lineCook => <int>{
          2, 3, 4, 5, 6, 7, 9, 15, 16, 17, 33, 34, 35,
        },
      StaffRole.tandoorChef || StaffRole.chineseChef => <int>{
          2, 3, 4, 5, 6, 7, 9, 15, 16, 35, 33, 34,
        },
      StaffRole.beverageChef => <int>{2, 3, 5, 7, 9, 15, 23, 33, 34, 35},
      StaffRole.dessertChef || StaffRole.bakeryChef => <int>{
          2, 3, 5, 7, 9, 15, 24, 33, 34, 35,
        },
      StaffRole.kitchenHelper => <int>{3, 5, 28, 33, 34, 35},
    };
  }

  static Set<String> _actionPermissionsFor(StaffRole role) {
    const kitchenOps = <String>{
      'kds.view',
      'order.accept',
      'order.prepare',
      'order.ready',
    };

    return switch (role) {
      StaffRole.headChef || StaffRole.kitchenManager => <String>{
          ...kitchenOps,
          'order.reject',
          'order.reassign',
          'staff.manage',
          'staff.command.view',
          'inventory.view',
          'reports.view',
          'emergency.logout',
          catalogViewPermission,
        },
      StaffRole.sousChef => <String>{
          ...kitchenOps,
          'order.reject',
          'order.reassign',
          'staff.command.view',
          'dispatch.approve',
          catalogViewPermission,
        },
      StaffRole.expeditor => <String>{
          ...kitchenOps,
          'order.reject',
          'order.reassign',
          'dispatch.approve',
        },
      StaffRole.packingStaff => <String>{
          'kds.view',
          'packing.manage',
          'dispatch.approve',
        },
      StaffRole.waiter => <String>{
          'kds.view',
          'waiter.tasks.view',
          'waiter.delivery.confirm',
          'order.deliver',
          'roomservice.deliver',
        },
      StaffRole.housekeeping => <String>{
          'hygiene.view',
          'housekeeping.tasks.view',
          'housekeeping.tasks.update',
          'maintenance.report',
        },
      _ => kitchenOps,
    };
  }

  static bool _hasCatalogAccess(StaffRole role, List<String> permissions) {
    if (permissions.contains(catalogViewPermission)) {
      return true;
    }
    if (permissions.isNotEmpty) {
      return false;
    }
    return role == StaffRole.headChef ||
        role == StaffRole.kitchenManager ||
        role == StaffRole.sousChef;
  }

  static bool _hasStaffCommandAccess(StaffRole role, List<String> permissions) {
    if (permissions.contains(staffCommandPermission) ||
        permissions.contains('staff.manage')) {
      return true;
    }
    if (permissions.isNotEmpty) {
      return false;
    }
    return role == StaffRole.headChef ||
        role == StaffRole.kitchenManager ||
        role == StaffRole.sousChef;
  }

  static final Set<int> _allSystems = {
    for (var n = 2; n <= 49; n++) n,
  };
  static const _kitchenNavIndices = [1, 2, 3, 4, 5];
  static const _alertsNavIndices = [12, 17, 35, 36];
}
