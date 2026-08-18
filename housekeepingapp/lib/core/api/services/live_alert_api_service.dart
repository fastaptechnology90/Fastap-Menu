import 'package:kitchenapp/core/api/kitchen_api_client.dart';

import '../endpoints/live_alert_endpoints.dart';
import 'api_provider.dart';

class LiveAlertApiService {
  LiveAlertApiService({KitchenApiClient? apiClient})
      : _api = apiClient ?? ApiProvider.createClient();

  final KitchenApiClient _api;

  Future<Map<String, dynamic>> fetchBoard({String section = 'All'}) async {
    final response = await _api.get(
      LiveAlertEndpoints.board,
      query: {'section': section},
    );
    return response['data'] as Map<String, dynamic>? ?? response;
  }
}
