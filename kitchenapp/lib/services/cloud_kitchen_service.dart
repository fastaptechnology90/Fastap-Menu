import '../core/api/api_provider.dart';
import '../core/api/cloud_kitchen_endpoints.dart';
import '../core/api/kitchen_api_client.dart';
import '../models/cloud_kitchen/cloud_kitchen_snapshot.dart';
import '../services/auth_service.dart';

class CloudKitchenService {
  CloudKitchenService({KitchenApiClient? apiClient})
      : _api = apiClient ?? ApiProvider.createClient();

  final KitchenApiClient _api;

  factory CloudKitchenService.fromAuth(AuthService authService) {
    return CloudKitchenService(apiClient: authService.apiClient);
  }

  Future<CloudKitchenSnapshot> fetchBoard({String section = 'All'}) async {
    final response = await _api.get(
      CloudKitchenEndpoints.board,
      query: {'section': section},
    );

    return CloudKitchenSnapshot.fromJson(
      response['data'] as Map<String, dynamic>,
    );
  }

  Future<CloudKitchenActionResult> performAction({
    required String orderId,
    required String action,
    String? brandId,
  }) async {
    final response = await _api.post(
      CloudKitchenEndpoints.orderAction(orderId),
      body: {
        'action': action,
        'brandId': ?brandId,
      },
    );
    return CloudKitchenActionResult.fromJson(response);
  }

  Future<CloudKitchenActionResult> balanceLoad() async {
    final response = await _api.post(CloudKitchenEndpoints.balanceLoad);
    return CloudKitchenActionResult.fromJson(response);
  }
}
