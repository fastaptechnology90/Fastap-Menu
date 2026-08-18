import '../core/api/api_provider.dart';
import '../core/api/bar_beverage_endpoints.dart';
import '../core/api/kitchen_api_client.dart';
import '../models/bar/bar_beverage_snapshot.dart';
import '../services/auth_service.dart';

class BarBeverageService {
  BarBeverageService({KitchenApiClient? apiClient})
      : _api = apiClient ?? ApiProvider.createClient();

  final KitchenApiClient _api;

  factory BarBeverageService.fromAuth(AuthService authService) {
    return BarBeverageService(apiClient: authService.apiClient);
  }

  Future<BarBeverageSnapshot> fetchBoard({String section = 'All'}) async {
    final response = await _api.get(
      BarBeverageEndpoints.board,
      query: {'section': section},
    );

    return BarBeverageSnapshot.fromJson(
      response['data'] as Map<String, dynamic>,
    );
  }

  Future<BarBeverageActionResult> performAction({
    required String drinkId,
    required String action,
    String? bartenderName,
    String? customization,
  }) async {
    final response = await _api.post(
      BarBeverageEndpoints.drinkAction(drinkId),
      body: {
        'action': action,
        'bartenderName': ?bartenderName,
        'customization': ?customization,
      },
    );
    return BarBeverageActionResult.fromJson(response);
  }

  Future<BarBeverageActionResult> balanceQueue() async {
    final response = await _api.post(BarBeverageEndpoints.balanceQueue);
    return BarBeverageActionResult.fromJson(response);
  }
}
