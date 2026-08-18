import '../core/api/api_provider.dart';
import '../core/api/iot_device_endpoints.dart';
import '../core/api/kitchen_api_client.dart';
import '../models/iot/iot_device_snapshot.dart';
import '../services/auth_service.dart';

class IotDeviceService {
  IotDeviceService({KitchenApiClient? apiClient})
      : _api = apiClient ?? ApiProvider.createClient();

  final KitchenApiClient _api;

  factory IotDeviceService.fromAuth(AuthService authService) {
    return IotDeviceService(apiClient: authService.apiClient);
  }

  Future<IotDeviceSnapshot> fetchBoard({String section = 'All'}) async {
    final response = await _api.get(
      IotDeviceEndpoints.board,
      query: {'section': section},
    );

    return IotDeviceSnapshot.fromJson(
      response['data'] as Map<String, dynamic>,
    );
  }

  Future<IotDeviceActionResult> performAction({
    required String deviceId,
    required String action,
  }) async {
    final response = await _api.post(
      IotDeviceEndpoints.deviceAction(deviceId),
      body: {'action': action},
    );
    return IotDeviceActionResult.fromJson(response);
  }

  Future<IotDeviceActionResult> syncAll() async {
    final response = await _api.post(IotDeviceEndpoints.syncAll);
    return IotDeviceActionResult.fromJson(response);
  }
}
