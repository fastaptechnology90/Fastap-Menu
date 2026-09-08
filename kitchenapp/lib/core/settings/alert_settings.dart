import 'package:flutter/foundation.dart';

import '../storage/app_preferences.dart';

/// Device-level alert switches.
///
/// These were written to storage by the Settings screen and read by nothing:
/// turning "Sound alerts" off did not silence anything. They are notifiers so
/// the kitchen alarm can follow them live, from Settings or from the KDS
/// toolbar, without either surface having to know about the other.
final ValueNotifier<bool> soundAlertsEnabled = ValueNotifier<bool>(true);
final ValueNotifier<bool> hapticFeedbackEnabled = ValueNotifier<bool>(true);

/// Loads the saved values. Safe to call more than once.
Future<void> loadAlertSettings() async {
  final prefs = AppPreferences();
  final sound = await prefs.soundAlertsEnabled();
  final haptic = await prefs.hapticEnabled();
  soundAlertsEnabled.value = sound;
  hapticFeedbackEnabled.value = haptic;
}

Future<void> setSoundAlertsEnabled(bool value) async {
  soundAlertsEnabled.value = value;
  await AppPreferences().setSoundAlertsEnabled(value);
}

Future<void> setHapticFeedbackEnabled(bool value) async {
  hapticFeedbackEnabled.value = value;
  await AppPreferences().setHapticEnabled(value);
}
