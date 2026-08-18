import '../core/api/api_provider.dart';
import '../core/api/kitchen_api_client.dart';
import '../core/api/prep_station_endpoints.dart';
import '../models/prep_stations/prep_station_snapshot.dart';
import '../services/auth_service.dart';

class PrepStationService {
  PrepStationService({KitchenApiClient? apiClient})
      : _api = apiClient ?? ApiProvider.createClient();

  final KitchenApiClient _api;

  factory PrepStationService.fromAuth(AuthService authService) {
    return PrepStationService(apiClient: authService.apiClient);
  }

  Future<PrepStationSnapshot> fetchBoard({String section = 'All'}) async {
    final response = await _api.get(
      PrepStationEndpoints.board,
      query: {'section': section},
    );

    return PrepStationSnapshot.fromJson(
      response['data'] as Map<String, dynamic>,
    );
  }

  Future<PrepStationActionResult> balanceQueues() async {
    final response = await _api.post(PrepStationEndpoints.balance);
    return PrepStationActionResult.fromJson(response);
  }

  Future<PrepStationActionResult> assignStaff({
    required String stationId,
    required String staffName,
  }) async {
    final response = await _api.post(
      PrepStationEndpoints.assign(stationId),
      body: {'staffName': staffName},
    );
    return PrepStationActionResult.fromJson(response);
  }

  Future<PrepStationActionResult> performAction({
    required String stationId,
    required String action,
  }) async {
    final response = await _api.post(
      PrepStationEndpoints.action(stationId),
      body: {'action': action},
    );
    return PrepStationActionResult.fromJson(response);
  }
}
