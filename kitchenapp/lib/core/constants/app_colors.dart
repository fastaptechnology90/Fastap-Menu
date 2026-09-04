import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Global dark/light switch for the whole app family (waiter / kitchen /
/// housekeeping). Every [AppColors] member is a getter that resolves against
/// this, and each app's root rebuilds when it flips (see the
/// ValueListenableBuilder in `app/*_app.dart`). Default is the "Modern Dark
/// POS" look; the toggle drops to a clean light theme.
final ValueNotifier<bool> appDarkMode = ValueNotifier<bool>(true);

const _darkModeKey = 'fastap_dark_mode';

/// Load the saved theme preference at startup (call before runApp).
Future<void> loadThemeMode() async {
  final prefs = await SharedPreferences.getInstance();
  appDarkMode.value = prefs.getBool(_darkModeKey) ?? true;
}

/// Flip and persist the theme.
Future<void> setDarkMode(bool value) async {
  appDarkMode.value = value;
  final prefs = await SharedPreferences.getInstance();
  await prefs.setBool(_darkModeKey, value);
}

class AppColors {
  const AppColors._();

  static bool get isDark => appDarkMode.value;

  /// Pick the light or dark value for the current mode.
  static Color _p(Color light, Color dark) => isDark ? dark : light;

  // ---- Brand accent ----
  static Color get primary => _p(const Color(0xff0f766e), const Color(0xff14b8a6));

  // ---- Text ----
  static Color get primaryText => _p(const Color(0xff17211d), const Color(0xffe8ecf1));
  static Color get secondaryText => _p(const Color(0xff5a6762), const Color(0xff97a2ad));
  static Color get bodyText => _p(const Color(0xff25312d), const Color(0xffccd4db));

  // ---- Surfaces ----
  // scaffold = page background; surface = card/panel background.
  static Color get scaffold => _p(const Color(0xfff5f7f4), const Color(0xff0f1115));
  static Color get surface => _p(Colors.white, const Color(0xff1a1d24));
  static Color get surfaceAlt => _p(const Color(0xfff7faf8), const Color(0xff22262e));
  static Color get panelBorder => _p(const Color(0xffd9e2dc), const Color(0xff2a2f38));
  static Color get chipBackground => _p(const Color(0xfff7faf8), const Color(0xff22262e));

  // ---- Status ----
  static Color get danger => _p(const Color(0xffdc2626), const Color(0xffef4444));
  static Color get warning => _p(const Color(0xffb45309), const Color(0xfff59e0b));
  static Color get info => _p(const Color(0xff2563eb), const Color(0xff3b82f6));
  static Color get premium => _p(const Color(0xff7c3aed), const Color(0xffa855f7));

  /// A card/panel surface decoration that adapts to the theme.
  static BoxDecoration surfaceCard({double radius = 20}) {
    return BoxDecoration(
      color: surface,
      borderRadius: BorderRadius.circular(radius),
      border: Border.all(color: panelBorder),
      boxShadow: [
        BoxShadow(
          color: Colors.black.withValues(alpha: isDark ? 0.28 : 0.04),
          blurRadius: 14,
          offset: const Offset(0, 6),
        ),
      ],
    );
  }
}
