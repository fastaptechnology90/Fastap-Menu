import 'package:flutter_test/flutter_test.dart';

import 'package:kitchenapp/models/smartwatch_support/smartwatch_support_snapshot.dart';

void main() {
  test('smartwatch support snapshot parses API payload', () {
    final snapshot = SmartwatchSupportSnapshot.fromJson({
      'section': 'All',
      'lastSyncedAt': '2026-06-06T12:00:00.000',
      'sections': ['All', 'Main'],
      'orderAlerts': [
        {
          'id': 'SW-ORD-001',
          'title': 'VIP order #2847 ready for pass',
          'section': 'Main',
          'priority': 'high',
          'recipient': 'Expeditor watch',
          'status': 'pending',
          'availableActions': ['push_to_watch'],
        },
      ],
      'delayAlerts': [
        {
          'id': 'SW-DLY-001',
          'title': 'Main grill 18 min behind',
          'section': 'Main',
          'delayMinutes': 18,
          'severity': 'critical',
          'status': 'active',
          'availableActions': ['escalate_delay'],
        },
      ],
      'emergencyAlerts': [
        {
          'id': 'SW-EMG-001',
          'title': 'Panic button test · Pass station',
          'section': 'Main',
          'alertType': 'panic_test',
          'severity': 'critical',
          'status': 'active',
          'availableActions': ['broadcast_emergency'],
        },
      ],
      'taskNotifications': [
        {
          'id': 'SW-TSK-001',
          'title': 'Mise en place checklist due',
          'section': 'Main',
          'assignee': 'Prep lead',
          'dueLabel': '15 min',
          'status': 'pending',
          'availableActions': ['mark_done'],
        },
      ],
      'stats': {
        'activeOrderAlerts': 1,
        'activeDelayAlerts': 1,
        'emergencyActive': 1,
        'pendingTasks': 1,
        'watchesConnected': 5,
        'pushedToday': 24,
      },
      'smartwatchFeatures': {
        'orderAlerts': true,
        'delayAlerts': true,
        'emergencyAlerts': true,
        'taskNotifications': true,
      },
    });

    expect(snapshot.orderAlerts.first.priority, 'high');
    expect(snapshot.delayAlerts.first.delayMinutes, 18);
    expect(snapshot.smartwatchFeatures.emergencyAlerts, isTrue);
    expect(snapshot.stats.watchesConnected, 5);
  });
}
