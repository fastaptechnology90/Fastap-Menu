import '../core/api/api_provider.dart';
import '../core/api/kitchen_api_client.dart';
import '../core/api/waiter_auto_assignment_endpoints.dart';
import '../models/waiter/waiter_assignment_snapshot.dart';
import 'auth_service.dart';

class WaiterAutoAssignmentService {
  WaiterAutoAssignmentService({KitchenApiClient? apiClient})
      : _api = apiClient ?? ApiProvider.createClient();

  final KitchenApiClient _api;

  factory WaiterAutoAssignmentService.fromAuth(AuthService authService) {
    return WaiterAutoAssignmentService(apiClient: authService.apiClient);
  }

  Future<WaiterAssignmentSnapshot> fetchBoard({String section = 'All'}) async {
    final response = await _api.get(
      WaiterAutoAssignmentEndpoints.board,
      query: {'section': section},
    );
    return WaiterAssignmentSnapshot.fromJson(
      response['data'] as Map<String, dynamic>,
    );
  }

  Future<WaiterAssignmentActionResult> autoAllocate() async {
    final response = await _api.post(WaiterAutoAssignmentEndpoints.autoAllocate);
    return WaiterAssignmentActionResult.fromJson(response);
  }

  Future<WaiterAssignmentActionResult> balanceWorkload() async {
    final response =
        await _api.post(WaiterAutoAssignmentEndpoints.balanceWorkload);
    return WaiterAssignmentActionResult.fromJson(response);
  }

  Future<WaiterAssignmentActionResult> performTaskAction({
    required String taskId,
    required String action,
  }) async {
    final response = await _api.post(
      WaiterAutoAssignmentEndpoints.taskAction(taskId),
      body: {'action': action},
    );
    return WaiterAssignmentActionResult.fromJson(response);
  }

  Future<WaiterAssignmentActionResult> performNotificationAction({
    required String notificationId,
    required String action,
  }) async {
    final response = await _api.post(
      WaiterAutoAssignmentEndpoints.notificationAction(notificationId),
      body: {'action': action},
    );
    return WaiterAssignmentActionResult.fromJson(response);
  }
}
