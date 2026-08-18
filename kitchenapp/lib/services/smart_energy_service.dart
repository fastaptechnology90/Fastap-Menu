import '../core/api/api_provider.dart';
import '../core/api/kitchen_api_client.dart';
import '../core/api/smart_energy_endpoints.dart';
import '../models/energy/smart_energy_snapshot.dart';
import '../services/auth_service.dart';

class SmartEnergyService {
  SmartEnergyService({KitchenApiClient? apiClient})
      : _api = apiClient ?? ApiProvider.createClient();

  final KitchenApiClient _api;

  factory SmartEnergyService.fromAuth(AuthService authService) {
    return SmartEnergyService(apiClient: authService.apiClient);
  }

  Future<SmartEnergySnapshot> fetchBoard({String section = 'All'}) async {
    final response = await _api.get(
      SmartEnergyEndpoints.board,
      query: {'section': section},
    );

    return SmartEnergySnapshot.fromJson(
      response['data'] as Map<String, dynamic>,
    );
  }

  Future<SmartEnergyActionResult> performAction({
    required String alertId,
    required String action,
  }) async {
    final response = await _api.post(
      SmartEnergyEndpoints.alertAction(alertId),
      body: {'action': action},
    );
    return SmartEnergyActionResult.fromJson(response);
  }

  Future<SmartEnergyActionResult> triggerShutdown({
    String? equipmentName,
  }) async {
    final response = await _api.post(
      SmartEnergyEndpoints.triggerShutdown,
      body: {'equipmentName': ?equipmentName},
    );
    return SmartEnergyActionResult.fromJson(response);
  }
}
