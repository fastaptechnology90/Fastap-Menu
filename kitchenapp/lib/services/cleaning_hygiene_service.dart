import '../core/api/api_provider.dart';
import '../core/api/cleaning_hygiene_endpoints.dart';
import '../core/api/kitchen_api_client.dart';
import '../models/hygiene/cleaning_hygiene_snapshot.dart';
import '../services/auth_service.dart';

class CleaningHygieneService {
  CleaningHygieneService({KitchenApiClient? apiClient})
      : _api = apiClient ?? ApiProvider.createClient();

  final KitchenApiClient _api;

  factory CleaningHygieneService.fromAuth(AuthService authService) {
    return CleaningHygieneService(apiClient: authService.apiClient);
  }

  Future<CleaningHygieneSnapshot> fetchBoard({String section = 'All'}) async {
    final response = await _api.get(
      CleaningHygieneEndpoints.board,
      query: {'section': section},
    );

    return CleaningHygieneSnapshot.fromJson(
      response['data'] as Map<String, dynamic>,
    );
  }

  Future<CleaningHygieneActionResult> performAction({
    required String taskId,
    required String action,
    String? staffName,
  }) async {
    final response = await _api.post(
      CleaningHygieneEndpoints.taskAction(taskId),
      body: {
        'action': action,
        'staffName': ?staffName,
      },
    );
    return CleaningHygieneActionResult.fromJson(response);
  }

  Future<CleaningHygieneActionResult> startAudit({String? auditType}) async {
    final response = await _api.post(
      CleaningHygieneEndpoints.startAudit,
      body: {'auditType': ?auditType},
    );
    return CleaningHygieneActionResult.fromJson(response);
  }
}
