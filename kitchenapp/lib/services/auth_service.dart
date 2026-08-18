import '../core/config/api_config.dart';
import '../core/api/api_provider.dart';
import '../core/api/http_kitchen_api_client.dart';
import '../core/api/kitchen_api_client.dart';
import '../core/api/mock_kitchen_api_client.dart';
import '../core/api/auth_endpoints.dart';
import '../core/api/feature_endpoints.dart';
import '../core/storage/session_storage.dart';
import '../models/auth/auth_session.dart';

class AuthService {
  AuthService({
    KitchenApiClient? apiClient,
    SessionStorage? sessionStorage,
  })  : _api = apiClient ?? ApiProvider.createClient(),
        _storage = sessionStorage ?? SessionStorage() {
    _wireUnauthorizedHandler();
  }

  final KitchenApiClient _api;
  final SessionStorage _storage;

  /// Invoked when the API returns 401 (expired or revoked token).
  void Function()? onSessionInvalidated;

  KitchenApiClient get apiClient => _api;

  void _wireUnauthorizedHandler() {
    final client = _api;
    if (client is HttpKitchenApiClient) {
      client.onUnauthorized = () {
        _api.authToken = null;
        _storage.clearSession();
        onSessionInvalidated?.call();
      };
    }
  }

  Future<void> submitAccessRequest({
    required String name,
    required String email,
    required String phone,
    required String staffCode,
    required String role,
  }) async {
    await _api.post(
      AuthEndpoints.register,
      body: {
        'name': name,
        'email': email,
        'phone': phone,
        'staffCode': staffCode,
        'role': role,
      },
    );
  }

  Future<void> requestOtp(
    String phone, {
    required String deviceId,
    String? role,
  }) async {
    await _api.post(
      AuthEndpoints.otpRequest,
      body: {
        'phone': phone,
        'deviceId': deviceId,
        'role': ?role,
      },
    );
  }

  Future<AuthSession> verifyOtp({
    required String phone,
    required String otp,
    required String deviceId,
    String? role,
    double? latitude,
    double? longitude,
  }) async {
    final response = await _api.post(
      AuthEndpoints.otpVerify,
      body: {
        'phone': phone,
        'otp': otp,
        'deviceId': deviceId,
        'role': ?role,
        'latitude': ?latitude,
        'longitude': ?longitude,
      },
    );
    return _persistSession(response);
  }

  Future<AuthSession> loginWithPin({
    required String staffCode,
    required String pin,
    required String deviceId,
    required String role,
    double? latitude,
    double? longitude,
  }) async {
    final response = await _api.post(
      AuthEndpoints.pinLogin,
      body: {
        'staffCode': staffCode,
        'pin': pin,
        'deviceId': deviceId,
        'role': role,
        'latitude': ?latitude,
        'longitude': ?longitude,
      },
    );
    return _persistSession(response);
  }

  Future<AuthSession> loginWithPassword({
    required String staffCode,
    required String password,
    required String deviceId,
    required String role,
    double? latitude,
    double? longitude,
  }) async {
    final response = await _api.post(
      AuthEndpoints.passwordLogin,
      body: {
        'staffCode': staffCode,
        'password': password,
        'deviceId': deviceId,
        'role': role,
        'latitude': ?latitude,
        'longitude': ?longitude,
      },
    );
    return _persistSession(response);
  }

  Future<AuthSession> loginWithQr({
    required String qrToken,
    required String deviceId,
    required String role,
    double? latitude,
    double? longitude,
  }) async {
    final response = await _api.post(
      AuthEndpoints.qrVerify,
      body: {
        'qrToken': qrToken,
        'deviceId': deviceId,
        'role': role,
        'latitude': ?latitude,
        'longitude': ?longitude,
      },
    );
    return _persistSession(response);
  }

  Future<AuthSession> loginWithBiometric({
    required String staffCode,
    required String biometricType,
    required String deviceId,
    required String role,
    bool deviceVerified = false,
    String? hardwareToken,
    double? latitude,
    double? longitude,
  }) async {
    final response = await _api.post(
      AuthEndpoints.biometricLogin,
      body: {
        'staffCode': staffCode,
        'biometricType': biometricType,
        'deviceId': deviceId,
        'role': role,
        if (deviceVerified) 'deviceVerified': true,
        'hardwareToken': ?hardwareToken,
        'latitude': ?latitude,
        'longitude': ?longitude,
      },
    );
    return _persistSession(response);
  }

  Future<AuthSession?> restoreSession() async {
    final cached = await _storage.loadSession();
    if (cached == null || cached.isExpired) {
      await _storage.clearSession();
      return null;
    }

    _api.authToken = cached.token;

    if (ApiConfig.useMockApi) {
      final mockClient = _api;
      if (mockClient is MockKitchenApiClient) {
        mockClient.restoreSessionFromCache(cached.toJson());
      }
      return cached;
    }

    try {
      final response = await _api.get(AuthEndpoints.session);
      final session = AuthSession.fromJson(
        response['session'] as Map<String, dynamic>,
      );
      await _storage.saveSession(session);
      return session;
    } catch (_) {
      await _storage.clearSession();
      return null;
    }
  }

  Future<AuthSession> refreshSession() async {
    final response = await _api.get(AuthEndpoints.session);
    return _persistSession(response, sessionKey: 'session');
  }

  Future<List<String>> fetchPermissions() async {
    final response = await _api.get(AuthEndpoints.permissions);
    return (response['permissions'] as List<dynamic>)
        .map((item) => item.toString())
        .toList();
  }

  Future<Map<String, dynamic>> fetchFeaturesPayload() async {
    return _api.get(FeatureEndpoints.features);
  }

  Future<Map<String, dynamic>> fetchCurrentShift() async {
    final response = await _api.get(AuthEndpoints.shiftCurrent);
    return response['shift'] as Map<String, dynamic>;
  }

  Future<void> bindDevice(String deviceId) async {
    await _api.post(
      AuthEndpoints.deviceBind,
      body: {'deviceId': deviceId},
    );
  }

  Future<void> logActivity(
    String action, {
    String? deviceId,
    Map<String, dynamic>? meta,
  }) async {
    try {
      await _api.post(
        AuthEndpoints.activity,
        body: {
          'action': action,
          'deviceId': ?deviceId,
          'meta': ?meta,
        },
      );
    } catch (_) {
      // Activity logging should not block UI flows.
    }
  }

  Future<void> logout({bool emergency = false}) async {
    try {
      if (emergency) {
        await _api.post(AuthEndpoints.emergencyLogout);
      } else {
        await _api.post(AuthEndpoints.logout);
      }
    } catch (_) {
      // Always clear local session even if API is unreachable.
    } finally {
      _api.authToken = null;
      await _storage.clearSession();
    }
  }

  Future<AuthSession> updateProfile({
    String? name,
    String? phone,
    String? section,
    String? avatarBase64,
    bool clearAvatar = false,
  }) async {
    final response = await _api.post(
      AuthEndpoints.profile,
      body: {
        'name': ?name,
        'phone': ?phone,
        'section': ?section,
        'avatarBase64': ?avatarBase64,
        if (clearAvatar) 'clearAvatar': true,
      },
    );
    return _persistSession(response, sessionKey: 'session');
  }

  Future<AuthSession> changeEmail({
    required String email,
    required String password,
  }) async {
    final response = await _api.post(
      AuthEndpoints.changeEmail,
      body: {'email': email, 'password': password},
    );
    return _persistSession(response, sessionKey: 'session');
  }

  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    await _api.post(
      AuthEndpoints.changePassword,
      body: {
        'currentPassword': currentPassword,
        'newPassword': newPassword,
      },
    );
  }

  Future<void> deleteAccount({
    required String password,
    required String confirmation,
  }) async {
    try {
      await _api.post(
        AuthEndpoints.deleteAccount,
        body: {
          'password': password,
          'confirmation': confirmation,
        },
      );
    } finally {
      _api.authToken = null;
      await _storage.clearSession();
    }
  }

  Future<AuthSession> _persistSession(
    Map<String, dynamic> response, {
    String sessionKey = 'data',
  }) async {
    final session = AuthSession.fromJson(
      response[sessionKey] as Map<String, dynamic>,
    );
    _api.authToken = session.token;
    await _storage.saveSession(session);
    return session;
  }

  void dispose() {
    _api.dispose();
  }
}
