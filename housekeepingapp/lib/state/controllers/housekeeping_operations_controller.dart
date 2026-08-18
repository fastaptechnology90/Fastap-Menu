import 'package:flutter/foundation.dart';
import 'package:kitchenapp/models/hygiene/cleaning_hygiene_snapshot.dart';
import 'package:kitchenapp/models/room_service/room_service_snapshot.dart';

import '../../core/api/services/hygiene_api_service.dart';
import '../../core/api/services/room_service_api_service.dart';
import '../../core/constants/housekeeping_constants.dart';

enum HousekeepingOperationsStatus { idle, loading, ready, error }

/// State for housekeeping boards (hygiene + room service).
class HousekeepingOperationsController extends ChangeNotifier {
  HousekeepingOperationsController({
    HygieneApiService? hygieneApi,
    RoomServiceApiService? roomServiceApi,
  })  : _hygieneApi = hygieneApi ?? HygieneApiService(),
        _roomServiceApi = roomServiceApi ?? RoomServiceApiService();

  final HygieneApiService _hygieneApi;
  final RoomServiceApiService _roomServiceApi;

  HousekeepingOperationsStatus _status = HousekeepingOperationsStatus.idle;
  String _section = HousekeepingConstants.defaultSection;
  CleaningHygieneSnapshot? _hygieneBoard;
  RoomServiceSnapshot? _roomServiceBoard;
  String? _errorMessage;
  String? _lastActionMessage;

  HousekeepingOperationsStatus get status => _status;
  String get section => _section;
  CleaningHygieneSnapshot? get hygieneBoard => _hygieneBoard;
  RoomServiceSnapshot? get roomServiceBoard => _roomServiceBoard;
  String? get errorMessage => _errorMessage;
  String? get lastActionMessage => _lastActionMessage;

  Future<void> refresh({String? section}) async {
    if (section != null) _section = section;
    _status = HousekeepingOperationsStatus.loading;
    _errorMessage = null;
    notifyListeners();

    try {
      _hygieneBoard = await _hygieneApi.fetchBoard(section: _section);
      _roomServiceBoard = await _roomServiceApi.fetchBoard(section: _section);
      _status = HousekeepingOperationsStatus.ready;
    } catch (e) {
      _status = HousekeepingOperationsStatus.error;
      _errorMessage = e.toString();
    }
    notifyListeners();
  }

  Future<void> performHygieneAction({
    required String taskId,
    required String action,
    String? staffName,
  }) async {
    try {
      final result = await _hygieneApi.performTaskAction(
        taskId: taskId,
        action: action,
        staffName: staffName,
      );
      _lastActionMessage = result.message;
      await refresh();
    } catch (e) {
      _errorMessage = e.toString();
      notifyListeners();
    }
  }

  Future<void> performRoomServiceAction({
    required String orderId,
    required String action,
  }) async {
    try {
      final result = await _roomServiceApi.performOrderAction(
        orderId: orderId,
        action: action,
      );
      _lastActionMessage = result.message;
      await refresh();
    } catch (e) {
      _errorMessage = e.toString();
      notifyListeners();
    }
  }
}
