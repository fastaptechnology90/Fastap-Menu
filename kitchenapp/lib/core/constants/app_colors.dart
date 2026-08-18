import 'package:flutter/material.dart';

class AppColors {
  const AppColors._();

  static const primary = Color(0xff0f766e);
  static const primaryText = Color(0xff17211d);
  static const secondaryText = Color(0xff5a6762);
  static const bodyText = Color(0xff25312d);
  static const scaffold = Color(0xfff5f7f4);
  static const panelBorder = Color(0xffd9e2dc);
  static const chipBackground = Color(0xfff7faf8);
  static const danger = Color(0xffdc2626);
  static const warning = Color(0xffb45309);
  static const info = Color(0xff2563eb);
  static const premium = Color(0xff7c3aed);

  static BoxDecoration surfaceCard({double radius = 20}) {
    return BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(radius),
      border: Border.all(color: panelBorder),
      boxShadow: [
        BoxShadow(
          color: Colors.black.withValues(alpha: 0.04),
          blurRadius: 14,
          offset: const Offset(0, 6),
        ),
      ],
    );
  }
}
