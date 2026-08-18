import '../core/api/api_provider.dart';
import '../core/api/kitchen_api_client.dart';
import '../core/api/multi_branch_endpoints.dart';
import '../models/multi_branch/multi_branch_snapshot.dart';
import '../services/auth_service.dart';

class MultiBranchService {
  MultiBranchService({KitchenApiClient? apiClient})
      : _api = apiClient ?? ApiProvider.createClient();

  final KitchenApiClient _api;

  factory MultiBranchService.fromAuth(AuthService authService) {
    return MultiBranchService(apiClient: authService.apiClient);
  }

  Future<MultiBranchSnapshot> fetchBoard({String section = 'All'}) async {
    final response = await _api.get(
      MultiBranchEndpoints.board,
      query: {'section': section},
    );

    return MultiBranchSnapshot.fromJson(
      response['data'] as Map<String, dynamic>,
    );
  }

  Future<MultiBranchActionResult> performCentralAction({
    required String kitchenId,
    required String action,
  }) async {
    final response = await _api.post(
      MultiBranchEndpoints.centralKitchenAction(kitchenId),
      body: {'action': action},
    );
    return MultiBranchActionResult.fromJson(response);
  }

  Future<MultiBranchActionResult> performRecipeAction({
    required String syncId,
    required String action,
  }) async {
    final response = await _api.post(
      MultiBranchEndpoints.recipeSyncAction(syncId),
      body: {'action': action},
    );
    return MultiBranchActionResult.fromJson(response);
  }

  Future<MultiBranchActionResult> performBranchAction({
    required String branchId,
    required String action,
  }) async {
    final response = await _api.post(
      MultiBranchEndpoints.branchKitchenAction(branchId),
      body: {'action': action},
    );
    return MultiBranchActionResult.fromJson(response);
  }

  Future<MultiBranchActionResult> performInventoryAction({
    required String inventoryId,
    required String action,
  }) async {
    final response = await _api.post(
      MultiBranchEndpoints.sharedInventoryAction(inventoryId),
      body: {'action': action},
    );
    return MultiBranchActionResult.fromJson(response);
  }

  Future<MultiBranchActionResult> performForecastAction({
    required String forecastId,
    required String action,
  }) async {
    final response = await _api.post(
      MultiBranchEndpoints.demandForecastAction(forecastId),
      body: {'action': action},
    );
    return MultiBranchActionResult.fromJson(response);
  }

  Future<MultiBranchActionResult> syncAll() async {
    final response = await _api.post(MultiBranchEndpoints.syncAll);
    return MultiBranchActionResult.fromJson(response);
  }
}
