import '../core/api/api_provider.dart';
import '../core/api/feature_endpoints.dart';
import '../core/api/kitchen_api_client.dart';
import '../core/config/api_config.dart';
import '../models/features/feature_entitlements.dart';
import 'auth_service.dart';

class FeatureEntitlementsService {
  FeatureEntitlementsService({KitchenApiClient? apiClient})
      : _api = apiClient ?? ApiProvider.createClient();

  final KitchenApiClient _api;

  factory FeatureEntitlementsService.fromAuth(AuthService authService) {
    return FeatureEntitlementsService(apiClient: authService.apiClient);
  }

  Future<FeatureEntitlementsSnapshot?> fetchEntitlements() async {
    if (ApiConfig.useMockApi) {
      return _mockEntitlements();
    }

    try {
      final response = await _api.get(FeatureEndpoints.features);
      return FeatureEntitlementsSnapshot.fromJson(response);
    } catch (_) {
      return null;
    }
  }

  FeatureEntitlementsSnapshot _mockEntitlements() {
    return FeatureEntitlementsSnapshot(
      restaurantId: 0,
      plan: 'enterprise',
      enabledSystems: [for (var i = 2; i <= 49; i++) i],
      modules: const [],
      workflowLinks: const [],
    );
  }
}
