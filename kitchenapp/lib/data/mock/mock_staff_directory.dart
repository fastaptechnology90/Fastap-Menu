import '../staff_role_access_policy.dart';
import '../../models/auth/staff_role.dart';

class MockStaffDirectory {
  const MockStaffDirectory._();

  static List<Map<String, dynamic>> get all => [
        _staff(
          id: 'STF-001',
          name: 'Chef Arjun Mehta',
          role: 'headChef',
          section: 'Main',
          phone: '+919876543210',
          staffCode: 'KCH-001',
          pin: '4521',
          password: 'chef@123',
        ),
        _staff(
          id: 'STF-002',
          name: 'Sous Chef Priya Nair',
          role: 'sousChef',
          section: 'Main',
          phone: '+919123456789',
          staffCode: 'KCH-002',
          pin: '7788',
          password: 'sous@123',
        ),
        _staff(
          id: 'STF-003',
          name: 'Ravi Tandoor',
          role: 'tandoorChef',
          section: 'Tandoor',
          phone: '+919888777666',
          staffCode: 'KCH-003',
          pin: '9090',
          password: 'tandoor@123',
        ),
        _staff(
          id: 'STF-004',
          name: 'Mei Lin',
          role: 'chineseChef',
          section: 'Chinese',
          phone: '+919555444333',
          staffCode: 'KCH-004',
          pin: '1212',
          password: 'wok@123',
        ),
        _staff(
          id: 'STF-005',
          name: 'Kitchen Manager Dev',
          role: 'kitchenManager',
          section: 'Main',
          phone: '+919111222333',
          staffCode: 'KCH-005',
          pin: '0000',
          password: 'manager@123',
        ),
        _staff(
          id: 'STF-006',
          name: 'Vikram Line',
          role: 'lineCook',
          section: 'Main',
          phone: '+919222333444',
          staffCode: 'KCH-006',
          pin: '3344',
          password: 'line@123',
        ),
        _staff(
          id: 'STF-007',
          name: 'Anita Beverage',
          role: 'beverageChef',
          section: 'Beverage',
          phone: '+919333444555',
          staffCode: 'KCH-007',
          pin: '5566',
          password: 'bar@123',
        ),
        _staff(
          id: 'STF-008',
          name: 'Sara Dessert',
          role: 'dessertChef',
          section: 'Dessert',
          phone: '+919444555666',
          staffCode: 'KCH-008',
          pin: '7788',
          password: 'sweet@123',
        ),
        _staff(
          id: 'STF-009',
          name: 'Rahul Bakery',
          role: 'bakeryChef',
          section: 'Bakery',
          phone: '+919555666777',
          staffCode: 'KCH-009',
          pin: '8899',
          password: 'bake@123',
        ),
        _staff(
          id: 'STF-010',
          name: 'Kiran Helper',
          role: 'kitchenHelper',
          section: 'Main',
          phone: '+919666777888',
          staffCode: 'KCH-010',
          pin: '1010',
          password: 'help@123',
        ),
        _staff(
          id: 'STF-011',
          name: 'Omar Expeditor',
          role: 'expeditor',
          section: 'Main',
          phone: '+919700000011',
          staffCode: 'KCH-011',
          pin: '1111',
          password: 'exp@123',
        ),
        _staff(
          id: 'STF-012',
          name: 'Neha Packing',
          role: 'packingStaff',
          section: 'Main',
          phone: '+919888999000',
          staffCode: 'KCH-012',
          pin: '1212',
          password: 'pack@123',
        ),
        _staff(
          id: 'STF-013',
          name: 'Rohan Waiter',
          role: 'waiter',
          section: 'Floor',
          phone: '+919900000013',
          staffCode: 'KCH-013',
          pin: '1313',
          password: 'wait@123',
        ),
        _staff(
          id: 'STF-014',
          name: 'Sunita Housekeeping',
          role: 'housekeeping',
          section: 'Rooms',
          phone: '+919900000014',
          staffCode: 'KCH-014',
          pin: '1414',
          password: 'clean@123',
        ),
      ];

  static Map<String, dynamic>? byPhone(String phone) {
    for (final staff in all) {
      if (staff['phone'] == phone) {
        return staff;
      }
    }
    return null;
  }

  static Map<String, dynamic>? byCode(String code) {
    final normalized = code.toUpperCase();
    for (final staff in all) {
      if (staff['staffCode'] == normalized) {
        return staff;
      }
    }
    return null;
  }

  static Map<String, dynamic>? byId(String id) {
    for (final staff in all) {
      if (staff['id'] == id) {
        return staff;
      }
    }
    return null;
  }

  static Map<String, dynamic> _staff({
    required String id,
    required String name,
    required String role,
    required String section,
    required String phone,
    required String staffCode,
    required String pin,
    required String password,
    String? email,
  }) {
    return {
      'id': id,
      'name': name,
      'role': role,
      'section': section,
      'phone': phone,
      'staffCode': staffCode,
      'pin': pin,
      'password': password,
      'email': email ?? '${staffCode.toLowerCase()}@fastap.kitchen',
      'permissions': _permissionsFor(role),
      'deleted': false,
    };
  }

  static List<String> _permissionsFor(String role) {
    return StaffRoleAccessPolicy.defaultPermissionsFor(
      StaffRole.fromApi(role),
    );
  }
}
