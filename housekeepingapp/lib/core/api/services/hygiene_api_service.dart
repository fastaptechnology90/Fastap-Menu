import 'package:kitchenapp/core/api/kitchen_api_client.dart';
import 'package:kitchenapp/models/hygiene/cleaning_hygiene_snapshot.dart';

import '../endpoints/hygiene_endpoints.dart';
import 'api_provider.dart';

class HygieneApiService {
  HygieneApiService({KitchenApiClient? apiClient})
      : _api = apiClient ?? ApiProvider.createClient();

  final KitchenApiClient _api;

  Future<CleaningHygieneSnapshot> fetchBoard({String section = 'All'}) async {
    final response = await _api.get(
      HygieneEndpoints.board,
      query: {'section': section},
    );
    return CleaningHygieneSnapshot.fromJson(
      response['data'] as Map<String, dynamic>,
    );
  }

  Future<CleaningHygieneActionResult> performTaskAction({
    required String taskId,
    required String action,
    String? staffName,
  }) async {
    final response = await _api.post(
      HygieneEndpoints.taskAction(taskId),
      body: {
        'action': action,
        'staffName': ?staffName,
      },
    );
    return CleaningHygieneActionResult.fromJson(response);
  }

  Future<CleaningHygieneActionResult> startAudit({String? auditType}) async {
    final response = await _api.post(
      HygieneEndpoints.startAudit,
      body: {'auditType': ?auditType},
    );
    return CleaningHygieneActionResult.fromJson(response);
  }
}
