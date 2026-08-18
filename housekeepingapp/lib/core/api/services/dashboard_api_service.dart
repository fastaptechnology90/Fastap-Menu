import 'package:kitchenapp/core/api/kitchen_api_client.dart';

import '../endpoints/dashboard_endpoints.dart';
import 'api_provider.dart';

class DashboardApiService {
  DashboardApiService({KitchenApiClient? apiClient})
      : _api = apiClient ?? ApiProvider.createClient();

  final KitchenApiClient _api;

  Future<Map<String, dynamic>> fetchDashboard({String section = 'All'}) async {
    final response = await _api.get(
      DashboardEndpoints.dashboard,
      query: {'section': section},
    );
    return response['data'] as Map<String, dynamic>? ?? response;
  }
}
