import '../core/api/analytics_reporting_endpoints.dart';
import '../core/api/api_provider.dart';
import '../core/api/kitchen_api_client.dart';
import '../models/analytics_reporting/analytics_reporting_snapshot.dart';
import '../services/auth_service.dart';

class AnalyticsReportingService {
  AnalyticsReportingService({KitchenApiClient? apiClient})
      : _api = apiClient ?? ApiProvider.createClient();

  final KitchenApiClient _api;

  factory AnalyticsReportingService.fromAuth(AuthService authService) {
    return AnalyticsReportingService(apiClient: authService.apiClient);
  }

  Future<AnalyticsReportingSnapshot> fetchBoard({String section = 'All'}) async {
    final response = await _api.get(
      AnalyticsReportingEndpoints.board,
      query: {'section': section},
    );

    return AnalyticsReportingSnapshot.fromJson(
      response['data'] as Map<String, dynamic>,
    );
  }

  Future<AnalyticsReportingActionResult> performReportAction({
    required String reportId,
    required String action,
  }) async {
    final response = await _api.post(
      AnalyticsReportingEndpoints.reportAction(reportId),
      body: {'action': action},
    );
    return AnalyticsReportingActionResult.fromJson(response);
  }

  Future<AnalyticsReportingActionResult> performInsightAction({
    required String insightId,
    required String action,
  }) async {
    final response = await _api.post(
      AnalyticsReportingEndpoints.insightAction(insightId),
      body: {'action': action},
    );
    return AnalyticsReportingActionResult.fromJson(response);
  }

  Future<AnalyticsReportingActionResult> generateAll() async {
    final response = await _api.post(AnalyticsReportingEndpoints.generateAll);
    return AnalyticsReportingActionResult.fromJson(response);
  }
}
