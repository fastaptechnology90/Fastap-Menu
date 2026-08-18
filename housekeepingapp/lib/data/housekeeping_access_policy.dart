import 'package:kitchenapp/models/auth/staff_role.dart';

class HousekeepingAccessPolicy {
  const HousekeepingAccessPolicy._();

  static const systemNumbers = <int>[2, 12, 28, 29, 35, 36];

  static const actionPermissions = <String>{
    'hygiene.view',
    'housekeeping.tasks.view',
    'housekeeping.tasks.update',
    'maintenance.report',
    'roomservice.deliver',
  };

  static const quickActionSystems = <int>[28, 29, 35, 36];

  static String systemViewPermission(int systemNumber) =>
      'system.$systemNumber.view';

  static bool canAccessSystem({
    required StaffRole role,
    required List<String> permissions,
    required int systemNumber,
  }) {
    if (role != StaffRole.housekeeping) return false;
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
