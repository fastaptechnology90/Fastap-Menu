import '../core/api/api_provider.dart';
import '../core/api/banquet_endpoints.dart';
import '../core/api/kitchen_api_client.dart';
import '../models/banquet/banquet_snapshot.dart';
import '../services/auth_service.dart';

class BanquetService {
  BanquetService({KitchenApiClient? apiClient})
      : _api = apiClient ?? ApiProvider.createClient();

  final KitchenApiClient _api;

  factory BanquetService.fromAuth(AuthService authService) {
    return BanquetService(apiClient: authService.apiClient);
  }

  Future<BanquetSnapshot> fetchBoard({String section = 'All'}) async {
    final response = await _api.get(
      BanquetEndpoints.board,
      query: {'section': section},
    );

    return BanquetSnapshot.fromJson(
      response['data'] as Map<String, dynamic>,
    );
  }

  Future<BanquetActionResult> performAction({
    required String eventId,
    required String action,
    int? guestCount,
    String? counterName,
  }) async {
    final response = await _api.post(
      BanquetEndpoints.eventAction(eventId),
      body: {
        'action': action,
        'guestCount': ?guestCount,
        'counterName': ?counterName,
      },
    );
    return BanquetActionResult.fromJson(response);
  }

  Future<BanquetActionResult> startSchedule({String? eventName}) async {
    final response = await _api.post(
      BanquetEndpoints.startSchedule,
      body: {'eventName': ?eventName},
    );
    return BanquetActionResult.fromJson(response);
  }
}
