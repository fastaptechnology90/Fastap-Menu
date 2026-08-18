import 'package:kitchenapp/state/controllers/auth_controller.dart';

import '../../core/constants/housekeeping_constants.dart';
import '../../data/housekeeping_access_policy.dart';
import '../../data/housekeeping_role_registry.dart';

class HousekeepingAuthController extends AuthController {
  HousekeepingAuthController({super.authService});

  String get defaultStaffCode => '';

  String get defaultMobileRole => HousekeepingConstants.defaultMobileRole;

  List<int> get allowedSystems => HousekeepingAccessPolicy.allowedSystemNumbers(
        role: session?.user.role ?? HousekeepingRoleRegistry.defaultRole,
        permissions: session?.permissions ?? const [],
      );

  bool canAccessHousekeepingSystem(int systemNumber) {
    final current = session;
    if (current == null) return false;
    return HousekeepingAccessPolicy.canAccessSystem(
      role: current.user.role,
      permissions: current.permissions,
      systemNumber: systemNumber,
    );
  }
}
