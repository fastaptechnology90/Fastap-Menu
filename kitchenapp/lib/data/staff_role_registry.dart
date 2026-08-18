import '../core/config/app_variant_config.dart';
import '../models/auth/staff_role.dart';

/// Maps each Flutter app variant to the staff roles it may sign in with.
class StaffRoleRegistry {
  const StaffRoleRegistry._();

  static const _kitchenRoles = <StaffRole>[
    StaffRole.headChef,
    StaffRole.sousChef,
    StaffRole.lineCook,
    StaffRole.tandoorChef,
    StaffRole.chineseChef,
    StaffRole.beverageChef,
    StaffRole.dessertChef,
    StaffRole.bakeryChef,
    StaffRole.kitchenHelper,
    StaffRole.kitchenManager,
    StaffRole.expeditor,
    StaffRole.packingStaff,
  ];

  static List<StaffRole> rolesFor(StaffAppVariant variant) {
    return switch (variant) {
      StaffAppVariant.kitchen => _kitchenRoles,
      StaffAppVariant.waiter => const [StaffRole.waiter],
      StaffAppVariant.housekeeping => const [StaffRole.housekeeping],
    };
  }

  static List<StaffRole> get rolesForCurrentApp =>
      rolesFor(AppVariantConfig.variant);

  static StaffRole defaultRoleFor(StaffAppVariant variant) =>
      rolesFor(variant).first;

  static StaffRole get defaultRoleForCurrentApp =>
      defaultRoleFor(AppVariantConfig.variant);

  static bool isRoleAllowed(StaffRole role, StaffAppVariant variant) =>
      rolesFor(variant).contains(role);

  static bool isRoleAllowedForCurrentApp(StaffRole role) =>
      isRoleAllowed(role, AppVariantConfig.variant);

  static String roleMismatchMessage(StaffAppVariant variant) {
    return switch (variant) {
      StaffAppVariant.waiter =>
        'This account is not a waiter. Use the kitchen or housekeeping app instead.',
      StaffAppVariant.housekeeping =>
        'This account is not housekeeping staff. Use the kitchen or waiter app instead.',
      StaffAppVariant.kitchen =>
        'Waiter and housekeeping staff must use their dedicated apps.',
    };
  }
}
