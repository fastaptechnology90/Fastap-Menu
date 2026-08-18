import 'package:kitchenapp/models/auth/staff_role.dart';

/// Waiter-app allowed staff roles (single role product).
class WaiterRoleRegistry {
  const WaiterRoleRegistry._();

  static const allowedRoles = <StaffRole>[StaffRole.waiter];

  static StaffRole get defaultRole => StaffRole.waiter;

  static bool isRoleAllowed(StaffRole role) => role == StaffRole.waiter;

  static String roleMismatchMessage() =>
      'This account is not a waiter. Use the kitchen or housekeeping app instead.';
}
