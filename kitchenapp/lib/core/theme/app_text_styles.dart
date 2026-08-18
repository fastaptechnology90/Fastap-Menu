import 'package:flutter/material.dart';

import '../constants/app_colors.dart';

/// Reusable text styles for screens and components.
class AppTextStyles {
  const AppTextStyles._();

  static TextStyle screenTitle(BuildContext context) {
    return Theme.of(context).textTheme.headlineSmall!.copyWith(
          fontWeight: FontWeight.w900,
          color: AppColors.primaryText,
        );
  }

  static TextStyle screenSubtitle(BuildContext context) {
    return Theme.of(context).textTheme.bodyMedium!.copyWith(
          color: AppColors.secondaryText,
          fontWeight: FontWeight.w500,
        );
  }

  static TextStyle appBarTitle(BuildContext context) {
    return const TextStyle(
      fontWeight: FontWeight.w900,
      fontSize: 18,
    );
  }

  static TextStyle appBarSubtitle(BuildContext context) {
    return Theme.of(context).textTheme.labelSmall!.copyWith(
          color: AppColors.secondaryText,
          letterSpacing: 0.6,
        );
  }

  static TextStyle sectionHeader(BuildContext context) {
    return Theme.of(context).textTheme.titleMedium!.copyWith(
          fontWeight: FontWeight.w900,
          color: AppColors.primaryText,
        );
  }

  static const heroTitle = TextStyle(
    color: Colors.white,
    fontSize: 24,
    fontWeight: FontWeight.w900,
  );

  static const heroSubtitle = TextStyle(
    color: Colors.white70,
    fontWeight: FontWeight.w500,
  );
}
