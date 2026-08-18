import '../core/api/api_provider.dart';
import '../core/api/kitchen_api_client.dart';
import '../core/api/staff_wellness_endpoints.dart';
import '../models/staff_wellness/staff_wellness_snapshot.dart';
import '../services/auth_service.dart';

class StaffWellnessService {
  StaffWellnessService({KitchenApiClient? apiClient})
      : _api = apiClient ?? ApiProvider.createClient();

  final KitchenApiClient _api;

  factory StaffWellnessService.fromAuth(AuthService authService) {
    return StaffWellnessService(apiClient: authService.apiClient);
  }

  Future<StaffWellnessSnapshot> fetchBoard({String section = 'All'}) async {
    final response = await _api.get(
      StaffWellnessEndpoints.board,
      query: {'section': section},
    );

    return StaffWellnessSnapshot.fromJson(
      response['data'] as Map<String, dynamic>,
    );
  }

  Future<StaffWellnessActionResult> performAlertAction({
    required String alertId,
    required String action,
  }) async {
    final response = await _api.post(
      StaffWellnessEndpoints.alertAction(alertId),
      body: {'action': action},
    );
    return StaffWellnessActionResult.fromJson(response);
  }

  Future<StaffWellnessActionResult> performRecommendationAction({
    required String recommendationId,
    required String action,
  }) async {
    final response = await _api.post(
      StaffWellnessEndpoints.recommendationAction(recommendationId),
      body: {'action': action},
    );
    return StaffWellnessActionResult.fromJson(response);
  }

  Future<StaffWellnessActionResult> runScan() async {
    final response = await _api.post(StaffWellnessEndpoints.runScan);
    return StaffWellnessActionResult.fromJson(response);
  }
}
