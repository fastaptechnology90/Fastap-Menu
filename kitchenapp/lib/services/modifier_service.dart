import '../core/api/api_provider.dart';
import '../core/api/kitchen_api_client.dart';
import '../core/api/modifier_endpoints.dart';
import '../models/modifiers/modifier_snapshot.dart';
import '../services/auth_service.dart';

class ModifierService {
  ModifierService({KitchenApiClient? apiClient})
      : _api = apiClient ?? ApiProvider.createClient();

  final KitchenApiClient _api;

  factory ModifierService.fromAuth(AuthService authService) {
    return ModifierService(apiClient: authService.apiClient);
  }

  Future<ModifierSnapshot> fetchBoard({String section = 'All'}) async {
    final response = await _api.get(
      ModifierEndpoints.board,
      query: {'section': section},
    );

    return ModifierSnapshot.fromJson(
      response['data'] as Map<String, dynamic>,
    );
  }

  Future<void> performAction({
    required String orderId,
    required String action,
    String? modifierId,
    String? modifierType,
    String? itemName,
    String? replacement,
  }) async {
    await _api.post(
      ModifierEndpoints.orderAction(orderId),
      body: {
        'action': action,
        'modifierId': ?modifierId,
        'modifierType': ?modifierType,
        'itemName': ?itemName,
        'replacement': ?replacement,
      },
    );
  }
}
