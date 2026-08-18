import 'package:kitchenapp/models/auth/staff_role.dart';

/// Role-based module and permission policy for the waiter app.
class WaiterAccessPolicy {
  const WaiterAccessPolicy._();

  static const systemNumbers = <int>[2, 12, 26, 27, 35, 36, 49];

  static const actionPermissions = <String>{
    'kds.view',
    'waiter.tasks.view',
    'waiter.delivery.confirm',
    'order.deliver',
    'roomservice.deliver',
    'catalog.view',
  };

  static const quickActionSystems = <int>[48, 35, 36, 27, 12, 49];

  static String systemViewPermission(int systemNumber) =>
      'system.$systemNumber.view';

  static bool canAccessSystem({
    required StaffRole role,
    required List<String> permissions,
    required int systemNumber,
  }) {
    if (role != StaffRole.waiter) return false;
    final key = systemViewPermission(systemNumber);
    if (permissions.contains(key)) return true;
    if (permissions.isNotEmpty) return false;
    return systemNumbers.contains(systemNumber);
  }

  static List<int> allowedSystemNumbers({
    required StaffRole role,
    required List<String> permissions,
  }) {
    return [
      for (final n in systemNumbers)
        if (canAccessSystem(
          role: role,
          permissions: permissions,
          systemNumber: n,
        ))
          n,
    ];
  }
}
