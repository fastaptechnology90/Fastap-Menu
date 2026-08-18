import '../config/app_variant_config.dart';

class AppConstants {
  const AppConstants._();

  static String get appTitle => AppVariantConfig.appTitle;
  static String get brandName => AppVariantConfig.brandName;
  static String get commandCenterTitle => AppVariantConfig.commandCenterTitle;
  static const desktopBreakpoint = 980.0;
}
