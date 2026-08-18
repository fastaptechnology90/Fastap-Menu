import '../core/api/api_provider.dart';
import '../core/api/kitchen_api_client.dart';
import '../core/api/staff_performance_endpoints.dart';
import '../models/staff_performance/staff_performance_snapshot.dart';
import '../services/auth_service.dart';

class StaffPerformanceService {
  StaffPerformanceService({KitchenApiClient? apiClient})
      : _api = apiClient ?? ApiProvider.createClient();

  final KitchenApiClient _api;

  factory StaffPerformanceService.fromAuth(AuthService authService) {
    return StaffPerformanceService(apiClient: authService.apiClient);
  }

  Future<StaffPerformanceSnapshot> fetchBoard({String section = 'All'}) async {
    final response = await _api.get(
      StaffPerformanceEndpoints.board,
      query: {'section': section},
    );

    return StaffPerformanceSnapshot.fromJson(
      response['data'] as Map<String, dynamic>,
    );
  }

  Future<StaffPerformanceActionResult> performStaffAction({
    required String staffId,
    required String action,
  }) async {
    final response = await _api.post(
      StaffPerformanceEndpoints.staffAction(staffId),
      body: {'action': action},
    );
    return StaffPerformanceActionResult.fromJson(response);
  }

  Future<StaffPerformanceActionResult> performIncentiveAction({
    required String incentiveId,
    required String action,
  }) async {
    final response = await _api.post(
      StaffPerformanceEndpoints.incentiveAction(incentiveId),
      body: {'action': action},
    );
    return StaffPerformanceActionResult.fromJson(response);
  }

  Future<StaffPerformanceActionResult> recalculate() async {
    final response = await _api.post(StaffPerformanceEndpoints.recalculate);
    return StaffPerformanceActionResult.fromJson(response);
  }
}
