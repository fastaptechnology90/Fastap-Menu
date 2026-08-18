import '../core/api/api_provider.dart';
import '../core/api/kds_endpoints.dart';
import '../core/api/kitchen_api_client.dart';
import '../models/kds/kds_snapshot.dart';
import '../models/kds/kds_view_mode.dart';
import '../services/auth_service.dart';

class KdsService {
  KdsService({KitchenApiClient? apiClient})
      : _api = apiClient ?? ApiProvider.createClient();

  final KitchenApiClient _api;

  factory KdsService.fromAuth(AuthService authService) {
    return KdsService(apiClient: authService.apiClient);
  }

  Future<KdsSnapshot> fetchKds({
    required String section,
    required KdsViewMode view,
    required KdsFilter filter,
  }) async {
    final response = await _api.get(
      KdsEndpoints.kds,
      query: {
        'section': section,
        'view': view.name,
        'filter': filter.name,
      },
    );

    return KdsSnapshot.fromJson(response['data'] as Map<String, dynamic>);
  }

  Future<void> performAction({
    required String orderId,
    required String action,
  }) async {
    await _api.post(
      KdsEndpoints.orderAction(orderId),
      body: {'action': action},
    );
  }

  Future<void> reorder(List<String> orderIds) async {
    await _api.post(
      KdsEndpoints.reorder,
      body: {'orderIds': orderIds},
    );
  }
}
