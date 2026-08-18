import '../core/api/api_provider.dart';
import '../core/api/hardware_integration_endpoints.dart';
import '../core/api/kitchen_api_client.dart';
import '../models/hardware_integration/hardware_integration_snapshot.dart';
import '../services/auth_service.dart';

class HardwareIntegrationService {
  HardwareIntegrationService({KitchenApiClient? apiClient})
      : _api = apiClient ?? ApiProvider.createClient();

  final KitchenApiClient _api;

  factory HardwareIntegrationService.fromAuth(AuthService authService) {
    return HardwareIntegrationService(apiClient: authService.apiClient);
  }

  Future<HardwareIntegrationSnapshot> fetchBoard({
    String section = 'All',
  }) async {
    final response = await _api.get(
      HardwareIntegrationEndpoints.board,
      query: {'section': section},
    );

    return HardwareIntegrationSnapshot.fromJson(
      response['data'] as Map<String, dynamic>,
    );
  }

  Future<HardwareIntegrationActionResult> performDisplayAction({
    required String displayId,
    required String action,
  }) async {
    final response = await _api.post(
      HardwareIntegrationEndpoints.displayAction(displayId),
      body: {'action': action},
    );
    return HardwareIntegrationActionResult.fromJson(response);
  }

  Future<HardwareIntegrationActionResult> performTabletAction({
    required String tabletId,
    required String action,
  }) async {
    final response = await _api.post(
      HardwareIntegrationEndpoints.tabletAction(tabletId),
      body: {'action': action},
    );
    return HardwareIntegrationActionResult.fromJson(response);
  }

  Future<HardwareIntegrationActionResult> performPrinterAction({
    required String printerId,
    required String action,
  }) async {
    final response = await _api.post(
      HardwareIntegrationEndpoints.printerAction(printerId),
      body: {'action': action},
    );
    return HardwareIntegrationActionResult.fromJson(response);
  }

  Future<HardwareIntegrationActionResult> performSmartwatchAction({
    required String watchId,
    required String action,
  }) async {
    final response = await _api.post(
      HardwareIntegrationEndpoints.smartwatchAction(watchId),
      body: {'action': action},
    );
    return HardwareIntegrationActionResult.fromJson(response);
  }

  Future<HardwareIntegrationActionResult> performNfcAction({
    required String nfcId,
    required String action,
  }) async {
    final response = await _api.post(
      HardwareIntegrationEndpoints.nfcAction(nfcId),
      body: {'action': action},
    );
    return HardwareIntegrationActionResult.fromJson(response);
  }

  Future<HardwareIntegrationActionResult> performScannerAction({
    required String scannerId,
    required String action,
  }) async {
    final response = await _api.post(
      HardwareIntegrationEndpoints.scannerAction(scannerId),
      body: {'action': action},
    );
    return HardwareIntegrationActionResult.fromJson(response);
  }

  Future<HardwareIntegrationActionResult> syncAll() async {
    final response = await _api.post(HardwareIntegrationEndpoints.syncAll);
    return HardwareIntegrationActionResult.fromJson(response);
  }
}
