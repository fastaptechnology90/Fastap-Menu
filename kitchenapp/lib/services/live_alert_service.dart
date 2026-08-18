import '../core/api/api_provider.dart';
import '../core/api/kitchen_api_client.dart';
import '../core/api/live_alert_endpoints.dart';
import '../models/live_alerts/live_alert_snapshot.dart';
import '../services/auth_service.dart';

class LiveAlertService {
  LiveAlertService({KitchenApiClient? apiClient})
      : _api = apiClient ?? ApiProvider.createClient();

  final KitchenApiClient _api;

  factory LiveAlertService.fromAuth(AuthService authService) {
    return LiveAlertService(apiClient: authService.apiClient);
  }

  Future<LiveAlertSnapshot> fetchBoard({String section = 'All'}) async {
    final response = await _api.get(
      LiveAlertEndpoints.board,
      query: {'section': section},
    );

    return LiveAlertSnapshot.fromJson(
      response['data'] as Map<String, dynamic>,
    );
  }

  Future<LiveAlertActionResult> performAction({
    required String alertId,
    required String action,
  }) async {
    final response = await _api.post(
      LiveAlertEndpoints.alertAction(alertId),
      body: {'action': action},
    );
    return LiveAlertActionResult.fromJson(response);
  }

  Future<LiveAlertActionResult> syncAll() async {
    final response = await _api.post(LiveAlertEndpoints.syncAll);
    return LiveAlertActionResult.fromJson(response);
  }
}
