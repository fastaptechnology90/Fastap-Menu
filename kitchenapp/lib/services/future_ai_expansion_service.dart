import '../core/api/api_provider.dart';
import '../core/api/future_ai_expansion_endpoints.dart';
import '../core/api/kitchen_api_client.dart';
import '../models/future_ai_expansion/future_ai_expansion_snapshot.dart';
import '../services/auth_service.dart';

class FutureAiExpansionService {
  FutureAiExpansionService({KitchenApiClient? apiClient})
      : _api = apiClient ?? ApiProvider.createClient();

  final KitchenApiClient _api;

  factory FutureAiExpansionService.fromAuth(AuthService authService) {
    return FutureAiExpansionService(apiClient: authService.apiClient);
  }

  Future<FutureAiExpansionSnapshot> fetchBoard({String section = 'All'}) async {
    final response = await _api.get(
      FutureAiExpansionEndpoints.board,
      query: {'section': section},
    );

    return FutureAiExpansionSnapshot.fromJson(
      response['data'] as Map<String, dynamic>,
    );
  }

  Future<FutureAiExpansionActionResult> performCookingAssistantAction({
    required String entryId,
    required String action,
  }) async {
    final response = await _api.post(
      FutureAiExpansionEndpoints.cookingAssistantAction(entryId),
      body: {'action': action},
    );
    return FutureAiExpansionActionResult.fromJson(response);
  }

  Future<FutureAiExpansionActionResult> performRoboticKitchenAction({
    required String entryId,
    required String action,
  }) async {
    final response = await _api.post(
      FutureAiExpansionEndpoints.roboticKitchenAction(entryId),
      body: {'action': action},
    );
    return FutureAiExpansionActionResult.fromJson(response);
  }

  Future<FutureAiExpansionActionResult> performPlatingSuggestionAction({
    required String entryId,
    required String action,
  }) async {
    final response = await _api.post(
      FutureAiExpansionEndpoints.platingSuggestionAction(entryId),
      body: {'action': action},
    );
    return FutureAiExpansionActionResult.fromJson(response);
  }

  Future<FutureAiExpansionActionResult> performWasteReductionAction({
    required String entryId,
    required String action,
  }) async {
    final response = await _api.post(
      FutureAiExpansionEndpoints.wasteReductionAction(entryId),
      body: {'action': action},
    );
    return FutureAiExpansionActionResult.fromJson(response);
  }

  Future<FutureAiExpansionActionResult> performPrepAutomationAction({
    required String entryId,
    required String action,
  }) async {
    final response = await _api.post(
      FutureAiExpansionEndpoints.prepAutomationAction(entryId),
      body: {'action': action},
    );
    return FutureAiExpansionActionResult.fromJson(response);
  }

  Future<FutureAiExpansionActionResult> activateAll() async {
    final response = await _api.post(FutureAiExpansionEndpoints.activateAll);
    return FutureAiExpansionActionResult.fromJson(response);
  }
}
