import 'package:kitchenapp/models/auth/staff_role.dart';

class HousekeepingRoleRegistry {
  const HousekeepingRoleRegistry._();

  static const allowedRoles = <StaffRole>[StaffRole.housekeeping];

  static StaffRole get defaultRole => StaffRole.housekeeping;

  static bool isRoleAllowed(StaffRole role) => role == StaffRole.housekeeping;

  static String roleMismatchMessage() =>
      'This account is not housekeeping staff. Use the kitchen or waiter app instead.';
}
