import '../core/api/api_provider.dart';
import '../core/api/kitchen_api_client.dart';
import '../core/api/prep_endpoints.dart';
import '../models/prep/prep_snapshot.dart';
import '../services/auth_service.dart';

class PrepService {
  PrepService({KitchenApiClient? apiClient})
      : _api = apiClient ?? ApiProvider.createClient();

  final KitchenApiClient _api;

  factory PrepService.fromAuth(AuthService authService) {
    return PrepService(apiClient: authService.apiClient);
  }

  Future<PrepSnapshot> fetchBoard({String section = 'All'}) async {
    final response = await _api.get(
      PrepEndpoints.board,
      query: {'section': section},
    );

    return PrepSnapshot.fromJson(response['data'] as Map<String, dynamic>);
  }

  Future<void> performAction({
    required String taskId,
    required String action,
    int? stepIndex,
    String? ingredient,
    String? mode,
  }) async {
    await _api.post(
      PrepEndpoints.taskAction(taskId),
      body: {
        'action': action,
        'stepIndex': ?stepIndex,
        'ingredient': ?ingredient,
        'mode': ?mode,
      },
    );
  }
}
