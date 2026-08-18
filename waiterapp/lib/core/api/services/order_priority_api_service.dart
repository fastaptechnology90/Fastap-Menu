import 'package:kitchenapp/core/api/kitchen_api_client.dart';

import '../endpoints/order_priority_endpoints.dart';
import 'api_provider.dart';

/// Order priority queue API for waiter floor coordination.
class OrderPriorityApiService {
  OrderPriorityApiService({KitchenApiClient? apiClient})
      : _api = apiClient ?? ApiProvider.createClient();

  final KitchenApiClient _api;

  Future<Map<String, dynamic>> fetchBoard({String section = 'All'}) async {
    final response = await _api.get(
      OrderPriorityEndpoints.board,
      query: {'section': section},
    );
    return response['data'] as Map<String, dynamic>? ?? response;
  }
}
