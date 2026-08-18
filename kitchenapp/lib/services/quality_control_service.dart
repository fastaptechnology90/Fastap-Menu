import '../core/api/api_provider.dart';
import '../core/api/quality_control_endpoints.dart';
import '../core/api/kitchen_api_client.dart';
import '../models/quality/quality_control_snapshot.dart';
import '../services/auth_service.dart';

class QualityControlService {
  QualityControlService({KitchenApiClient? apiClient})
      : _api = apiClient ?? ApiProvider.createClient();

  final KitchenApiClient _api;

  factory QualityControlService.fromAuth(AuthService authService) {
    return QualityControlService(apiClient: authService.apiClient);
  }

  Future<QualityControlSnapshot> fetchBoard({String section = 'All'}) async {
    final response = await _api.get(
      QualityControlEndpoints.board,
      query: {'section': section},
    );

    return QualityControlSnapshot.fromJson(
      response['data'] as Map<String, dynamic>,
    );
  }

  Future<QualityControlActionResult> performCheckAction({
    required String checkId,
    required String action,
    String? itemId,
    bool? passed,
  }) async {
    final response = await _api.post(
      QualityControlEndpoints.checkAction(checkId),
      body: {
        'action': action,
        'itemId': ?itemId,
        'passed': ?passed,
      },
    );
    return QualityControlActionResult.fromJson(response);
  }

  Future<QualityControlActionResult> performOrderAction({
    required String orderId,
    required String action,
    String? reason,
    String? supervisorName,
  }) async {
    final response = await _api.post(
      QualityControlEndpoints.orderAction(orderId),
      body: {
        'action': action,
        'reason': ?reason,
        'supervisorName': ?supervisorName,
      },
    );
    return QualityControlActionResult.fromJson(response);
  }

  Future<QualityControlActionResult> triggerRandomAudit({String? section}) async {
    final response = await _api.post(
      QualityControlEndpoints.randomAudit,
      body: {'section': ?section},
    );
    return QualityControlActionResult.fromJson(response);
  }

  Future<QualityControlActionResult> logComplaint({
    required String orderId,
    required String reason,
    String severity = 'medium',
  }) async {
    final response = await _api.post(
      QualityControlEndpoints.complaints,
      body: {
        'orderId': orderId,
        'reason': reason,
        'severity': severity,
      },
    );
    return QualityControlActionResult.fromJson(response);
  }
}
