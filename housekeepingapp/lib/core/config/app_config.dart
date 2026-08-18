import 'package:kitchenapp/core/config/app_variant_config.dart';

class AppConfig {
  const AppConfig._();

  static void initialize() {
    AppVariantConfig.configure(StaffAppVariant.housekeeping);
  }

  static StaffAppVariant get variant => StaffAppVariant.housekeeping;
}
