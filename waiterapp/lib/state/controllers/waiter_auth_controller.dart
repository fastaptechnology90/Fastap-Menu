import 'package:kitchenapp/state/controllers/auth_controller.dart';

import '../../core/constants/waiter_constants.dart';
import '../../data/waiter_role_registry.dart';
import '../../data/waiter_access_policy.dart';

/// Auth state for the waiter app — extends shared kitchen auth with waiter helpers.
class WaiterAuthController extends AuthController {
  WaiterAuthController({super.authService});

  String get defaultStaffCode => '';

  String get defaultMobileRole => WaiterConstants.defaultMobileRole;

  List<int> get allowedSystems => WaiterAccessPolicy.allowedSystemNumbers(
        role: session?.user.role ?? WaiterRoleRegistry.defaultRole,
        permissions: session?.permissions ?? const [],
      );

  bool canAccessWaiterSystem(int systemNumber) {
    final current = session;
    if (current == null) return false;
    return WaiterAccessPolicy.canAccessSystem(
      role: current.user.role,
      permissions: current.permissions,
      systemNumber: systemNumber,
    );
  }
}
