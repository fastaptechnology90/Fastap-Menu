import '../core/api/api_provider.dart';
import '../core/api/inventory_endpoints.dart';
import '../core/api/kitchen_api_client.dart';
import '../models/inventory/inventory_snapshot.dart';
import '../services/auth_service.dart';

class InventoryService {
  InventoryService({KitchenApiClient? apiClient})
      : _api = apiClient ?? ApiProvider.createClient();

  final KitchenApiClient _api;

  factory InventoryService.fromAuth(AuthService authService) {
    return InventoryService(apiClient: authService.apiClient);
  }

  Future<InventorySnapshot> fetchBoard({String section = 'All'}) async {
    final response = await _api.get(
      InventoryEndpoints.board,
      query: {'section': section},
    );

    return InventorySnapshot.fromJson(
      response['data'] as Map<String, dynamic>,
    );
  }

  Future<InventoryActionResult> syncStock() async {
    final response = await _api.post(InventoryEndpoints.sync);
    return InventoryActionResult.fromJson(response);
  }

  Future<InventoryActionResult> deductIngredient({
    required String itemId,
    required double quantity,
    String? orderId,
  }) async {
    final response = await _api.post(
      InventoryEndpoints.deduct,
      body: {
        'itemId': itemId,
        'quantity': quantity,
        'orderId': ?orderId,
      },
    );
    return InventoryActionResult.fromJson(response);
  }

  Future<InventoryActionResult> validateRecipeStock({String? orderId}) async {
    final response = await _api.post(
      InventoryEndpoints.validate,
      body: {'orderId': ?orderId},
    );
    return InventoryActionResult.fromJson(response);
  }

  Future<InventoryActionResult> applySubstitution({
    required String itemId,
    required String substituteId,
  }) async {
    final response = await _api.post(
      InventoryEndpoints.substitute,
      body: {
        'itemId': itemId,
        'substituteId': substituteId,
      },
    );
    return InventoryActionResult.fromJson(response);
  }

  Future<InventoryActionResult> performAlertAction({
    required String alertId,
    required String action,
  }) async {
    final response = await _api.post(
      InventoryEndpoints.alertAction,
      body: {
        'alertId': alertId,
        'action': action,
      },
    );
    return InventoryActionResult.fromJson(response);
  }
}
