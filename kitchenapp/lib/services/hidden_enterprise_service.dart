import '../core/api/api_provider.dart';
import '../core/api/hidden_enterprise_endpoints.dart';
import '../core/api/kitchen_api_client.dart';
import '../models/hidden_enterprise/hidden_enterprise_snapshot.dart';
import '../services/auth_service.dart';

class HiddenEnterpriseService {
  HiddenEnterpriseService({KitchenApiClient? apiClient})
      : _api = apiClient ?? ApiProvider.createClient();

  final KitchenApiClient _api;

  factory HiddenEnterpriseService.fromAuth(AuthService authService) {
    return HiddenEnterpriseService(apiClient: authService.apiClient);
  }

  Future<HiddenEnterpriseSnapshot> fetchBoard({String section = 'All'}) async {
    final response = await _api.get(
      HiddenEnterpriseEndpoints.board,
      query: {'section': section},
    );

    return HiddenEnterpriseSnapshot.fromJson(
      response['data'] as Map<String, dynamic>,
    );
  }

  Future<HiddenEnterpriseActionResult> performSoftDeleteAction({
    required String itemId,
    required String action,
  }) async {
    final response = await _api.post(
      HiddenEnterpriseEndpoints.softDeleteAction(itemId),
      body: {'action': action},
    );
    return HiddenEnterpriseActionResult.fromJson(response);
  }

  Future<HiddenEnterpriseActionResult> performDeletedOrderAction({
    required String orderId,
    required String action,
  }) async {
    final response = await _api.post(
      HiddenEnterpriseEndpoints.deletedOrderAction(orderId),
      body: {'action': action},
    );
    return HiddenEnterpriseActionResult.fromJson(response);
  }

  Future<HiddenEnterpriseActionResult> performActionReplayAction({
    required String replayId,
    required String action,
  }) async {
    final response = await _api.post(
      HiddenEnterpriseEndpoints.actionReplayAction(replayId),
      body: {'action': action},
    );
    return HiddenEnterpriseActionResult.fromJson(response);
  }

  Future<HiddenEnterpriseActionResult> performVersionLogAction({
    required String versionId,
    required String action,
  }) async {
    final response = await _api.post(
      HiddenEnterpriseEndpoints.versionLogAction(versionId),
      body: {'action': action},
    );
    return HiddenEnterpriseActionResult.fromJson(response);
  }

  Future<HiddenEnterpriseActionResult> performDeviceTrackingAction({
    required String deviceId,
    required String action,
  }) async {
    final response = await _api.post(
      HiddenEnterpriseEndpoints.deviceTrackingAction(deviceId),
      body: {'action': action},
    );
    return HiddenEnterpriseActionResult.fromJson(response);
  }

  Future<HiddenEnterpriseActionResult> performSessionLogAction({
    required String sessionId,
    required String action,
  }) async {
    final response = await _api.post(
      HiddenEnterpriseEndpoints.sessionLogAction(sessionId),
      body: {'action': action},
    );
    return HiddenEnterpriseActionResult.fromJson(response);
  }

  Future<HiddenEnterpriseActionResult> performLockdownAction({
    required String lockdownId,
    required String action,
  }) async {
    final response = await _api.post(
      HiddenEnterpriseEndpoints.lockdownAction(lockdownId),
      body: {'action': action},
    );
    return HiddenEnterpriseActionResult.fromJson(response);
  }

  Future<HiddenEnterpriseActionResult> performQueueRecoveryAction({
    required String queueId,
    required String action,
  }) async {
    final response = await _api.post(
      HiddenEnterpriseEndpoints.queueRecoveryAction(queueId),
      body: {'action': action},
    );
    return HiddenEnterpriseActionResult.fromJson(response);
  }

  Future<HiddenEnterpriseActionResult> activateAll() async {
    final response = await _api.post(HiddenEnterpriseEndpoints.activateAll);
    return HiddenEnterpriseActionResult.fromJson(response);
  }
}
