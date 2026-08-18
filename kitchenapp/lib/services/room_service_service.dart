import '../core/api/api_provider.dart';
import '../core/api/kitchen_api_client.dart';
import '../core/api/room_service_endpoints.dart';
import '../models/room_service/room_service_snapshot.dart';
import '../services/auth_service.dart';

class RoomServiceService {
  RoomServiceService({KitchenApiClient? apiClient})
      : _api = apiClient ?? ApiProvider.createClient();

  final KitchenApiClient _api;

  factory RoomServiceService.fromAuth(AuthService authService) {
    return RoomServiceService(apiClient: authService.apiClient);
  }

  Future<RoomServiceSnapshot> fetchBoard({String section = 'All'}) async {
    final response = await _api.get(
      RoomServiceEndpoints.board,
      query: {'section': section},
    );

    return RoomServiceSnapshot.fromJson(
      response['data'] as Map<String, dynamic>,
    );
  }

  Future<RoomServiceActionResult> performAction({
    required String orderId,
    required String action,
    String? trayId,
    String? scheduledTime,
  }) async {
    final response = await _api.post(
      RoomServiceEndpoints.orderAction(orderId),
      body: {
        'action': action,
        'trayId': ?trayId,
        'scheduledTime': ?scheduledTime,
      },
    );
    return RoomServiceActionResult.fromJson(response);
  }

  Future<RoomServiceActionResult> dispatchTray({String? orderId}) async {
    final response = await _api.post(
      RoomServiceEndpoints.dispatchTray,
      body: {'orderId': ?orderId},
    );
    return RoomServiceActionResult.fromJson(response);
  }
}
