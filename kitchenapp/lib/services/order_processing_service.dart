import '../core/api/api_provider.dart';
import '../core/api/kitchen_api_client.dart';
import '../core/api/order_processing_endpoints.dart';
import '../models/processing/processing_snapshot.dart';
import '../services/auth_service.dart';

class OrderProcessingService {
  OrderProcessingService({KitchenApiClient? apiClient})
      : _api = apiClient ?? ApiProvider.createClient();

  final KitchenApiClient _api;

  factory OrderProcessingService.fromAuth(AuthService authService) {
    return OrderProcessingService(apiClient: authService.apiClient);
  }

  Future<ProcessingSnapshot> fetchProcessing({String section = 'All'}) async {
    final response = await _api.get(
      OrderProcessingEndpoints.processing,
      query: {'section': section},
    );

    return ProcessingSnapshot.fromJson(response['data'] as Map<String, dynamic>);
  }

  Future<ProcessingOptimizeResult> optimizeQueue() async {
    final response = await _api.post(OrderProcessingEndpoints.optimize);
    return ProcessingOptimizeResult.fromJson(response);
  }

  Future<void> processAction({
    required String orderId,
    required String action,
    String? targetSection,
    String? itemName,
    String? modification,
  }) async {
    await _api.post(
      OrderProcessingEndpoints.process(orderId),
      body: {
        'action': action,
        'targetSection': ?targetSection,
        'itemName': ?itemName,
        'modification': ?modification,
      },
    );
  }
}
