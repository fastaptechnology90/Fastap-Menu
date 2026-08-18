import '../config/api_config.dart';
import 'http_kitchen_api_client.dart';
import 'kitchen_api_client.dart';
import 'mock_kitchen_api_client.dart';

class ApiProvider {
  const ApiProvider._();

  static KitchenApiClient createClient() {
    if (ApiConfig.useMockApi) {
      return MockKitchenApiClient();
    }
    return HttpKitchenApiClient(baseUrl: ApiConfig.activeBaseUrl);
  }
}
