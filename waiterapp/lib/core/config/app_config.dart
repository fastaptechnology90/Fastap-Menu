import 'package:kitchenapp/core/config/app_variant_config.dart';

/// Waiter-app runtime configuration (variant + build metadata).
class AppConfig {
  const AppConfig._();

  static void initialize() {
    AppVariantConfig.configure(StaffAppVariant.waiter);
  }

  static StaffAppVariant get variant => StaffAppVariant.waiter;
}
