import '../core/api/api_provider.dart';
import '../core/api/bakery_dessert_endpoints.dart';
import '../core/api/kitchen_api_client.dart';
import '../models/bakery/bakery_dessert_snapshot.dart';
import '../services/auth_service.dart';

class BakeryDessertService {
  BakeryDessertService({KitchenApiClient? apiClient})
      : _api = apiClient ?? ApiProvider.createClient();

  final KitchenApiClient _api;

  factory BakeryDessertService.fromAuth(AuthService authService) {
    return BakeryDessertService(apiClient: authService.apiClient);
  }

  Future<BakeryDessertSnapshot> fetchBoard({String section = 'All'}) async {
    final response = await _api.get(
      BakeryDessertEndpoints.board,
      query: {'section': section},
    );

    return BakeryDessertSnapshot.fromJson(
      response['data'] as Map<String, dynamic>,
    );
  }

  Future<BakeryDessertActionResult> performAction({
    required String jobId,
    required String action,
    String? customization,
  }) async {
    final response = await _api.post(
      BakeryDessertEndpoints.jobAction(jobId),
      body: {
        'action': action,
        'customization': ?customization,
      },
    );
    return BakeryDessertActionResult.fromJson(response);
  }

  Future<BakeryDessertActionResult> startProduction({String? itemName}) async {
    final response = await _api.post(
      BakeryDessertEndpoints.startProduction,
      body: {'itemName': ?itemName},
    );
    return BakeryDessertActionResult.fromJson(response);
  }
}
