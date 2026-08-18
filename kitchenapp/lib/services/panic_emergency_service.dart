import '../core/api/api_provider.dart';
import '../core/api/kitchen_api_client.dart';
import '../core/api/panic_emergency_endpoints.dart';
import '../models/panic_emergency/panic_emergency_snapshot.dart';
import '../services/auth_service.dart';

class PanicEmergencyService {
  PanicEmergencyService({KitchenApiClient? apiClient})
      : _api = apiClient ?? ApiProvider.createClient();

  final KitchenApiClient _api;

  factory PanicEmergencyService.fromAuth(AuthService authService) {
    return PanicEmergencyService(apiClient: authService.apiClient);
  }

  Future<PanicEmergencySnapshot> fetchBoard({String section = 'All'}) async {
    final response = await _api.get(
      PanicEmergencyEndpoints.board,
      query: {'section': section},
    );

    return PanicEmergencySnapshot.fromJson(
      response['data'] as Map<String, dynamic>,
    );
  }

  Future<PanicEmergencyActionResult> triggerPanic({
    String? emergencyType,
    String? section,
  }) async {
    final response = await _api.post(
      PanicEmergencyEndpoints.triggerPanic,
      body: {
        'emergencyType': ?emergencyType,
        'section': ?section,
      },
    );
    return PanicEmergencyActionResult.fromJson(response);
  }

  Future<PanicEmergencyActionResult> performIncidentAction({
    required String incidentId,
    required String action,
  }) async {
    final response = await _api.post(
      PanicEmergencyEndpoints.incidentAction(incidentId),
      body: {'action': action},
    );
    return PanicEmergencyActionResult.fromJson(response);
  }

  Future<PanicEmergencyActionResult> performEvacuationAction({
    required String evacuationId,
    required String action,
  }) async {
    final response = await _api.post(
      PanicEmergencyEndpoints.evacuationAction(evacuationId),
      body: {'action': action},
    );
    return PanicEmergencyActionResult.fromJson(response);
  }

  Future<PanicEmergencyActionResult> syncAll() async {
    final response = await _api.post(PanicEmergencyEndpoints.syncAll);
    return PanicEmergencyActionResult.fromJson(response);
  }
}
