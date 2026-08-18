import '../core/api/api_provider.dart';
import '../core/api/course_firing_endpoints.dart';
import '../core/api/kitchen_api_client.dart';
import '../models/firing/course_firing_snapshot.dart';
import '../services/auth_service.dart';

class CourseFiringService {
  CourseFiringService({KitchenApiClient? apiClient})
      : _api = apiClient ?? ApiProvider.createClient();

  final KitchenApiClient _api;

  factory CourseFiringService.fromAuth(AuthService authService) {
    return CourseFiringService(apiClient: authService.apiClient);
  }

  Future<CourseFiringSnapshot> fetchSessions({String section = 'All'}) async {
    final response = await _api.get(
      CourseFiringEndpoints.sessions,
      query: {'section': section},
    );

    return CourseFiringSnapshot.fromJson(
      response['data'] as Map<String, dynamic>,
    );
  }

  Future<FiringActionResult> syncPacing() async {
    final response = await _api.post(CourseFiringEndpoints.syncPacing);
    return FiringActionResult.fromJson(response);
  }

  Future<void> performAction({
    required String sessionId,
    required String action,
    String? courseType,
  }) async {
    await _api.post(
      CourseFiringEndpoints.sessionAction(sessionId),
      body: {
        'action': action,
        'courseType': ?courseType,
      },
    );
  }
}
