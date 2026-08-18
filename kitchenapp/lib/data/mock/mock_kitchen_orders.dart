import 'mock_order_store.dart';

class MockKitchenOrders {
  const MockKitchenOrders._();

  static List<String> get sections => MockOrderStore.sections;

  static List<Map<String, dynamic>> get orders => MockOrderStore.orders;

  static List<Map<String, dynamic>> filterBySection(
    List<Map<String, dynamic>> source,
    String section,
  ) {
    return MockOrderStore.filterBySection(section);
  }
}
