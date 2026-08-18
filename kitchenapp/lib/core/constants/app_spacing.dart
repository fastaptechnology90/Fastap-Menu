import 'package:flutter/material.dart';

/// Shared spacing scale for consistent layout across screens.
class AppSpacing {
  const AppSpacing._();

  static const double xs = 4;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 20;
  static const double xxl = 24;
  static const double xxxl = 32;

  static const EdgeInsets screenHorizontal =
      EdgeInsets.symmetric(horizontal: xl);
  static const EdgeInsets screenPadding = EdgeInsets.all(xl);
  static const EdgeInsets cardPadding = EdgeInsets.all(lg);
  static const EdgeInsets listItemPadding =
      EdgeInsets.symmetric(horizontal: xl, vertical: md);

  static const double radiusSm = 12;
  static const double radiusMd = 14;
  static const double radiusLg = 16;
  static const double radiusXl = 20;
}
