import '../core/api/api_provider.dart';
import '../core/api/audit_compliance_endpoints.dart';
import '../core/api/kitchen_api_client.dart';
import '../models/audit_compliance/audit_compliance_snapshot.dart';
import '../services/auth_service.dart';

class AuditComplianceService {
  AuditComplianceService({KitchenApiClient? apiClient})
      : _api = apiClient ?? ApiProvider.createClient();

  final KitchenApiClient _api;

  factory AuditComplianceService.fromAuth(AuthService authService) {
    return AuditComplianceService(apiClient: authService.apiClient);
  }

  Future<AuditComplianceSnapshot> fetchBoard({String section = 'All'}) async {
    final response = await _api.get(
      AuditComplianceEndpoints.board,
      query: {'section': section},
    );

    return AuditComplianceSnapshot.fromJson(
      response['data'] as Map<String, dynamic>,
    );
  }

  Future<AuditComplianceActionResult> performActionLogAction({
    required String logId,
    required String action,
  }) async {
    final response = await _api.post(
      AuditComplianceEndpoints.actionLogAction(logId),
      body: {'action': action},
    );
    return AuditComplianceActionResult.fromJson(response);
  }

  Future<AuditComplianceActionResult> performFoodSafetyAction({
    required String logId,
    required String action,
  }) async {
    final response = await _api.post(
      AuditComplianceEndpoints.foodSafetyLogAction(logId),
      body: {'action': action},
    );
    return AuditComplianceActionResult.fromJson(response);
  }

  Future<AuditComplianceActionResult> performHygieneAction({
    required String logId,
    required String action,
  }) async {
    final response = await _api.post(
      AuditComplianceEndpoints.hygieneLogAction(logId),
      body: {'action': action},
    );
    return AuditComplianceActionResult.fromJson(response);
  }

  Future<AuditComplianceActionResult> performStaffActivityAction({
    required String logId,
    required String action,
  }) async {
    final response = await _api.post(
      AuditComplianceEndpoints.staffActivityLogAction(logId),
      body: {'action': action},
    );
    return AuditComplianceActionResult.fromJson(response);
  }

  Future<AuditComplianceActionResult> performIncidentAction({
    required String incidentId,
    required String action,
  }) async {
    final response = await _api.post(
      AuditComplianceEndpoints.incidentLogAction(incidentId),
      body: {'action': action},
    );
    return AuditComplianceActionResult.fromJson(response);
  }

  Future<AuditComplianceActionResult> exportAll() async {
    final response = await _api.post(AuditComplianceEndpoints.exportAll);
    return AuditComplianceActionResult.fromJson(response);
  }
}
