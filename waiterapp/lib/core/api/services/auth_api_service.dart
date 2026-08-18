import 'package:kitchenapp/core/api/kitchen_api_client.dart';
import 'package:kitchenapp/core/storage/session_storage.dart';
import 'package:kitchenapp/models/auth/auth_session.dart';

import '../endpoints/auth_endpoints.dart';
import 'api_provider.dart';

/// Authentication and session API for the waiter app.
class AuthApiService {
  AuthApiService({
    KitchenApiClient? apiClient,
    SessionStorage? sessionStorage,
  })  : _api = apiClient ?? ApiProvider.createClient(),
        _storage = sessionStorage ?? SessionStorage();

  final KitchenApiClient _api;
  final SessionStorage _storage;

  KitchenApiClient get apiClient => _api;

  Future<AuthSession> loginWithPassword({
    required String staffCode,
    required String password,
    required String deviceId,
    required String role,
  }) async {
    final response = await _api.post(
      AuthEndpoints.passwordLogin,
      body: {
        'staffCode': staffCode,
        'password': password,
        'deviceId': deviceId,
        'role': role,
      },
    );
    final data = response['data'] as Map<String, dynamic>;
    final session = AuthSession.fromJson(data);
    _api.authToken = session.token;
    await _storage.saveSession(session);
    return session;
  }

  Future<AuthSession?> restoreSession() async {
    final stored = await _storage.loadSession();
    if (stored == null) return null;
    _api.authToken = stored.token;
    final response = await _api.get(AuthEndpoints.session);
    final data = response['session'] as Map<String, dynamic>? ??
        response['data'] as Map<String, dynamic>?;
    if (data == null) return stored;
    final session = AuthSession.fromJson(data);
    await _storage.saveSession(session);
    return session;
  }

  Future<void> logout() async {
    try {
      await _api.post(AuthEndpoints.logout);
    } finally {
      _api.authToken = null;
      await _storage.clearSession();
    }
  }

  void dispose() => _api.dispose();
}
