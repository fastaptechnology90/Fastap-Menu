import 'package:flutter_test/flutter_test.dart';

import 'package:kitchenapp/models/staff_shift/staff_shift_snapshot.dart';

void main() {
  test('staff shift snapshot parses API payload', () {
    final snapshot = StaffShiftSnapshot.fromJson({
      'section': 'All',
      'lastSyncedAt': '2026-06-06T12:00:00.000',
      'sections': ['All', 'Main'],
      'shiftRecords': [
        {
          'id': 'SHF-001',
          'staffId': 'STF-001',
          'staffName': 'Chef Arjun Mehta',
          'section': 'Main',
          'role': 'Head Chef',
          'shiftLabel': 'Morning',
          'shiftStatus': 'on_shift',
          'clockInTime': '06:00',
          'clockOutTime': '--',
          'breakMinutes': 15,
          'overtimeMinutes': 0,
          'attendanceStatus': 'present',
          'availableActions': ['start_break', 'end_shift'],
        },
      ],
      'swapRequests': [
        {
          'id': 'SWP-001',
          'requesterId': 'STF-004',
          'requesterName': 'Mei Lin',
          'targetStaffName': 'Evening wok cover',
          'section': 'Chinese',
          'shiftLabel': 'Evening',
          'status': 'pending',
          'availableActions': ['approve_swap'],
        },
      ],
      'handoverNotes': [
        {
          'id': 'HND-001',
          'fromStaff': 'Chef Arjun Mehta',
          'toStaff': 'Sous Chef Priya Nair',
          'section': 'Main',
          'notePreview': 'VIP banquet prep at 18:00',
          'status': 'pending',
          'availableActions': ['acknowledge_handover'],
        },
      ],
      'stats': {
        'onShiftNow': 1,
        'onBreak': 0,
        'overtimeActive': 0,
        'lateArrivals': 0,
        'pendingSwaps': 1,
        'openHandovers': 1,
      },
      'shiftFeatures': {
        'shiftStartEnd': true,
        'attendanceTracking': true,
        'breakTracking': true,
        'overtimeTracking': false,
        'shiftSwap': true,
        'shiftHandoverNotes': true,
      },
    });

    expect(snapshot.shiftRecords.length, 1);
    expect(snapshot.shiftRecords.first.shiftStatus, 'on_shift');
    expect(snapshot.shiftFeatures.shiftHandoverNotes, isTrue);
    expect(snapshot.stats.pendingSwaps, 1);
  });
}
