import '../core/api/allergy_safety_endpoints.dart';
import '../core/api/api_provider.dart';
import '../core/api/kitchen_api_client.dart';
import '../models/safety/allergy_safety_snapshot.dart';
import '../services/auth_service.dart';

class AllergySafetyService {
  AllergySafetyService({KitchenApiClient? apiClient})
      : _api = apiClient ?? ApiProvider.createClient();

  final KitchenApiClient _api;

  factory AllergySafetyService.fromAuth(AuthService authService) {
    return AllergySafetyService(apiClient: authService.apiClient);
  }

  Future<AllergySafetySnapshot> fetchBoard({String section = 'All'}) async {
    final response = await _api.get(
      AllergySafetyEndpoints.board,
      query: {'section': section},
    );

    return AllergySafetySnapshot.fromJson(
      response['data'] as Map<String, dynamic>,
    );
  }

  Future<void> performAction({
    required String caseId,
    required String action,
  }) async {
    await _api.post(
      AllergySafetyEndpoints.caseAction(caseId),
      body: {'action': action},
    );
  }
}
