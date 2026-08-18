import 'mock_section_registry.dart';
import 'mock_staff_directory.dart';

class MockStaffShiftRegistry {
  MockStaffShiftRegistry._();

  static final List<Map<String, dynamic>> _shifts = _seedShifts();
  static final List<Map<String, dynamic>> _swaps = _seedSwaps();
  static final List<Map<String, dynamic>> _handovers = _seedHandovers();

  static List<Map<String, dynamic>> shiftsFor(String section) {
    if (section == 'All') {
      return _shifts.map(_serializeShift).toList();
    }
    return _shifts
        .where((item) => item['section'] == section)
        .map(_serializeShift)
        .toList();
  }

  static List<Map<String, dynamic>> swapsFor(String section) {
    if (section == 'All') {
      return _swaps.map(_serializeSwap).toList();
    }
    return _swaps
        .where((item) => item['section'] == section)
        .map(_serializeSwap)
        .toList();
  }

  static List<Map<String, dynamic>> handoversFor(String section) {
    if (section == 'All') {
      return _handovers.map(_serializeHandover).toList();
    }
    return _handovers
        .where((item) => item['section'] == section)
        .map(_serializeHandover)
        .toList();
  }

  static Map<String, dynamic> performStaffAction({
    required String staffId,
    required String action,
  }) {
    final shift = _findShift(staffId);
    if (shift == null) {
      throw ArgumentError('Shift record not found');
    }

    final staffName = shift['staffName'] as String;

    switch (action) {
      case 'start_shift':
        shift['shiftStatus'] = 'on_shift';
        shift['clockInTime'] = 'Just now';
        shift['clockOutTime'] = '--';
        shift['attendanceStatus'] = 'present';
        return {
          'success': true,
          'message': 'Shift started · $staffName',
        };
      case 'end_shift':
        shift['shiftStatus'] = 'off_shift';
        shift['clockOutTime'] = 'Just now';
        return {
          'success': true,
          'message': 'Shift ended · $staffName',
        };
      case 'start_break':
        shift['shiftStatus'] = 'on_break';
        return {
          'success': true,
          'message': 'Break started · $staffName',
        };
      case 'end_break':
        shift['shiftStatus'] = 'on_shift';
        shift['breakMinutes'] = (shift['breakMinutes'] as int) + 15;
        return {
          'success': true,
          'message': 'Break ended · $staffName',
        };
      case 'mark_overtime':
        shift['shiftStatus'] = 'overtime';
        shift['overtimeMinutes'] = (shift['overtimeMinutes'] as int) + 30;
        return {
          'success': true,
          'message': 'Overtime recorded · $staffName',
        };
      case 'request_swap':
        _swaps.add({
          'id': 'SWP-${_swaps.length + 1}'.padLeft(7, '0'),
          'requesterId': staffId,
          'requesterName': staffName,
          'targetStaffName': 'Open shift',
          'section': shift['section'],
          'shiftLabel': shift['shiftLabel'],
          'status': 'pending',
        });
        return {
          'success': true,
          'message': 'Shift swap requested · $staffName',
        };
      default:
        throw ArgumentError('Unknown shift action: $action');
    }
  }

  static Map<String, dynamic> performSwapAction({
    required String swapId,
    required String action,
  }) {
    final swap = _findSwap(swapId);
    if (swap == null) {
      throw ArgumentError('Swap request not found');
    }

    final requesterName = swap['requesterName'] as String;

    switch (action) {
      case 'approve_swap':
        swap['status'] = 'approved';
        return {
          'success': true,
          'message': 'Shift swap approved · $requesterName',
        };
      case 'reject_swap':
        swap['status'] = 'rejected';
        return {
          'success': true,
          'message': 'Shift swap rejected · $requesterName',
        };
      default:
        throw ArgumentError('Unknown swap action: $action');
    }
  }

  static Map<String, dynamic> performHandoverAction({
    required String handoverId,
    required String action,
    String? note,
  }) {
    final handover = _findHandover(handoverId);
    if (handover == null) {
      throw ArgumentError('Handover note not found');
    }

    final fromStaff = handover['fromStaff'] as String;

    switch (action) {
      case 'acknowledge_handover':
        handover['status'] = 'acknowledged';
        return {
          'success': true,
          'message': 'Handover acknowledged · $fromStaff',
        };
      case 'add_handover_note':
        handover['notePreview'] =
            note ?? 'Updated handover note · prep backlog cleared';
        handover['status'] = 'updated';
        return {
          'success': true,
          'message': 'Handover note updated · $fromStaff',
        };
      default:
        throw ArgumentError('Unknown handover action: $action');
    }
  }

  static Map<String, dynamic> syncAll() {
    for (final shift in _shifts) {
      if (shift['shiftStatus'] == 'on_shift' &&
          (shift['overtimeMinutes'] as int) >= 60) {
        shift['shiftStatus'] = 'overtime';
      }
    }
    return {
      'success': true,
      'message': 'Shift board synced · ${_shifts.length} records',
    };
  }

  static Map<String, dynamic>? _findShift(String staffId) {
    for (final shift in _shifts) {
      if (shift['staffId'] == staffId) {
        return shift;
      }
    }
    return null;
  }

  static Map<String, dynamic>? _findSwap(String swapId) {
    for (final swap in _swaps) {
      if (swap['id'] == swapId) {
        return swap;
      }
    }
    return null;
  }

  static Map<String, dynamic>? _findHandover(String handoverId) {
    for (final handover in _handovers) {
      if (handover['id'] == handoverId) {
        return handover;
      }
    }
    return null;
  }

  static Map<String, dynamic> _serializeShift(Map<String, dynamic> shift) {
    return {
      'id': shift['id'],
      'staffId': shift['staffId'],
      'staffName': shift['staffName'],
      'section': shift['section'],
      'role': shift['role'],
      'shiftLabel': shift['shiftLabel'],
      'shiftStatus': shift['shiftStatus'],
      'clockInTime': shift['clockInTime'],
      'clockOutTime': shift['clockOutTime'],
      'breakMinutes': shift['breakMinutes'],
      'overtimeMinutes': shift['overtimeMinutes'],
      'attendanceStatus': shift['attendanceStatus'],
      'availableActions': _actionsForShift(shift),
    };
  }

  static List<String> _actionsForShift(Map<String, dynamic> shift) {
    return switch (shift['shiftStatus']) {
      'off_shift' => ['start_shift', 'request_swap'],
      'on_shift' => ['start_break', 'end_shift', 'mark_overtime', 'request_swap'],
      'on_break' => ['end_break'],
      'overtime' => ['end_shift', 'start_break'],
      _ => <String>[],
    };
  }

  static Map<String, dynamic> _serializeSwap(Map<String, dynamic> swap) {
    return {
      'id': swap['id'],
      'requesterId': swap['requesterId'],
      'requesterName': swap['requesterName'],
      'targetStaffName': swap['targetStaffName'],
      'section': swap['section'],
      'shiftLabel': swap['shiftLabel'],
      'status': swap['status'],
      'availableActions': swap['status'] == 'pending'
          ? ['approve_swap', 'reject_swap']
          : <String>[],
    };
  }

  static Map<String, dynamic> _serializeHandover(Map<String, dynamic> handover) {
    return {
      'id': handover['id'],
      'fromStaff': handover['fromStaff'],
      'toStaff': handover['toStaff'],
      'section': handover['section'],
      'notePreview': handover['notePreview'],
      'status': handover['status'],
      'availableActions': handover['status'] == 'pending' ||
              handover['status'] == 'updated'
          ? ['acknowledge_handover', 'add_handover_note']
          : <String>[],
    };
  }

  static List<Map<String, dynamic>> _seedShifts() {
    final staff = MockStaffDirectory.all;
    return [
      {
        'id': 'SHF-001',
        'staffId': staff[0]['id'],
        'staffName': staff[0]['name'],
        'section': staff[0]['section'],
        'role': 'Head Chef',
        'shiftLabel': 'Morning',
        'shiftStatus': 'on_shift',
        'clockInTime': '06:00',
        'clockOutTime': '--',
        'breakMinutes': 15,
        'overtimeMinutes': 0,
        'attendanceStatus': 'present',
      },
      {
        'id': 'SHF-002',
        'staffId': staff[1]['id'],
        'staffName': staff[1]['name'],
        'section': staff[1]['section'],
        'role': 'Sous Chef',
        'shiftLabel': 'Morning',
        'shiftStatus': 'on_break',
        'clockInTime': '06:15',
        'clockOutTime': '--',
        'breakMinutes': 30,
        'overtimeMinutes': 0,
        'attendanceStatus': 'present',
      },
      {
        'id': 'SHF-003',
        'staffId': staff[2]['id'],
        'staffName': staff[2]['name'],
        'section': staff[2]['section'],
        'role': 'Tandoor Chef',
        'shiftLabel': 'Morning',
        'shiftStatus': 'overtime',
        'clockInTime': '05:45',
        'clockOutTime': '--',
        'breakMinutes': 20,
        'overtimeMinutes': 45,
        'attendanceStatus': 'present',
      },
      {
        'id': 'SHF-004',
        'staffId': staff[3]['id'],
        'staffName': staff[3]['name'],
        'section': staff[3]['section'],
        'role': 'Wok Chef',
        'shiftLabel': 'Evening',
        'shiftStatus': 'off_shift',
        'clockInTime': '--',
        'clockOutTime': '--',
        'breakMinutes': 0,
        'overtimeMinutes': 0,
        'attendanceStatus': 'late',
      },
      {
        'id': 'SHF-005',
        'staffId': staff[4]['id'],
        'staffName': staff[4]['name'],
        'section': staff[4]['section'],
        'role': 'Kitchen Manager',
        'shiftLabel': 'Full day',
        'shiftStatus': 'on_shift',
        'clockInTime': '05:30',
        'clockOutTime': '--',
        'breakMinutes': 10,
        'overtimeMinutes': 15,
        'attendanceStatus': 'present',
      },
    ];
  }

  static List<Map<String, dynamic>> _seedSwaps() {
    return [
      {
        'id': 'SWP-001',
        'requesterId': 'STF-004',
        'requesterName': 'Mei Lin',
        'targetStaffName': 'Evening wok cover',
        'section': 'Chinese',
        'shiftLabel': 'Evening',
        'status': 'pending',
      },
      {
        'id': 'SWP-002',
        'requesterId': 'STF-002',
        'requesterName': 'Sous Chef Priya Nair',
        'targetStaffName': 'Ravi Tandoor',
        'section': 'Main',
        'shiftLabel': 'Morning',
        'status': 'approved',
      },
    ];
  }

  static List<Map<String, dynamic>> _seedHandovers() {
    return [
      {
        'id': 'HND-001',
        'fromStaff': 'Chef Arjun Mehta',
        'toStaff': 'Sous Chef Priya Nair',
        'section': 'Main',
        'notePreview':
            'VIP banquet prep at 18:00 · sauce batch low · 2 delayed KOTs',
        'status': 'pending',
      },
      {
        'id': 'HND-002',
        'fromStaff': 'Ravi Tandoor',
        'toStaff': 'Evening tandoor team',
        'section': 'Tandoor',
        'notePreview': 'Naan dough resting · tandoor at 420°C · filter due Fri',
        'status': 'acknowledged',
      },
    ];
  }
}

class MockStaffShiftEngine {
  const MockStaffShiftEngine._();

  static Map<String, dynamic> buildSnapshot({String section = 'All'}) {
    final shiftRecords = MockStaffShiftRegistry.shiftsFor(section);
    final swapRequests = MockStaffShiftRegistry.swapsFor(section);
    final handoverNotes = MockStaffShiftRegistry.handoversFor(section);

    return {
      'section': section,
      'lastSyncedAt': DateTime.now().toIso8601String(),
      'shiftRecords': shiftRecords,
      'swapRequests': swapRequests,
      'handoverNotes': handoverNotes,
      'stats': {
        'onShiftNow': shiftRecords
            .where((item) =>
                item['shiftStatus'] == 'on_shift' ||
                item['shiftStatus'] == 'overtime')
            .length,
        'onBreak': shiftRecords
            .where((item) => item['shiftStatus'] == 'on_break')
            .length,
        'overtimeActive': shiftRecords
            .where((item) => item['shiftStatus'] == 'overtime')
            .length,
        'lateArrivals': shiftRecords
            .where((item) => item['attendanceStatus'] == 'late')
            .length,
        'pendingSwaps':
            swapRequests.where((item) => item['status'] == 'pending').length,
        'openHandovers': handoverNotes
            .where((item) => item['status'] == 'pending')
            .length,
      },
      'shiftFeatures': {
        'shiftStartEnd': shiftRecords.isNotEmpty,
        'attendanceTracking': shiftRecords.isNotEmpty,
        'breakTracking': shiftRecords.any(
          (item) => (item['breakMinutes'] as int) > 0 ||
              item['shiftStatus'] == 'on_break',
        ),
        'overtimeTracking': shiftRecords.any(
          (item) => (item['overtimeMinutes'] as int) > 0 ||
              item['shiftStatus'] == 'overtime',
        ),
        'shiftSwap': swapRequests.isNotEmpty,
        'shiftHandoverNotes': handoverNotes.isNotEmpty,
      },
      'sections': MockSectionRegistry.filterSections,
    };
  }
}
