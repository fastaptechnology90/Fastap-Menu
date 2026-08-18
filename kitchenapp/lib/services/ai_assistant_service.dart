import '../core/api/ai_assistant_endpoints.dart';
import '../core/api/api_provider.dart';
import '../core/api/kitchen_api_client.dart';
import '../models/ai/ai_assistant_snapshot.dart';
import '../services/auth_service.dart';

class AiAssistantService {
  AiAssistantService({KitchenApiClient? apiClient})
      : _api = apiClient ?? ApiProvider.createClient();

  final KitchenApiClient _api;

  factory AiAssistantService.fromAuth(AuthService authService) {
    return AiAssistantService(apiClient: authService.apiClient);
  }

  Future<AiAssistantSnapshot> fetchAssistant({String section = 'All'}) async {
    final response = await _api.get(
      AiAssistantEndpoints.assistant,
      query: {'section': section},
    );

    return AiAssistantSnapshot.fromJson(
      response['data'] as Map<String, dynamic>,
    );
  }

  Future<AiActionResult> applySuggestion(String suggestionId) async {
    final response = await _api.post(
      AiAssistantEndpoints.apply,
      body: {'suggestionId': suggestionId},
    );
    return AiActionResult.fromJson(response);
  }

  Future<AiActionResult> executeVoiceCommand({
    required String command,
    String? orderId,
  }) async {
    final response = await _api.post(
      AiAssistantEndpoints.voice,
      body: {
        'command': command,
        'orderId': ?orderId,
      },
    );
    return AiActionResult.fromJson(response);
  }
}
