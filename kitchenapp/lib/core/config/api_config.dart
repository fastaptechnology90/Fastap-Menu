import 'package:flutter/foundation.dart';

import 'test_environment.dart';

/// API runtime configuration for the kitchen app.
///
/// **Mock mode:** in-app demo data when `API_MODE=mock`.
/// **External mode (default):** live REST API at [externalBaseUrl].
///
/// ```powershell
/// # Production server
/// flutter run --dart-define=API_MODE=external --dart-define=API_BASE_URL=https://digitalrestuarants.thefingo.com
///
/// # Local API (Android emulator → host machine)
/// flutter run --dart-define=API_MODE=external --dart-define=API_BASE_URL=http://10.0.2.2:8080
/// ```
enum ApiRuntimeMode {
  mock,
  external,
}

enum AppEnvironment {
  development,
  staging,
  production,
}

class ApiConfig {
  const ApiConfig._();

  static const _modeDefine = String.fromEnvironment('API_MODE');
  static const _baseUrlDefine = String.fromEnvironment('API_BASE_URL', defaultValue: '');
  static const _envDefine = String.fromEnvironment('APP_ENV', defaultValue: '');

  /// Production Fastap API (nginx → Node on VPS).
  static const defaultExternalBaseUrl = 'https://digitalrestuarants.thefingo.com';

  static ApiRuntimeMode get mode {
    final define = _modeDefine.trim().toLowerCase();
    // Release builds always talk to the live API — no in-app mock/demo data on device.
    if (kReleaseMode && define != 'external') {
      return ApiRuntimeMode.external;
    }
    if (define == 'mock') return ApiRuntimeMode.mock;
    if (define == 'external') return ApiRuntimeMode.external;
    // Widget/unit tests: avoid live API probes unless external is forced.
    if (isFlutterTest) return ApiRuntimeMode.mock;
    // Default to production API unless mock is explicitly requested.
    return ApiRuntimeMode.external;
  }

  static AppEnvironment get environment {
    final define = _envDefine.trim().toLowerCase();
    return switch (define) {
      'dev' || 'development' => AppEnvironment.development,
      'staging' || 'stage' => AppEnvironment.staging,
      'prod' || 'production' => AppEnvironment.production,
      _ => kReleaseMode ? AppEnvironment.production : AppEnvironment.development,
    };
  }

  static bool get useMockApi => mode == ApiRuntimeMode.mock;

  static bool get isProduction =>
      !useMockApi && environment == AppEnvironment.production;

  /// Resolved base URL for [HttpKitchenApiClient].
  static String get externalBaseUrl {
    final trimmed = _baseUrlDefine.trim();
    if (trimmed.isNotEmpty) {
      return trimmed.endsWith('/')
          ? trimmed.substring(0, trimmed.length - 1)
          : trimmed;
    }
    return defaultExternalBaseUrl;
  }

  static const apiVersion = 'v1';
  static const connectTimeout = Duration(seconds: 20);
  static const sessionTimeoutMinutes = 480;
  static const otpResendSeconds = 30;
  static const mockNetworkDelay = Duration(milliseconds: 350);
  static const maxRetries = 1;

  static String get activeBaseUrl => externalBaseUrl;

  /// True when the app is talking to something on this machine rather than a
  /// deployed server.
  static bool get isLocalApi {
    final host = Uri.tryParse(externalBaseUrl)?.host ?? '';
    return host == 'localhost'
        || host == '127.0.0.1'
        || host == '10.0.2.2' // the Android emulator's alias for the host machine
        || host.startsWith('192.168.')
        || host.startsWith('10.');
  }

  static String get modeLabel {
    return switch (mode) {
      ApiRuntimeMode.mock => 'Mock API (demo)',
      // This used to read 'Live API · development' even while pointed at
      // localhost:8080. "Live" only ever meant "not mock", but anyone reading it
      // took it to mean production — a dangerous thing to be wrong about when
      // deciding whether it is safe to change an order. It now names the machine
      // it is actually talking to.
      ApiRuntimeMode.external =>
        isLocalApi
            ? 'Local API · ${Uri.tryParse(externalBaseUrl)?.host ?? externalBaseUrl}'
            : 'Production API · ${Uri.tryParse(externalBaseUrl)?.host ?? externalBaseUrl}',
    };
  }

  static String get apiRoot => '$activeBaseUrl/api/$apiVersion';

  /// Health probe (not versioned — mounted at `/api/health`).
  static String get healthUrl => '$activeBaseUrl/api/health';
}
