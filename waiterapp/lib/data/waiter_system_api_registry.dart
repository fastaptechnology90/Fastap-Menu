import '../core/api/endpoints/endpoints.dart';

/// Maps enterprise system numbers to primary GET paths for the waiter app.
class WaiterSystemApiRegistry {
  const WaiterSystemApiRegistry._();

  static const Map<int, String> primaryGetPath = {
    12: OrderPriorityEndpoints.board,
    26: CloudKitchenEndpoints.board,
    27: BanquetEndpoints.board,
    35: LiveAlertEndpoints.board,
    36: LiveAlertEndpoints.board,
    49: WaiterEndpoints.board,
  };

  static List<int> get enabledSystems => primaryGetPath.keys.toList()..sort();
}
