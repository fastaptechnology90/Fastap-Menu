import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../models/auth/auth_session.dart';
import '../config/api_config.dart';

class SessionStorage {
  static const _sessionKey = 'fastap_auth_session';
  static const _legacySessionKey = 'fastap_auth_session';
  static const _deviceIdKey = 'fastap_device_id';

  SessionStorage({FlutterSecureStorage? secureStorage})
      : _secureOverride = secureStorage;

  final FlutterSecureStorage? _secureOverride;
  FlutterSecureStorage? _secure;

  bool get _useSecureStorage => !ApiConfig.useMockApi;

  FlutterSecureStorage get _secureStorage {
    return _secureOverride ??
        (_secure ??= const FlutterSecureStorage(
          aOptions: AndroidOptions(encryptedSharedPreferences: true),
        ));
  }

  Future<void> saveSession(AuthSession session) async {
    final encoded = jsonEncode(session.toJson());
    if (_useSecureStorage) {
      await _secureStorage.write(key: _sessionKey, value: encoded);
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_legacySessionKey);
      return;
    }

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_legacySessionKey, encoded);
  }

  Future<AuthSession?> loadSession() async {
    if (_useSecureStorage) {
      final secureRaw = await _secureStorage.read(key: _sessionKey);
      if (secureRaw != null) {
        return AuthSession.fromJson(jsonDecode(secureRaw) as Map<String, dynamic>);
      }

      // One-time migration from legacy SharedPreferences storage.
      final prefs = await SharedPreferences.getInstance();
      final legacyRaw = prefs.getString(_legacySessionKey);
      if (legacyRaw == null) {
        return null;
      }
      final session =
          AuthSession.fromJson(jsonDecode(legacyRaw) as Map<String, dynamic>);
      await saveSession(session);
      return session;
    }

    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_legacySessionKey);
    if (raw == null) {
      return null;
    }
    return AuthSession.fromJson(jsonDecode(raw) as Map<String, dynamic>);
  }

  Future<void> clearSession() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_legacySessionKey);
    if (_useSecureStorage) {
      await _secureStorage.delete(key: _sessionKey);
    }
  }

  Future<String?> loadDeviceId() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_deviceIdKey);
  }

  Future<void> saveDeviceId(String deviceId) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_deviceIdKey, deviceId);
  }
}
