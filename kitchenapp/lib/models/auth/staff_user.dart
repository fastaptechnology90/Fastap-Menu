import 'staff_role.dart';

class StaffUser {
  const StaffUser({
    required this.id,
    required this.name,
    required this.role,
    required this.section,
    required this.phone,
    required this.staffCode,
    this.email = '',
    this.avatarUrl,
  });

  final String id;
  final String name;
  final StaffRole role;
  final String section;
  final String phone;
  final String staffCode;
  final String email;
  final String? avatarUrl;

  StaffUser copyWith({
    String? name,
    String? section,
    String? phone,
    String? email,
    String? avatarUrl,
  }) {
    return StaffUser(
      id: id,
      name: name ?? this.name,
      role: role,
      section: section ?? this.section,
      phone: phone ?? this.phone,
      staffCode: staffCode,
      email: email ?? this.email,
      avatarUrl: avatarUrl ?? this.avatarUrl,
    );
  }

  factory StaffUser.fromJson(Map<String, dynamic> json) {
    return StaffUser(
      id: json['id'] as String,
      name: json['name'] as String,
      role: StaffRole.fromApi(json['role'] as String),
      section: json['section'] as String? ?? 'Main',
      phone: json['phone'] as String? ?? '',
      staffCode: json['staffCode'] as String? ?? '',
      email: json['email'] as String? ?? '',
      avatarUrl: json['avatarUrl'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'role': role.name,
        'section': section,
        'phone': phone,
        'staffCode': staffCode,
        'email': email,
        'avatarUrl': avatarUrl,
      };
}
