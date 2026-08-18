import 'package:flutter_test/flutter_test.dart';

import 'package:kitchenapp/core/config/app_variant_config.dart';
import 'package:kitchenapp/data/staff_role_registry.dart';
import 'package:kitchenapp/models/auth/staff_role.dart';

void main() {
  group('StaffRoleRegistry', () {
    test('kitchen app excludes waiter and housekeeping', () {
      final roles = StaffRoleRegistry.rolesFor(StaffAppVariant.kitchen);

      expect(roles, isNot(contains(StaffRole.waiter)));
      expect(roles, isNot(contains(StaffRole.housekeeping)));
      expect(roles.length, 12);
    });

    test('waiter app only allows waiter role', () {
      expect(
        StaffRoleRegistry.rolesFor(StaffAppVariant.waiter),
        [StaffRole.waiter],
      );
    });

    test('housekeeping app only allows housekeeping role', () {
      expect(
        StaffRoleRegistry.rolesFor(StaffAppVariant.housekeeping),
        [StaffRole.housekeeping],
      );
    });
  });
}
