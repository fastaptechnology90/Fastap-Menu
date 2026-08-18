import 'package:kitchenapp/core/api/kitchen_api_client.dart';
import 'package:kitchenapp/models/waiter/waiter_assignment_snapshot.dart';

import '../endpoints/waiter_endpoints.dart';
import 'api_provider.dart';

/// Waiter auto-assignment and floor-delivery API service.
class WaiterApiService {
  WaiterApiService({KitchenApiClient? apiClient})
      : _api = apiClient ?? ApiProvider.createClient();

  final KitchenApiClient _api;

  factory WaiterApiService.fromClient(KitchenApiClient client) {
    return WaiterApiService(apiClient: client);
  }

  Future<WaiterAssignmentSnapshot> fetchBoard({String section = 'All'}) async {
    final response = await _api.get(
      WaiterEndpoints.board,
      query: {'section': section},
    );
    return WaiterAssignmentSnapshot.fromJson(
      response['data'] as Map<String, dynamic>,
    );
  }

  Future<WaiterAssignmentActionResult> autoAllocate() async {
    final response = await _api.post(WaiterEndpoints.autoAllocate);
    return WaiterAssignmentActionResult.fromJson(response);
  }

  Future<WaiterAssignmentActionResult> balanceWorkload() async {
    final response = await _api.post(WaiterEndpoints.balanceWorkload);
    return WaiterAssignmentActionResult.fromJson(response);
  }

  Future<WaiterAssignmentActionResult> performTaskAction({
    required String taskId,
    required String action,
  }) async {
    final response = await _api.post(
      WaiterEndpoints.taskAction(taskId),
      body: {'action': action},
    );
    return WaiterAssignmentActionResult.fromJson(response);
  }

  Future<WaiterAssignmentActionResult> performNotificationAction({
    required String notificationId,
    required String action,
  }) async {
    final response = await _api.post(
      WaiterEndpoints.notificationAction(notificationId),
      body: {'action': action},
    );
    return WaiterAssignmentActionResult.fromJson(response);
  }
}
