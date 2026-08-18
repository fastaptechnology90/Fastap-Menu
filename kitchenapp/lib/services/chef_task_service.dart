import '../core/api/api_provider.dart';
import '../core/api/chef_task_endpoints.dart';
import '../core/api/kitchen_api_client.dart';
import '../models/chef_tasks/chef_task_snapshot.dart';
import '../services/auth_service.dart';

class ChefTaskService {
  ChefTaskService({KitchenApiClient? apiClient})
      : _api = apiClient ?? ApiProvider.createClient();

  final KitchenApiClient _api;

  factory ChefTaskService.fromAuth(AuthService authService) {
    return ChefTaskService(apiClient: authService.apiClient);
  }

  Future<ChefTaskSnapshot> fetchBoard({String section = 'All'}) async {
    final response = await _api.get(
      ChefTaskEndpoints.board,
      query: {'section': section},
    );

    return ChefTaskSnapshot.fromJson(
      response['data'] as Map<String, dynamic>,
    );
  }

  Future<ChefTaskActionResult> balanceWorkload() async {
    final response = await _api.post(ChefTaskEndpoints.balance);
    return ChefTaskActionResult.fromJson(response);
  }

  Future<void> performAction({
    required String taskId,
    required String action,
    String? targetChefId,
    String? targetChefName,
  }) async {
    await _api.post(
      ChefTaskEndpoints.taskAction(taskId),
      body: {
        'action': action,
        'targetChefId': ?targetChefId,
        'targetChefName': ?targetChefName,
      },
    );
  }
}
