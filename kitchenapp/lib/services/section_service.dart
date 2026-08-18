import '../core/api/api_provider.dart';
import '../core/api/kitchen_api_client.dart';
import '../core/api/section_endpoints.dart';
import '../models/sections/section_overview_snapshot.dart';
import '../models/sections/section_routing.dart';
import '../services/auth_service.dart';

class SectionService {
  SectionService({KitchenApiClient? apiClient})
      : _api = apiClient ?? ApiProvider.createClient();

  final KitchenApiClient _api;

  factory SectionService.fromAuth(AuthService authService) {
    return SectionService(apiClient: authService.apiClient);
  }

  Future<SectionManagementSnapshot> fetchManagement({
    String section = 'All',
  }) async {
    final response = await _api.get(
      SectionEndpoints.overview,
      query: {'section': section, 'includeRouting': 'true'},
    );

    return SectionManagementSnapshot.fromJson(
      response['data'] as Map<String, dynamic>,
    );
  }

  Future<SectionOptimizeResult> optimizeQueue() async {
    final response = await _api.post(SectionEndpoints.optimize);
    return SectionOptimizeResult.fromJson(response);
  }

  Future<void> rerouteOrder({
    required String orderId,
    required String section,
  }) async {
    await _api.post(
      SectionEndpoints.reroute(orderId),
      body: {'section': section},
    );
  }

  Future<void> assignChef({
    required String sectionName,
    required String chefName,
  }) async {
    await _api.post(
      SectionEndpoints.assignChef(sectionName.toLowerCase()),
      body: {'chefName': chefName},
    );
  }
}
