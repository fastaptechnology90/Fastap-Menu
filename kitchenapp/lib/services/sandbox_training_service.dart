import '../core/api/api_provider.dart';
import '../core/api/kitchen_api_client.dart';
import '../core/api/sandbox_training_endpoints.dart';
import '../models/sandbox_training/sandbox_training_snapshot.dart';
import '../services/auth_service.dart';

class SandboxTrainingService {
  SandboxTrainingService({KitchenApiClient? apiClient})
      : _api = apiClient ?? ApiProvider.createClient();

  final KitchenApiClient _api;

  factory SandboxTrainingService.fromAuth(AuthService authService) {
    return SandboxTrainingService(apiClient: authService.apiClient);
  }

  Future<SandboxTrainingSnapshot> fetchBoard({String section = 'All'}) async {
    final response = await _api.get(
      SandboxTrainingEndpoints.board,
      query: {'section': section},
    );

    return SandboxTrainingSnapshot.fromJson(
      response['data'] as Map<String, dynamic>,
    );
  }

  Future<SandboxTrainingActionResult> performDemoAction({
    required String demoId,
    required String action,
  }) async {
    final response = await _api.post(
      SandboxTrainingEndpoints.demoKitchenAction(demoId),
      body: {'action': action},
    );
    return SandboxTrainingActionResult.fromJson(response);
  }

  Future<SandboxTrainingActionResult> performPracticeAction({
    required String sessionId,
    required String action,
  }) async {
    final response = await _api.post(
      SandboxTrainingEndpoints.practiceSessionAction(sessionId),
      body: {'action': action},
    );
    return SandboxTrainingActionResult.fromJson(response);
  }

  Future<SandboxTrainingActionResult> performSopAction({
    required String sopId,
    required String action,
  }) async {
    final response = await _api.post(
      SandboxTrainingEndpoints.sopTrainingAction(sopId),
      body: {'action': action},
    );
    return SandboxTrainingActionResult.fromJson(response);
  }

  Future<SandboxTrainingActionResult> performSimulationAction({
    required String simulationId,
    required String action,
  }) async {
    final response = await _api.post(
      SandboxTrainingEndpoints.simulationAction(simulationId),
      body: {'action': action},
    );
    return SandboxTrainingActionResult.fromJson(response);
  }

  Future<SandboxTrainingActionResult> launchAll() async {
    final response = await _api.post(SandboxTrainingEndpoints.launchAll);
    return SandboxTrainingActionResult.fromJson(response);
  }
}
