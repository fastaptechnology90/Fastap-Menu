import 'package:kitchenapp/core/api/kitchen_api_client.dart';
import 'package:kitchenapp/models/room_service/room_service_snapshot.dart';

import '../endpoints/room_service_endpoints.dart';
import 'api_provider.dart';

class RoomServiceApiService {
  RoomServiceApiService({KitchenApiClient? apiClient})
      : _api = apiClient ?? ApiProvider.createClient();

  final KitchenApiClient _api;

  Future<RoomServiceSnapshot> fetchBoard({String section = 'All'}) async {
    final response = await _api.get(
      RoomServiceEndpoints.board,
      query: {'section': section},
    );
    return RoomServiceSnapshot.fromJson(
      response['data'] as Map<String, dynamic>,
    );
  }

  Future<RoomServiceActionResult> performOrderAction({
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
