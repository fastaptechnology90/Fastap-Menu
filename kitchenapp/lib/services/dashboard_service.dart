import 'package:flutter/foundation.dart';

import '../core/api/api_provider.dart';
import '../core/api/api_exception.dart';
import '../core/api/dashboard_endpoints.dart';
import '../core/api/kitchen_api_client.dart';
import '../models/dashboard/dashboard_snapshot.dart';
import '../services/auth_service.dart';

class DashboardService {
  DashboardService({KitchenApiClient? apiClient})
      : _api = apiClient ?? ApiProvider.createClient();

  final KitchenApiClient _api;

  factory DashboardService.fromAuth(AuthService authService) {
    return DashboardService(apiClient: authService.apiClient);
  }

  Future<DashboardSnapshot> fetchDashboard({String section = 'All'}) async {
    final response = await _api.get(
      DashboardEndpoints.dashboard,
      query: {'section': section},
    );

    if (response['success'] == false) {
      throw ApiException(
        message:
            response['message']?.toString() ?? 'Dashboard request failed.',
        code: response['code']?.toString(),
      );
    }

    final data = response['data'];
    if (data is! Map<String, dynamic>) {
      throw const ApiException(
        message: 'Dashboard data is unavailable right now. Try again.',
        code: 'INVALID_RESPONSE',
      );
    }

    try {
      return DashboardSnapshot.fromJson(data);
    } catch (error, stack) {
      if (kDebugMode) {
        debugPrint('DashboardSnapshot parse failed: $error\n$stack');
      }
      throw const ApiException(
        message: 'Dashboard data could not be read. Try again.',
        code: 'PARSE_ERROR',
      );
    }
  }
}
