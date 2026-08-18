import '../core/api/api_provider.dart';
import '../core/api/delay_escalation_endpoints.dart';
import '../core/api/kitchen_api_client.dart';
import '../models/delays/delay_escalation_snapshot.dart';
import '../services/auth_service.dart';

class DelayEscalationService {
  DelayEscalationService({KitchenApiClient? apiClient})
      : _api = apiClient ?? ApiProvider.createClient();

  final KitchenApiClient _api;

  factory DelayEscalationService.fromAuth(AuthService authService) {
    return DelayEscalationService(apiClient: authService.apiClient);
  }

  Future<DelayEscalationSnapshot> fetchBoard({String section = 'All'}) async {
    final response = await _api.get(
      DelayEscalationEndpoints.board,
      query: {'section': section},
    );

    return DelayEscalationSnapshot.fromJson(
      response['data'] as Map<String, dynamic>,
    );
  }

  Future<DelayEscalationActionResult> logDelayReason({
    required String orderId,
    required String reason,
  }) async {
    final response = await _api.post(
      DelayEscalationEndpoints.reason,
      body: {
        'orderId': orderId,
        'reason': reason,
      },
    );
    return DelayEscalationActionResult.fromJson(response);
  }

  Future<DelayEscalationActionResult> autoEscalateAll() async {
    final response = await _api.post(DelayEscalationEndpoints.autoEscalate);
    return DelayEscalationActionResult.fromJson(response);
  }

  Future<DelayEscalationActionResult> performAction({
    required String orderId,
    required String action,
    String? reason,
  }) async {
    final response = await _api.post(
      DelayEscalationEndpoints.action(orderId),
      body: {
        'action': action,
        'reason': ?reason,
      },
    );
    return DelayEscalationActionResult.fromJson(response);
  }
}
