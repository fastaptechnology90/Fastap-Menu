import 'package:flutter/material.dart';

import '../constants/app_colors.dart';

/// The app's weight ramp.
///
/// Type used to be almost entirely w800/w900 with no w400 anywhere, which
/// flattens hierarchy: when every line shouts, nothing reads first. Ordinary
/// prose is [body]; only the one thing a person is meant to read first gets
/// [display].
class AppFontWeights {
  const AppFontWeights._();

  /// Body copy, list values, anything read at leisure.
  static const body = FontWeight.w400;

  /// Slightly lifted supporting copy — subtitles, captions.
  static const emphasis = FontWeight.w500;

  /// Field labels and chips.
  static const label = FontWeight.w600;

  /// The line that carries the meaning of a card.
  static const strong = FontWeight.w700;

  /// Reserved for headings and the single most important number on a screen.
  static const display = FontWeight.w800;
}

/// Reusable text styles for screens and components.
class AppTextStyles {
  const AppTextStyles._();

  static TextStyle screenTitle(BuildContext context) {
    return Theme.of(context).textTheme.headlineSmall!.copyWith(
          fontWeight: AppFontWeights.display,
          color: AppColors.primaryText,
        );
  }

  static TextStyle screenSubtitle(BuildContext context) {
    return Theme.of(context).textTheme.bodyMedium!.copyWith(
          color: AppColors.secondaryText,
          fontWeight: AppFontWeights.emphasis,
        );
  }

  static TextStyle appBarTitle(BuildContext context) {
    return const TextStyle(
      fontWeight: AppFontWeights.display,
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
          fontWeight: AppFontWeights.display,
          color: AppColors.primaryText,
        );
  }

  static const heroTitle = TextStyle(
    color: Colors.white,
    fontSize: 24,
    fontWeight: AppFontWeights.display,
  );

  static const heroSubtitle = TextStyle(
    color: Colors.white70,
    fontWeight: AppFontWeights.emphasis,
  );
}
