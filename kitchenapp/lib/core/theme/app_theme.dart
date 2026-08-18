import 'package:flutter/material.dart';

import '../config/app_variant_content.dart';
import '../constants/app_colors.dart';

class AppTheme {
  const AppTheme._();

  static ThemeData get light {
    final accent = AppVariantContent.primaryColor;
    final scheme = ColorScheme.fromSeed(
      seedColor: accent,
      brightness: Brightness.light,
    );

    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: AppColors.scaffold,
      appBarTheme: AppBarTheme(
        centerTitle: false,
        elevation: 0,
        scrolledUnderElevation: 0,
        backgroundColor: AppColors.scaffold,
        foregroundColor: AppColors.primaryText,
        surfaceTintColor: accent,
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: Colors.white,
        indicatorColor: accent.withValues(alpha: 0.12),
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return TextStyle(
            fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
            fontSize: 12,
            color: selected ? accent : AppColors.secondaryText,
          );
        }),
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: AppColors.panelBorder),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: AppColors.panelBorder),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: AppColors.panelBorder),
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
      textTheme: const TextTheme(
        headlineSmall: TextStyle(
          fontWeight: FontWeight.w900,
          color: AppColors.primaryText,
        ),
        titleMedium: TextStyle(
          fontWeight: FontWeight.w800,
          color: AppColors.primaryText,
        ),
        bodyMedium: TextStyle(
          color: AppColors.bodyText,
        ),
      ),
    );
  }
}
