import '../core/api/api_provider.dart';
import '../core/api/kitchen_api_client.dart';
import '../core/api/kitchen_heatmap_endpoints.dart';
import '../models/kitchen_heatmap/kitchen_heatmap_snapshot.dart';
import '../services/auth_service.dart';

class KitchenHeatmapService {
  KitchenHeatmapService({KitchenApiClient? apiClient})
      : _api = apiClient ?? ApiProvider.createClient();

  final KitchenApiClient _api;

  factory KitchenHeatmapService.fromAuth(AuthService authService) {
    return KitchenHeatmapService(apiClient: authService.apiClient);
  }

  Future<KitchenHeatmapSnapshot> fetchBoard({String section = 'All'}) async {
    final response = await _api.get(
      KitchenHeatmapEndpoints.board,
      query: {'section': section},
    );

    return KitchenHeatmapSnapshot.fromJson(
      response['data'] as Map<String, dynamic>,
    );
  }

  Future<KitchenHeatmapActionResult> performStationAction({
    required String stationId,
    required String action,
  }) async {
    final response = await _api.post(
      KitchenHeatmapEndpoints.stationAction(stationId),
      body: {'action': action},
    );
    return KitchenHeatmapActionResult.fromJson(response);
  }

  Future<KitchenHeatmapActionResult> performHotspotAction({
    required String hotspotId,
    required String action,
  }) async {
    final response = await _api.post(
      KitchenHeatmapEndpoints.hotspotAction(hotspotId),
      body: {'action': action},
    );
    return KitchenHeatmapActionResult.fromJson(response);
  }

  Future<KitchenHeatmapActionResult> performDensityAction({
    required String densityId,
    required String action,
  }) async {
    final response = await _api.post(
      KitchenHeatmapEndpoints.densityAction(densityId),
      body: {'action': action},
    );
    return KitchenHeatmapActionResult.fromJson(response);
  }

  Future<KitchenHeatmapActionResult> performRushAction({
    required String rushId,
    required String action,
  }) async {
    final response = await _api.post(
      KitchenHeatmapEndpoints.rushAction(rushId),
      body: {'action': action},
    );
    return KitchenHeatmapActionResult.fromJson(response);
  }

  Future<KitchenHeatmapActionResult> refreshAll() async {
    final response = await _api.post(KitchenHeatmapEndpoints.refreshAll);
    return KitchenHeatmapActionResult.fromJson(response);
  }
}
