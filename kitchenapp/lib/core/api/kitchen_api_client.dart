abstract class KitchenApiClient {
  String? authToken;

  Future<Map<String, dynamic>> get(
    String path, {
    Map<String, String>? query,
  });

  Future<Map<String, dynamic>> post(
    String path, {
    Map<String, dynamic>? body,
  });

  Future<Map<String, dynamic>> delete(
    String path, {
    Map<String, dynamic>? body,
  });

  void dispose();
}
