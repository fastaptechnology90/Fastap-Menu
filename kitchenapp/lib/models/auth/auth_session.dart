import 'staff_user.dart';

class AuthSession {
  const AuthSession({
    required this.token,
    required this.user,
    required this.expiresAt,
    required this.deviceId,
    required this.shiftId,
    required this.permissions,
    required this.loginMethod,
    this.geoVerified = true,
  });

  final String token;
  final StaffUser user;
  final DateTime expiresAt;
  final String deviceId;
  final String shiftId;
  final List<String> permissions;
  final String loginMethod;
  final bool geoVerified;

  bool get isExpired => DateTime.now().isAfter(expiresAt);

  bool hasPermission(String permission) => permissions.contains(permission);

  AuthSession copyWith({
    String? token,
    StaffUser? user,
    DateTime? expiresAt,
    String? deviceId,
    String? shiftId,
    List<String>? permissions,
    String? loginMethod,
    bool? geoVerified,
  }) {
    return AuthSession(
      token: token ?? this.token,
      user: user ?? this.user,
      expiresAt: expiresAt ?? this.expiresAt,
      deviceId: deviceId ?? this.deviceId,
      shiftId: shiftId ?? this.shiftId,
      permissions: permissions ?? this.permissions,
      loginMethod: loginMethod ?? this.loginMethod,
      geoVerified: geoVerified ?? this.geoVerified,
    );
  }

  factory AuthSession.fromJson(Map<String, dynamic> json) {
    return AuthSession(
      token: json['token'] as String,
      user: StaffUser.fromJson(json['user'] as Map<String, dynamic>),
      expiresAt: DateTime.parse(json['expiresAt'] as String),
      deviceId: json['deviceId'] as String,
      shiftId: json['shiftId'] as String,
      permissions: (json['permissions'] as List<dynamic>)
          .map((item) => item.toString())
          .toList(),
      loginMethod: json['loginMethod'] as String? ?? 'password',
      geoVerified: json['geoVerified'] as bool? ?? true,
    );
  }

  Map<String, dynamic> toJson() => {
        'token': token,
        'user': user.toJson(),
        'expiresAt': expiresAt.toIso8601String(),
        'deviceId': deviceId,
        'shiftId': shiftId,
        'permissions': permissions,
        'loginMethod': loginMethod,
        'geoVerified': geoVerified,
      };
}
