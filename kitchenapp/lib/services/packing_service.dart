import '../core/api/api_provider.dart';
import '../core/api/packing_endpoints.dart';
import '../core/api/kitchen_api_client.dart';
import '../models/packing/packing_delivery_snapshot.dart';
import '../services/auth_service.dart';

class PackingService {
  PackingService({KitchenApiClient? apiClient})
      : _api = apiClient ?? ApiProvider.createClient();

  final KitchenApiClient _api;

  factory PackingService.fromAuth(AuthService authService) {
    return PackingService(apiClient: authService.apiClient);
  }

  Future<PackingDeliverySnapshot> fetchBoard({String section = 'All'}) async {
    final response = await _api.get(
      PackingEndpoints.board,
      query: {'section': section},
    );

    return PackingDeliverySnapshot.fromJson(
      response['data'] as Map<String, dynamic>,
    );
  }

  Future<PackingActionResult> performAction({
    required String jobId,
    required String action,
  }) async {
    final response = await _api.post(
      PackingEndpoints.jobAction(jobId),
      body: {'action': action},
    );
    return PackingActionResult.fromJson(response);
  }

  Future<PackingActionResult> printLabels({String? jobId}) async {
    final response = await _api.post(
      PackingEndpoints.printLabels,
      body: {'jobId': ?jobId},
    );
    return PackingActionResult.fromJson(response);
  }
}
