import '../core/api/api_provider.dart';
import '../core/api/equipment_endpoints.dart';
import '../core/api/kitchen_api_client.dart';
import '../models/equipment/equipment_snapshot.dart';
import '../services/auth_service.dart';

class EquipmentService {
  EquipmentService({KitchenApiClient? apiClient})
      : _api = apiClient ?? ApiProvider.createClient();

  final KitchenApiClient _api;

  factory EquipmentService.fromAuth(AuthService authService) {
    return EquipmentService(apiClient: authService.apiClient);
  }

  Future<EquipmentSnapshot> fetchBoard({String section = 'All'}) async {
    final response = await _api.get(
      EquipmentEndpoints.board,
      query: {'section': section},
    );

    return EquipmentSnapshot.fromJson(
      response['data'] as Map<String, dynamic>,
    );
  }

  Future<EquipmentActionResult> performAction({
    required String assetId,
    required String action,
    String? issueSummary,
  }) async {
    final response = await _api.post(
      EquipmentEndpoints.assetAction(assetId),
      body: {
        'action': action,
        'issueSummary': ?issueSummary,
      },
    );
    return EquipmentActionResult.fromJson(response);
  }

  Future<EquipmentActionResult> raiseMaintenance({
    String? assetId,
    String? issueSummary,
  }) async {
    final response = await _api.post(
      EquipmentEndpoints.raiseMaintenance,
      body: {
        'assetId': ?assetId,
        'issueSummary': ?issueSummary,
      },
    );
    return EquipmentActionResult.fromJson(response);
  }
}
