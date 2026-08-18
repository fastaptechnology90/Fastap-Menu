import '../core/api/api_provider.dart';
import '../core/api/customer_return_endpoints.dart';
import '../core/api/kitchen_api_client.dart';
import '../models/returns/customer_return_snapshot.dart';
import '../services/auth_service.dart';

class CustomerReturnService {
  CustomerReturnService({KitchenApiClient? apiClient})
      : _api = apiClient ?? ApiProvider.createClient();

  final KitchenApiClient _api;

  factory CustomerReturnService.fromAuth(AuthService authService) {
    return CustomerReturnService(apiClient: authService.apiClient);
  }

  Future<CustomerReturnSnapshot> fetchBoard({String section = 'All'}) async {
    final response = await _api.get(
      CustomerReturnEndpoints.board,
      query: {'section': section},
    );

    return CustomerReturnSnapshot.fromJson(
      response['data'] as Map<String, dynamic>,
    );
  }

  Future<CustomerReturnActionResult> createReturn({
    required String orderId,
    required String returnType,
    required String reason,
  }) async {
    final response = await _api.post(
      CustomerReturnEndpoints.create,
      body: {
        'orderId': orderId,
        'returnType': returnType,
        'reason': reason,
      },
    );
    return CustomerReturnActionResult.fromJson(response);
  }

  Future<CustomerReturnActionResult> performAction({
    required String returnId,
    required String action,
    String? tag,
    String? severity,
  }) async {
    final response = await _api.post(
      CustomerReturnEndpoints.action(returnId),
      body: {
        'action': action,
        'tag': ?tag,
        'severity': ?severity,
      },
    );
    return CustomerReturnActionResult.fromJson(response);
  }
}
