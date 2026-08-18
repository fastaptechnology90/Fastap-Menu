import '../core/api/api_provider.dart';
import '../core/api/kitchen_api_client.dart';
import '../core/api/smartwatch_support_endpoints.dart';
import '../models/smartwatch_support/smartwatch_support_snapshot.dart';
import '../services/auth_service.dart';

class SmartwatchSupportService {
  SmartwatchSupportService({KitchenApiClient? apiClient})
      : _api = apiClient ?? ApiProvider.createClient();

  final KitchenApiClient _api;

  factory SmartwatchSupportService.fromAuth(AuthService authService) {
    return SmartwatchSupportService(apiClient: authService.apiClient);
  }

  Future<SmartwatchSupportSnapshot> fetchBoard({String section = 'All'}) async {
    final response = await _api.get(
      SmartwatchSupportEndpoints.board,
      query: {'section': section},
    );

    return SmartwatchSupportSnapshot.fromJson(
      response['data'] as Map<String, dynamic>,
    );
  }

  Future<SmartwatchSupportActionResult> performOrderAction({
    required String alertId,
    required String action,
  }) async {
    final response = await _api.post(
      SmartwatchSupportEndpoints.orderAlertAction(alertId),
      body: {'action': action},
    );
    return SmartwatchSupportActionResult.fromJson(response);
  }

  Future<SmartwatchSupportActionResult> performDelayAction({
    required String alertId,
    required String action,
  }) async {
    final response = await _api.post(
      SmartwatchSupportEndpoints.delayAlertAction(alertId),
      body: {'action': action},
    );
    return SmartwatchSupportActionResult.fromJson(response);
  }

  Future<SmartwatchSupportActionResult> performEmergencyAction({
    required String alertId,
    required String action,
  }) async {
    final response = await _api.post(
      SmartwatchSupportEndpoints.emergencyAlertAction(alertId),
      body: {'action': action},
    );
    return SmartwatchSupportActionResult.fromJson(response);
  }

  Future<SmartwatchSupportActionResult> performTaskAction({
    required String taskId,
    required String action,
  }) async {
    final response = await _api.post(
      SmartwatchSupportEndpoints.taskNotificationAction(taskId),
      body: {'action': action},
    );
    return SmartwatchSupportActionResult.fromJson(response);
  }

  Future<SmartwatchSupportActionResult> pushAll() async {
    final response = await _api.post(SmartwatchSupportEndpoints.pushAll);
    return SmartwatchSupportActionResult.fromJson(response);
  }
}
