import 'dart:convert';

import 'package:http/http.dart' as http;

import '../core/config/api_config.dart';

class ApiConnectivityResult {
  const ApiConnectivityResult({
    required this.reachable,
    required this.baseUrl,
    this.statusCode,
    this.message,
    this.latency,
  });

  final bool reachable;
  final String baseUrl;
  final int? statusCode;
  final String? message;
  final Duration? latency;

  String get summary {
    if (!reachable) {
      return message ?? 'Server unreachable';
    }
    final ms = latency?.inMilliseconds;
    return ms == null ? 'Connected' : 'Connected (${ms}ms)';
  }
}

/// Lightweight probe against the Fastap API health endpoint.
class ApiConnectivityService {
  const ApiConnectivityService();

  Future<ApiConnectivityResult> checkHealth({http.Client? client}) async {
    final httpClient = client ?? http.Client();
    final shouldClose = client == null;
    final baseUrl = ApiConfig.activeBaseUrl;
    final started = DateTime.now();

    try {
      final response = await httpClient
          .get(
            Uri.parse(ApiConfig.healthUrl),
            headers: const {'Accept': 'application/json'},
          )
          .timeout(ApiConfig.connectTimeout);

      final latency = DateTime.now().difference(started);
      if (response.statusCode >= 200 && response.statusCode < 300) {
        String? status;
        if (response.body.isNotEmpty) {
          try {
            final decoded = jsonDecode(response.body);
            if (decoded is Map<String, dynamic>) {
              status = decoded['status']?.toString();
            }
          } catch (_) {
            // Non-JSON health bodies are acceptable.
          }
        }
        return ApiConnectivityResult(
          reachable: true,
          baseUrl: baseUrl,
          statusCode: response.statusCode,
          message: status ?? 'ok',
          latency: latency,
        );
      }

      return ApiConnectivityResult(
        reachable: false,
        baseUrl: baseUrl,
        statusCode: response.statusCode,
        message: 'Health check failed (${response.statusCode})',
        latency: latency,
      );
    } catch (error) {
      return ApiConnectivityResult(
        reachable: false,
        baseUrl: baseUrl,
        message: error.toString(),
      );
    } finally {
      if (shouldClose) {
        httpClient.close();
      }
    }
  }
}
