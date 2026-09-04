import 'package:flutter/material.dart';

import '../constants/app_colors.dart';

/// Light + dark "Modern POS" themes shared by all three apps. The active one is
/// chosen by `themeMode` in each app root, kept in sync with [appDarkMode] so
/// the ThemeData and the [AppColors] getters always agree.
class AppTheme {
  const AppTheme._();

  static ThemeData get light => _build(
        brightness: Brightness.light,
        accent: const Color(0xff0f766e),
        scaffold: const Color(0xfff5f7f4),
        surface: Colors.white,
        onSurface: const Color(0xff17211d),
        muted: const Color(0xff5a6762),
        border: const Color(0xffd9e2dc),
      );

  static ThemeData get dark => _build(
        brightness: Brightness.dark,
        accent: const Color(0xff14b8a6),
        scaffold: const Color(0xff0f1115),
        surface: const Color(0xff1a1d24),
        onSurface: const Color(0xffe8ecf1),
        muted: const Color(0xff97a2ad),
        border: const Color(0xff2a2f38),
      );

  static ThemeData _build({
    required Brightness brightness,
    required Color accent,
    required Color scaffold,
    required Color surface,
    required Color onSurface,
    required Color muted,
    required Color border,
  }) {
    final scheme = ColorScheme.fromSeed(
      seedColor: accent,
      brightness: brightness,
    ).copyWith(
      surface: surface,
      onSurface: onSurface,
    );

    return ThemeData(
      useMaterial3: true,
      brightness: brightness,
      colorScheme: scheme,
      scaffoldBackgroundColor: scaffold,
      appBarTheme: AppBarTheme(
        centerTitle: false,
        elevation: 0,
        scrolledUnderElevation: 0,
        backgroundColor: scaffold,
        foregroundColor: onSurface,
        surfaceTintColor: Colors.transparent,
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: surface,
        indicatorColor: accent.withValues(alpha: 0.16),
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return TextStyle(
            fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
            fontSize: 12,
            color: selected ? accent : muted,
          );
        }),
      ),
      cardTheme: CardThemeData(
        color: surface,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: BorderSide(color: border),
        ),
      ),
      dividerColor: border,
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: surface,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: accent, width: 1.6),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: accent,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          textStyle: const TextStyle(fontWeight: FontWeight.w800),
        ),
      ),
      textTheme: TextTheme(
        headlineSmall: TextStyle(fontWeight: FontWeight.w900, color: onSurface),
        titleMedium: TextStyle(fontWeight: FontWeight.w800, color: onSurface),
        bodyMedium: TextStyle(color: onSurface),
      ),
    );
  }
}
