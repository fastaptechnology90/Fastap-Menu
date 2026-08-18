import '../core/api/api_provider.dart';
import '../core/api/kitchen_api_client.dart';
import '../core/api/recipe_costing_endpoints.dart';
import '../models/recipes/recipe_costing_snapshot.dart';
import '../services/auth_service.dart';

class RecipeCostingService {
  RecipeCostingService({KitchenApiClient? apiClient})
      : _api = apiClient ?? ApiProvider.createClient();

  final KitchenApiClient _api;

  factory RecipeCostingService.fromAuth(AuthService authService) {
    return RecipeCostingService(apiClient: authService.apiClient);
  }

  Future<RecipeCostingSnapshot> fetchBoard({String section = 'All'}) async {
    final response = await _api.get(
      RecipeCostingEndpoints.board,
      query: {'section': section},
    );

    return RecipeCostingSnapshot.fromJson(
      response['data'] as Map<String, dynamic>,
    );
  }

  Future<RecipeCostingActionResult> refreshCosting() async {
    final response = await _api.post(RecipeCostingEndpoints.refresh);
    return RecipeCostingActionResult.fromJson(response);
  }

  Future<RecipeCostingActionResult> recordWaste({
    required String recipeId,
    required double plates,
    String reason = 'Kitchen waste',
  }) async {
    final response = await _api.post(
      RecipeCostingEndpoints.waste,
      body: {
        'recipeId': recipeId,
        'plates': plates,
        'reason': reason,
      },
    );
    return RecipeCostingActionResult.fromJson(response);
  }

  Future<RecipeCostingActionResult> adjustPortion({
    required String recipeId,
    required String portion,
  }) async {
    final response = await _api.post(
      RecipeCostingEndpoints.recipe(recipeId),
      body: {'portion': portion},
    );
    return RecipeCostingActionResult.fromJson(response);
  }
}
