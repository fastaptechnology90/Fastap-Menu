import '../core/api/api_provider.dart';
import '../core/api/kitchen_api_client.dart';
import '../core/api/kitchen_communication_endpoints.dart';
import '../models/communication/kitchen_communication_snapshot.dart';
import '../services/auth_service.dart';

class KitchenCommunicationService {
  KitchenCommunicationService({KitchenApiClient? apiClient})
      : _api = apiClient ?? ApiProvider.createClient();

  final KitchenApiClient _api;

  factory KitchenCommunicationService.fromAuth(AuthService authService) {
    return KitchenCommunicationService(apiClient: authService.apiClient);
  }

  Future<KitchenCommunicationSnapshot> fetchBoard({
    String section = 'All',
  }) async {
    final response = await _api.get(
      KitchenCommunicationEndpoints.board,
      query: {'section': section},
    );

    return KitchenCommunicationSnapshot.fromJson(
      response['data'] as Map<String, dynamic>,
    );
  }

  Future<CommunicationActionResult> sendMessage({
    required String threadId,
    required String message,
    required String sender,
  }) async {
    final response = await _api.post(
      KitchenCommunicationEndpoints.message,
      body: {
        'threadId': threadId,
        'message': message,
        'sender': sender,
      },
    );
    return CommunicationActionResult.fromJson(response);
  }

  Future<CommunicationActionResult> sendVoiceNote({
    required String threadId,
    required String sender,
  }) async {
    final response = await _api.post(
      KitchenCommunicationEndpoints.voiceNote,
      body: {
        'threadId': threadId,
        'sender': sender,
      },
    );
    return CommunicationActionResult.fromJson(response);
  }

  Future<CommunicationActionResult> sendDelayUpdate({
    required String orderId,
    required int minutes,
    required String sender,
  }) async {
    final response = await _api.post(
      KitchenCommunicationEndpoints.delayUpdate,
      body: {
        'orderId': orderId,
        'minutes': minutes,
        'sender': sender,
      },
    );
    return CommunicationActionResult.fromJson(response);
  }

  Future<CommunicationActionResult> postAnnouncement({
    required String title,
    required String body,
    required String author,
    String scope = 'All',
  }) async {
    final response = await _api.post(
      KitchenCommunicationEndpoints.announcement,
      body: {
        'title': title,
        'body': body,
        'author': author,
        'scope': scope,
      },
    );
    return CommunicationActionResult.fromJson(response);
  }

  Future<CommunicationActionResult> sendBroadcast({
    required String message,
    required String author,
    String scope = 'All',
  }) async {
    final response = await _api.post(
      KitchenCommunicationEndpoints.broadcast,
      body: {
        'message': message,
        'author': author,
        'scope': scope,
      },
    );
    return CommunicationActionResult.fromJson(response);
  }

  Future<CommunicationActionResult> performAlertAction({
    required String alertId,
    required String action,
  }) async {
    final response = await _api.post(
      KitchenCommunicationEndpoints.alertAction,
      body: {
        'alertId': alertId,
        'action': action,
      },
    );
    return CommunicationActionResult.fromJson(response);
  }
}
