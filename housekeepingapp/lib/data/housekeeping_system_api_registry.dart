import '../core/api/endpoints/endpoints.dart';

class HousekeepingSystemApiRegistry {
  const HousekeepingSystemApiRegistry._();

  static const Map<int, String> primaryGetPath = {
    12: OrderPriorityEndpoints.board,
    28: RoomServiceEndpoints.board,
    29: HygieneEndpoints.board,
    35: LiveAlertEndpoints.board,
    36: LiveAlertEndpoints.board,
  };

  static List<int> get enabledSystems => primaryGetPath.keys.toList()..sort();
}
