import 'package:flutter_test/flutter_test.dart';

import 'package:kitchenapp/data/staff_role_access_policy.dart';
import 'package:kitchenapp/models/auth/staff_role.dart';

void main() {
  group('StaffRoleAccessPolicy', () {
    test('waiter sees waiter module but not inventory', () {
      final permissions = StaffRoleAccessPolicy.defaultPermissionsFor(
        StaffRole.waiter,
      );

      expect(
        StaffRoleAccessPolicy.canAccessSystem(
          role: StaffRole.waiter,
          permissions: permissions,
          systemNumber: 49,
        ),
        isTrue,
      );
      expect(
        StaffRoleAccessPolicy.canAccessSystem(
          role: StaffRole.waiter,
          permissions: permissions,
          systemNumber: 13,
        ),
        isFalse,
      );
      expect(
        StaffRoleAccessPolicy.visibleShellTabs(
          role: StaffRole.waiter,
          permissions: permissions,
        ),
        isNot(contains(MainShellTab.kitchen)),
      );
    });

    test('head chef can access all systems and catalog', () {
      final permissions = StaffRoleAccessPolicy.defaultPermissionsFor(
        StaffRole.headChef,
      );

      expect(
        StaffRoleAccessPolicy.canAccessNavIndex(
          role: StaffRole.headChef,
          permissions: permissions,
          navIndex: 49,
        ),
        isTrue,
      );
      expect(
        StaffRoleAccessPolicy.canAccessSystem(
          role: StaffRole.headChef,
          permissions: permissions,
          systemNumber: 47,
        ),
        isTrue,
      );
    });

    test('line cook cannot open enterprise catalog without permission', () {
      final permissions = StaffRoleAccessPolicy.defaultPermissionsFor(
        StaffRole.lineCook,
      );

      expect(
        StaffRoleAccessPolicy.canAccessNavIndex(
          role: StaffRole.lineCook,
          permissions: permissions,
          navIndex: 49,
        ),
        isFalse,
      );
    });

    test('housekeeping sees cleaning hygiene but not waiter auto assignment', () {
      final permissions = StaffRoleAccessPolicy.defaultPermissionsFor(
        StaffRole.housekeeping,
      );

      expect(
        StaffRoleAccessPolicy.canAccessSystem(
          role: StaffRole.housekeeping,
          permissions: permissions,
          systemNumber: 29,
        ),
        isTrue,
      );
      expect(
        StaffRoleAccessPolicy.canAccessSystem(
          role: StaffRole.housekeeping,
          permissions: permissions,
          systemNumber: 49,
        ),
        isFalse,
      );
    });

    test('quick actions only include allowed modules', () {
      final permissions = StaffRoleAccessPolicy.defaultPermissionsFor(
        StaffRole.waiter,
      );
      final actions = StaffRoleAccessPolicy.quickActionNavIndices(
        role: StaffRole.waiter,
        permissions: permissions,
      );

      expect(actions, contains(48));
      expect(actions, isNot(contains(13)));
    });
  });
}
