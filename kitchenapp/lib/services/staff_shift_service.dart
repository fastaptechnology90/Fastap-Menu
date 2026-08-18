import '../core/api/api_provider.dart';
import '../core/api/kitchen_api_client.dart';
import '../core/api/staff_shift_endpoints.dart';
import '../models/staff_shift/staff_shift_snapshot.dart';
import '../services/auth_service.dart';

class StaffShiftService {
  StaffShiftService({KitchenApiClient? apiClient})
      : _api = apiClient ?? ApiProvider.createClient();

  final KitchenApiClient _api;

  factory StaffShiftService.fromAuth(AuthService authService) {
    return StaffShiftService(apiClient: authService.apiClient);
  }

  Future<StaffShiftSnapshot> fetchBoard({String section = 'All'}) async {
    final response = await _api.get(
      StaffShiftEndpoints.board,
      query: {'section': section},
    );

    return StaffShiftSnapshot.fromJson(
      response['data'] as Map<String, dynamic>,
    );
  }

  Future<StaffShiftActionResult> performStaffAction({
    required String staffId,
    required String action,
  }) async {
    final response = await _api.post(
      StaffShiftEndpoints.staffAction(staffId),
      body: {'action': action},
    );
    return StaffShiftActionResult.fromJson(response);
  }

  Future<StaffShiftActionResult> performSwapAction({
    required String swapId,
    required String action,
  }) async {
    final response = await _api.post(
      StaffShiftEndpoints.swapAction(swapId),
      body: {'action': action},
    );
    return StaffShiftActionResult.fromJson(response);
  }

  Future<StaffShiftActionResult> performHandoverAction({
    required String handoverId,
    required String action,
    String? note,
  }) async {
    final response = await _api.post(
      StaffShiftEndpoints.handoverAction(handoverId),
      body: {
        'action': action,
        'note': ?note,
      },
    );
    return StaffShiftActionResult.fromJson(response);
  }

  Future<StaffShiftActionResult> syncAll() async {
    final response = await _api.post(StaffShiftEndpoints.syncAll);
    return StaffShiftActionResult.fromJson(response);
  }
}
