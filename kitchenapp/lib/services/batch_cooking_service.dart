import '../core/api/api_provider.dart';
import '../core/api/batch_cooking_endpoints.dart';
import '../core/api/kitchen_api_client.dart';
import '../models/batch_cooking/batch_cooking_snapshot.dart';
import '../services/auth_service.dart';

class BatchCookingService {
  BatchCookingService({KitchenApiClient? apiClient})
      : _api = apiClient ?? ApiProvider.createClient();

  final KitchenApiClient _api;

  factory BatchCookingService.fromAuth(AuthService authService) {
    return BatchCookingService(apiClient: authService.apiClient);
  }

  Future<BatchCookingSnapshot> fetchBoard({String section = 'All'}) async {
    final response = await _api.get(
      BatchCookingEndpoints.board,
      query: {'section': section},
    );

    return BatchCookingSnapshot.fromJson(
      response['data'] as Map<String, dynamic>,
    );
  }

  Future<BatchCookingActionResult> refreshForecast() async {
    final response = await _api.post(BatchCookingEndpoints.forecast);
    return BatchCookingActionResult.fromJson(response);
  }

  Future<BatchCookingActionResult> performAction({
    required String batchId,
    required String action,
  }) async {
    final response = await _api.post(
      BatchCookingEndpoints.action(batchId),
      body: {'action': action},
    );
    return BatchCookingActionResult.fromJson(response);
  }
}
