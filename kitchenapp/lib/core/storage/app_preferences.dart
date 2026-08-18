import 'package:shared_preferences/shared_preferences.dart';

import '../config/app_variant_config.dart';

class AppPreferences {
  static String get _onboardingKey =>
      'fastap_onboarding_complete_${AppVariantConfig.variant.name}';
  static const _notificationsKey = 'fastap_notifications_enabled';
  static const _soundAlertsKey = 'fastap_sound_alerts_enabled';
  static const _hapticKey = 'fastap_haptic_enabled';
  static const _compactModeKey = 'fastap_compact_mode';

  Future<bool> isOnboardingComplete() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_onboardingKey) ?? false;
  }

  Future<void> setOnboardingComplete() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_onboardingKey, true);
  }

  Future<void> resetOnboarding() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_onboardingKey);
  }

  Future<bool> notificationsEnabled() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_notificationsKey) ?? true;
  }

  Future<void> setNotificationsEnabled(bool value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_notificationsKey, value);
  }

  Future<bool> soundAlertsEnabled() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_soundAlertsKey) ?? true;
  }

  Future<void> setSoundAlertsEnabled(bool value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_soundAlertsKey, value);
  }

  Future<bool> hapticEnabled() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_hapticKey) ?? true;
  }

  Future<void> setHapticEnabled(bool value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_hapticKey, value);
  }

  Future<bool> compactModeEnabled() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_compactModeKey) ?? false;
  }

  Future<void> setCompactModeEnabled(bool value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_compactModeKey, value);
  }
}
