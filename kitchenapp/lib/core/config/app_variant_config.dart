/// Which staff-facing Flutter app is running.
///
/// Set via `--dart-define=APP_VARIANT=kitchen|waiter|housekeeping`.
/// The standalone [waiterapp] and [housekeepingapp] projects pass their
/// variant at build time; [kitchenapp] defaults to [kitchen].
enum StaffAppVariant {
  kitchen,
  waiter,
  housekeeping,
}

class AppVariantConfig {
  const AppVariantConfig._();

  static StaffAppVariant? _override;

  /// Called by standalone role apps ([waiterapp], [housekeepingapp]) at startup.
  static void configure(StaffAppVariant variant) {
    _override = variant;
  }

  static const _define = String.fromEnvironment(
    'APP_VARIANT',
    defaultValue: 'kitchen',
  );

  static StaffAppVariant get variant {
    if (_override != null) {
      return _override!;
    }
    return switch (_define.trim().toLowerCase()) {
      'waiter' => StaffAppVariant.waiter,
      'housekeeping' => StaffAppVariant.housekeeping,
      _ => StaffAppVariant.kitchen,
    };
  }

  static String get appTitle => switch (variant) {
        StaffAppVariant.waiter => 'Fastap Waiter',
        StaffAppVariant.housekeeping => 'Fastap Housekeeping',
        StaffAppVariant.kitchen => 'Fastap Smart Hospitality Kitchen',
      };

  static String get brandName => 'FASTAP SMART HOSPITALITY';

  static String get commandCenterTitle => switch (variant) {
        StaffAppVariant.waiter => 'Waiter Operations',
        StaffAppVariant.housekeeping => 'Housekeeping Operations',
        StaffAppVariant.kitchen => 'Kitchen Command Center',
      };

  static String get variantLabel => switch (variant) {
        StaffAppVariant.waiter => 'Waiter app',
        StaffAppVariant.housekeeping => 'Housekeeping app',
        StaffAppVariant.kitchen => 'Kitchen app',
      };
}
