import '../core/config/app_config.dart';

/// Application startup: variant, services, and environment wiring.
class AppBootstrap {
  const AppBootstrap._();

  static void initialize() {
    AppConfig.initialize();
  }
}
