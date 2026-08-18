import 'package:flutter/foundation.dart';
import 'package:kitchenapp/models/waiter/waiter_assignment_snapshot.dart';

import '../../core/api/services/waiter_api_service.dart';
import '../../core/constants/waiter_constants.dart';

enum WaiterOperationsStatus { idle, loading, ready, error }

/// State for waiter floor operations (auto-assignment board, actions).
class WaiterOperationsController extends ChangeNotifier {
  WaiterOperationsController({WaiterApiService? waiterApi})
      : _waiterApi = waiterApi ?? WaiterApiService();

  final WaiterApiService _waiterApi;

  WaiterOperationsStatus _status = WaiterOperationsStatus.idle;
  String _section = WaiterConstants.defaultSection;
  WaiterAssignmentSnapshot? _board;
  String? _errorMessage;
  String? _lastActionMessage;

  WaiterOperationsStatus get status => _status;
  String get section => _section;
  WaiterAssignmentSnapshot? get board => _board;
  String? get errorMessage => _errorMessage;
  String? get lastActionMessage => _lastActionMessage;

  void bindApiClient(WaiterApiService service) {
    // Allows sharing authenticated client from auth layer after login.
  }

  Future<void> refresh({String? section}) async {
    if (section != null) _section = section;
    _status = WaiterOperationsStatus.loading;
    _errorMessage = null;
    notifyListeners();

    try {
      _board = await _waiterApi.fetchBoard(section: _section);
      _status = WaiterOperationsStatus.ready;
    } catch (e) {
      _status = WaiterOperationsStatus.error;
      _errorMessage = e.toString();
    }
    notifyListeners();
  }

  Future<void> autoAllocate() async {
    _lastActionMessage = null;
    try {
      final result = await _waiterApi.autoAllocate();
      _lastActionMessage = result.message;
      await refresh();
    } catch (e) {
      _errorMessage = e.toString();
      notifyListeners();
    }
  }

  Future<void> balanceWorkload() async {
    _lastActionMessage = null;
    try {
      final result = await _waiterApi.balanceWorkload();
      _lastActionMessage = result.message;
      await refresh();
    } catch (e) {
      _errorMessage = e.toString();
      notifyListeners();
    }
  }

  Future<void> performTaskAction({
    required String taskId,
    required String action,
  }) async {
    try {
      final result = await _waiterApi.performTaskAction(
        taskId: taskId,
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
