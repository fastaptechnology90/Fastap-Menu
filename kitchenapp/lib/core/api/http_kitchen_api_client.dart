import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

import '../config/api_config.dart';
import 'api_exception.dart';
import 'kitchen_api_client.dart';

class HttpKitchenApiClient implements KitchenApiClient {
  HttpKitchenApiClient({
    http.Client? httpClient,
    String? baseUrl,
    this.authToken,
    this.onUnauthorized,
  })  : _http = httpClient ?? http.Client(),
        baseUrl = baseUrl ?? ApiConfig.externalBaseUrl;

  final http.Client _http;
  final String baseUrl;

  @override
  String? authToken;

  /// Called when the server returns 401. Wire to session logout in [AuthService].
  void Function()? onUnauthorized;

  String get _apiRoot => '$baseUrl/api/${ApiConfig.apiVersion}';

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'FastapKitchenApp/1.0',
        if (authToken != null) 'Authorization': 'Bearer $authToken',
      };

  @override
  Future<Map<String, dynamic>> get(
    String path, {
    Map<String, String>? query,
  }) {
    final uri = Uri.parse('$_apiRoot$path').replace(queryParameters: query);
    return _send(() => _http.get(uri, headers: _headers));
  }

  @override
  Future<Map<String, dynamic>> post(
    String path, {
    Map<String, dynamic>? body,
  }) {
    final uri = Uri.parse('$_apiRoot$path');
    return _send(
      () => _http.post(
        uri,
        headers: _headers,
        body: body == null ? null : jsonEncode(body),
      ),
    );
  }

  @override
  Future<Map<String, dynamic>> delete(
    String path, {
    Map<String, dynamic>? body,
  }) {
    final uri = Uri.parse('$_apiRoot$path');
    return _send(
      () => _http.delete(
        uri,
        headers: _headers,
        body: body == null ? null : jsonEncode(body),
      ),
    );
  }

  Future<Map<String, dynamic>> _send(
    Future<http.Response> Function() request,
  ) async {
    Object? lastError;
    for (var attempt = 0; attempt <= ApiConfig.maxRetries; attempt++) {
      try {
        final response = await request().timeout(ApiConfig.connectTimeout);
        return _decode(response);
      } on ApiException {
        rethrow;
      } on TimeoutException catch (error) {
        lastError = error;
      } on SocketException catch (error) {
        lastError = error;
      } catch (error) {
        throw ApiException(
          message: 'Unexpected network error: $error',
          code: 'NETWORK_ERROR',
        );
      }

      if (attempt < ApiConfig.maxRetries) {
        await Future<void>.delayed(Duration(milliseconds: 400 * (attempt + 1)));
      }
    }

    if (lastError is TimeoutException) {
      throw const ApiException(
        message: 'Request timed out. Check your network connection.',
        code: 'TIMEOUT',
      );
    }

    throw ApiException(
      message: 'Cannot reach server at $baseUrl',
      code: 'NETWORK_ERROR',
    );
  }

  Map<String, dynamic> _decode(http.Response response) {
    Map<String, dynamic> payload = const {};
    if (response.body.isNotEmpty) {
      final decoded = jsonDecode(response.body);
      if (decoded is Map<String, dynamic>) {
        payload = decoded;
      }
    }

    if (response.statusCode == 401) {
      onUnauthorized?.call();
      throw ApiException(
        message: payload['message']?.toString() ?? 'Session expired. Sign in again.',
        statusCode: 401,
        code: payload['code']?.toString() ?? 'UNAUTHORIZED',
      );
    }

    if (response.statusCode == 403 &&
        payload['code']?.toString() == 'MODULE_DISABLED') {
      throw ApiException(
        message: payload['message']?.toString() ??
            'This module is disabled for your restaurant.',
        statusCode: 403,
        code: 'MODULE_DISABLED',
      );
    }

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return payload;
    }

    throw ApiException(
      message: payload['message']?.toString()
          ?? payload['error']?.toString()
          ?? 'Request failed',
      statusCode: response.statusCode,
      code: payload['code']?.toString(),
    );
  }

  @override
  void dispose() {
    _http.close();
  }
}
