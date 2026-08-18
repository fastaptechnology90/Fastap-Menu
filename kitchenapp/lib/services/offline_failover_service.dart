import '../core/api/api_provider.dart';
import '../core/api/kitchen_api_client.dart';
import '../core/api/offline_failover_endpoints.dart';
import '../models/offline_failover/offline_failover_snapshot.dart';
import '../services/auth_service.dart';

class OfflineFailoverService {
  OfflineFailoverService({KitchenApiClient? apiClient})
      : _api = apiClient ?? ApiProvider.createClient();

  final KitchenApiClient _api;

  factory OfflineFailoverService.fromAuth(AuthService authService) {
    return OfflineFailoverService(apiClient: authService.apiClient);
  }

  Future<OfflineFailoverSnapshot> fetchBoard({String section = 'All'}) async {
    final response = await _api.get(
      OfflineFailoverEndpoints.board,
      query: {'section': section},
    );

    return OfflineFailoverSnapshot.fromJson(
      response['data'] as Map<String, dynamic>,
    );
  }

  Future<OfflineFailoverActionResult> performModuleAction({
    required String moduleId,
    required String action,
  }) async {
    final response = await _api.post(
      OfflineFailoverEndpoints.moduleAction(moduleId),
      body: {'action': action},
    );
    return OfflineFailoverActionResult.fromJson(response);
  }

  Future<OfflineFailoverActionResult> performQueueAction({
    required String queueId,
    required String action,
  }) async {
    final response = await _api.post(
      OfflineFailoverEndpoints.queueAction(queueId),
      body: {'action': action},
    );
    return OfflineFailoverActionResult.fromJson(response);
  }

  Future<OfflineFailoverActionResult> performRecoveryAction({
    required String recoveryId,
    required String action,
  }) async {
    final response = await _api.post(
      OfflineFailoverEndpoints.recoveryAction(recoveryId),
      body: {'action': action},
    );
    return OfflineFailoverActionResult.fromJson(response);
  }

  Future<OfflineFailoverActionResult> restoreSync() async {
    final response = await _api.post(OfflineFailoverEndpoints.restoreSync);
    return OfflineFailoverActionResult.fromJson(response);
  }

  Future<OfflineFailoverActionResult> syncAll() async {
    final response = await _api.post(OfflineFailoverEndpoints.syncAll);
    return OfflineFailoverActionResult.fromJson(response);
  }
}
