import '../core/api/api_provider.dart';
import '../core/api/expeditor_endpoints.dart';
import '../core/api/kitchen_api_client.dart';
import '../models/expeditor/expeditor_snapshot.dart';
import '../services/auth_service.dart';

class ExpeditorService {
  ExpeditorService({KitchenApiClient? apiClient})
      : _api = apiClient ?? ApiProvider.createClient();

  final KitchenApiClient _api;

  factory ExpeditorService.fromAuth(AuthService authService) {
    return ExpeditorService(apiClient: authService.apiClient);
  }

  Future<ExpeditorSnapshot> fetchBoard({String section = 'All'}) async {
    final response = await _api.get(
      ExpeditorEndpoints.board,
      query: {'section': section},
    );

    return ExpeditorSnapshot.fromJson(
      response['data'] as Map<String, dynamic>,
    );
  }

  Future<ExpeditorActionResult> performTicketAction({
    required String ticketId,
    required String action,
  }) async {
    final response = await _api.post(
      ExpeditorEndpoints.ticketAction(ticketId),
      body: {'action': action},
    );
    return ExpeditorActionResult.fromJson(response);
  }

  Future<ExpeditorActionResult> coordinateSections({String? groupId}) async {
    final response = await _api.post(
      ExpeditorEndpoints.coordinate,
      body: {'groupId': ?groupId},
    );
    return ExpeditorActionResult.fromJson(response);
  }

  Future<ExpeditorActionResult> syncTables({String? tableNumber}) async {
    final response = await _api.post(
      ExpeditorEndpoints.syncTables,
      body: {'tableNumber': ?tableNumber},
    );
    return ExpeditorActionResult.fromJson(response);
  }
}
