import 'package:flutter/material.dart';

import 'package:kitchenapp/core/constants/app_colors.dart';
import 'package:kitchenapp/core/config/app_variant_content.dart';
import 'package:kitchenapp/core/constants/app_constants.dart';

class AppLogo extends StatelessWidget {
  const AppLogo({
    super.key,
    this.size = 72,
    this.showTagline = true,
    this.light = false,
  });

  final double size;
  final bool showTagline;
  final bool light;

  @override
  Widget build(BuildContext context) {
    final primary = light ? Colors.white : AppVariantContent.primaryColor;
    final accent = AppVariantContent.primaryColor;
    final sub = light ? Colors.white70 : AppColors.secondaryText;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: size,
          height: size,
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: light
                  ? [Colors.white.withValues(alpha: 0.25), Colors.white.withValues(alpha: 0.08)]
                  : [accent, accent.withValues(alpha: 0.75)],
            ),
            borderRadius: BorderRadius.circular(size * 0.28),
            boxShadow: [
              BoxShadow(
                color: accent.withValues(alpha: light ? 0.15 : 0.35),
                blurRadius: 24,
                offset: const Offset(0, 12),
              ),
            ],
          ),
          child: Icon(
            AppVariantContent.logoIcon,
            color: light ? Colors.white : Colors.white,
            size: size * 0.48,
          ),
        ),
        if (showTagline) ...[
          SizedBox(height: size * 0.28),
          Text(
            AppConstants.brandName,
            textAlign: TextAlign.center,
            overflow: TextOverflow.ellipsis,
            maxLines: 2,
            style: TextStyle(
              color: primary,
              fontWeight: FontWeight.w800,
              letterSpacing: 1.1,
              fontSize: size * 0.16,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            AppVariantContent.platformTagline,
            textAlign: TextAlign.center,
            style: TextStyle(
              color: sub,
              fontWeight: FontWeight.w600,
              fontSize: size * 0.14,
            ),
          ),
        ],
      ],
    );
  }
}
