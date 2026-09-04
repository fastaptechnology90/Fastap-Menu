import 'package:flutter/material.dart';

import '../constants/app_colors.dart';
import 'app_variant_config.dart';

/// Variant-specific copy and onboarding content for all staff apps.
class AppVariantContent {
  const AppVariantContent._();

  static String get splashMessage => switch (AppVariantConfig.variant) {
        StaffAppVariant.waiter => 'Preparing your floor service workspace…',
        StaffAppVariant.housekeeping =>
          'Preparing your housekeeping workspace…',
        StaffAppVariant.kitchen => 'Preparing your kitchen workspace…',
      };

  static String get platformTagline => switch (AppVariantConfig.variant) {
        StaffAppVariant.waiter => 'Waiter Service Platform',
        StaffAppVariant.housekeeping => 'Housekeeping Platform',
        StaffAppVariant.kitchen => 'Kitchen Command Platform',
      };

  static IconData get logoIcon => switch (AppVariantConfig.variant) {
        StaffAppVariant.waiter => Icons.room_service_rounded,
        StaffAppVariant.housekeeping => Icons.cleaning_services_rounded,
        StaffAppVariant.kitchen => Icons.restaurant_menu_rounded,
      };

  static String get loginTitle => switch (AppVariantConfig.variant) {
        StaffAppVariant.waiter => 'Waiter sign in',
        StaffAppVariant.housekeeping => 'Housekeeping sign in',
        StaffAppVariant.kitchen => 'Kitchen staff sign in',
      };

  static String get loginSubtitle => switch (AppVariantConfig.variant) {
        StaffAppVariant.waiter =>
          'Sign in to manage table service, deliveries, and floor alerts.',
        StaffAppVariant.housekeeping =>
          'Sign in to manage room cleaning, maintenance, and room service.',
        StaffAppVariant.kitchen =>
          'Choose a secure login method. Sessions are shift-bound and audited.',
      };

  static String get serverUnreachableMessage => switch (AppVariantConfig.variant) {
        StaffAppVariant.waiter =>
          'Cannot reach the service server (${AppVariantConfig.variantLabel}). Check network or contact IT.',
        StaffAppVariant.housekeeping =>
          'Cannot reach the housekeeping server. Check network or contact IT.',
        StaffAppVariant.kitchen =>
          'Cannot reach the kitchen server. Check network or contact IT.',
      };

  static String get defaultFirstName => switch (AppVariantConfig.variant) {
        StaffAppVariant.waiter => 'Waiter',
        StaffAppVariant.housekeeping => 'Housekeeper',
        StaffAppVariant.kitchen => 'Chef',
      };

  static String get defaultSection => switch (AppVariantConfig.variant) {
        StaffAppVariant.waiter => 'Floor',
        StaffAppVariant.housekeeping => 'Rooms',
        StaffAppVariant.kitchen => 'Kitchen',
      };

  /// Brand accent used across theme, buttons, and highlights.
  static Color get primaryColor => switch (AppVariantConfig.variant) {
        StaffAppVariant.waiter => const Color(0xff0284c7),
        StaffAppVariant.housekeeping => const Color(0xff059669),
        StaffAppVariant.kitchen => const Color(0xff0f766e),
      };

  /// Splash / login backdrop. Follows the theme: these used to be fixed light
  /// tints, so in dark mode the login and splash showed a pale background behind
  /// dark cards and light text — half the screen light, half dark.
  static List<Color> get backgroundGradient => AppColors.isDark
      ? switch (AppVariantConfig.variant) {
          StaffAppVariant.waiter => const [
              Color(0xff0b1220),
              Color(0xff0f1115),
              Color(0xff0a1526),
            ],
          StaffAppVariant.housekeeping => const [
              Color(0xff08160f),
              Color(0xff0f1115),
              Color(0xff071a13),
            ],
          StaffAppVariant.kitchen => const [
              Color(0xff08161a),
              Color(0xff0f1115),
              Color(0xff06181a),
            ],
        }
      : switch (AppVariantConfig.variant) {
          StaffAppVariant.waiter => const [
              Color(0xffeff6ff),
              Color(0xfff8fafc),
              Color(0xfff0f9ff),
            ],
          StaffAppVariant.housekeeping => const [
              Color(0xffecfdf5),
              Color(0xfff8fafc),
              Color(0xffe6fffa),
            ],
          StaffAppVariant.kitchen => const [
              Color(0xffecfdf5),
              Color(0xfff5f7f4),
              Color(0xffe6fffa),
            ],
        };

  static String get homeQuickActionsSubtitle => switch (AppVariantConfig.variant) {
        StaffAppVariant.waiter => 'Table service, deliveries, and floor alerts',
        StaffAppVariant.housekeeping => 'Cleaning, room service, and guest care',
        StaffAppVariant.kitchen => 'Jump to your most-used kitchen tools',
      };

  static String get emptyStatsMessage => switch (AppVariantConfig.variant) {
        StaffAppVariant.waiter => 'Could not load floor stats',
        StaffAppVariant.housekeeping => 'Could not load housekeeping stats',
        StaffAppVariant.kitchen => 'Could not load kitchen stats',
      };

  static String get rushAlertHint => switch (AppVariantConfig.variant) {
        StaffAppVariant.waiter => 'Review VIP tables and ready orders',
        StaffAppVariant.housekeeping => 'Review urgent room and hygiene tasks',
        StaffAppVariant.kitchen => 'Tap Alerts tab to review priorities',
      };

  static List<Color> get headerGradient => switch (AppVariantConfig.variant) {
        StaffAppVariant.waiter => const [
            Color(0xff1e3a8a),
            Color(0xff2563eb),
            Color(0xff0284c7),
          ],
        StaffAppVariant.housekeeping => const [
            Color(0xff065f46),
            Color(0xff059669),
            Color(0xff10b981),
          ],
        StaffAppVariant.kitchen => const [
            Color(0xff312e81),
            Color(0xff4338ca),
            Color(0xff4f46e5),
          ],
      };

  static List<OnboardingPageData> get onboardingPages =>
      switch (AppVariantConfig.variant) {
        StaffAppVariant.waiter => const [
            OnboardingPageData(
              icon: Icons.table_restaurant_rounded,
              title: 'Floor & Table Service',
              subtitle:
                  'See ready orders, table calls, and VIP alerts — auto-assigned to your queue.',
              color: Color(0xff059669),
            ),
            OnboardingPageData(
              icon: Icons.delivery_dining_rounded,
              title: 'Deliver with Confidence',
              subtitle:
                  'Confirm pickups, track banquet and room trays, and balance workload across waiters.',
              color: Color(0xff0284c7),
            ),
            OnboardingPageData(
              icon: Icons.verified_user_rounded,
              title: 'Secure Waiter Access',
              subtitle:
                  'Password, PIN, OTP, or biometric login with shift-bound sessions.',
              color: Color(0xff7c3aed),
            ),
          ],
        StaffAppVariant.housekeeping => const [
            OnboardingPageData(
              icon: Icons.cleaning_services_rounded,
              title: 'Room & Hygiene Tasks',
              subtitle:
                  'Cleaning schedules, maintenance requests, and sanitization checklists in one place.',
              color: Color(0xff059669),
            ),
            OnboardingPageData(
              icon: Icons.hotel_rounded,
              title: 'Room Service Delivery',
              subtitle:
                  'Guest tray requests, VIP rooms, and auto-assigned housekeeping workloads.',
              color: Color(0xff0284c7),
            ),
            OnboardingPageData(
              icon: Icons.verified_user_rounded,
              title: 'Secure Staff Access',
              subtitle:
                  'Password, PIN, OTP, or biometric login with audited shift sessions.',
              color: Color(0xff7c3aed),
            ),
          ],
        StaffAppVariant.kitchen => const [
            OnboardingPageData(
              icon: Icons.monitor_rounded,
              title: 'Live Kitchen Display',
              subtitle:
                  'Track every order in real time with VIP alerts, section views, and chef assignments.',
              color: Color(0xff059669),
            ),
            OnboardingPageData(
              icon: Icons.grid_view_rounded,
              title: '49 Enterprise Systems',
              subtitle:
                  'Inventory, QC, banquets, room service, IoT, analytics — all in one platform.',
              color: Color(0xff0284c7),
            ),
            OnboardingPageData(
              icon: Icons.verified_user_rounded,
              title: 'Secure Staff Access',
              subtitle:
                  'PIN, password, OTP, and biometric login with shift-bound sessions and audit trails.',
              color: Color(0xff7c3aed),
            ),
          ],
      };
}

class OnboardingPageData {
  const OnboardingPageData({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.color,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final Color color;
}
