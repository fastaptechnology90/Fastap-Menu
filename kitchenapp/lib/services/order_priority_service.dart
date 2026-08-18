import '../core/api/api_provider.dart';
import '../core/api/kitchen_api_client.dart';
import '../core/api/order_priority_endpoints.dart';
import '../models/priority/order_priority_snapshot.dart';
import '../services/auth_service.dart';

class OrderPriorityService {
  OrderPriorityService({KitchenApiClient? apiClient})
      : _api = apiClient ?? ApiProvider.createClient();

  final KitchenApiClient _api;

  factory OrderPriorityService.fromAuth(AuthService authService) {
    return OrderPriorityService(apiClient: authService.apiClient);
  }

  Future<OrderPrioritySnapshot> fetchBoard({String section = 'All'}) async {
    final response = await _api.get(
      OrderPriorityEndpoints.board,
      query: {'section': section},
    );

    return OrderPrioritySnapshot.fromJson(
      response['data'] as Map<String, dynamic>,
    );
  }

  Future<PriorityActionResult> reprioritizeQueue() async {
    final response = await _api.post(OrderPriorityEndpoints.reprioritize);
    return PriorityActionResult.fromJson(response);
  }

  Future<PriorityActionResult> performAction({
    required String orderId,
    required String action,
  }) async {
    final response = await _api.post(
      OrderPriorityEndpoints.action(orderId),
      body: {'action': action},
    );
    return PriorityActionResult.fromJson(response);
  }
}
