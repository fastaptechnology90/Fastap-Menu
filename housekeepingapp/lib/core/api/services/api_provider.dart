import 'package:kitchenapp/core/api/http_kitchen_api_client.dart';
import 'package:kitchenapp/core/api/kitchen_api_client.dart';
import 'package:kitchenapp/core/api/mock_kitchen_api_client.dart';

import '../../config/api_config.dart';

class ApiProvider {
  const ApiProvider._();

  static KitchenApiClient createClient() {
    if (ApiConfig.useMockApi) {
      return MockKitchenApiClient();
    }
    return HttpKitchenApiClient(baseUrl: ApiConfig.activeBaseUrl);
  }
}
