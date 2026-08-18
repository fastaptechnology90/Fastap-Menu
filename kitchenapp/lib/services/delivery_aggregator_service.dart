import '../core/api/api_provider.dart';
import '../core/api/delivery_aggregator_endpoints.dart';
import '../core/api/kitchen_api_client.dart';
import '../models/aggregator/delivery_aggregator_snapshot.dart';
import '../services/auth_service.dart';

class DeliveryAggregatorService {
  DeliveryAggregatorService({KitchenApiClient? apiClient})
      : _api = apiClient ?? ApiProvider.createClient();

  final KitchenApiClient _api;

  factory DeliveryAggregatorService.fromAuth(AuthService authService) {
    return DeliveryAggregatorService(apiClient: authService.apiClient);
  }

  Future<DeliveryAggregatorSnapshot> fetchBoard({String section = 'All'}) async {
    final response = await _api.get(
      DeliveryAggregatorEndpoints.board,
      query: {'section': section},
    );

    return DeliveryAggregatorSnapshot.fromJson(
      response['data'] as Map<String, dynamic>,
    );
  }

  Future<DeliveryAggregatorActionResult> performAction({
    required String orderId,
    required String action,
  }) async {
    final response = await _api.post(
      DeliveryAggregatorEndpoints.orderAction(orderId),
      body: {'action': action},
    );
    return DeliveryAggregatorActionResult.fromJson(response);
  }

  Future<DeliveryAggregatorActionResult> syncAllOrders() async {
    final response = await _api.post(DeliveryAggregatorEndpoints.syncAll);
    return DeliveryAggregatorActionResult.fromJson(response);
  }
}
