import 'package:flutter_test/flutter_test.dart';

import 'package:kitchenapp/models/firing/course_firing_snapshot.dart';

void main() {
  test('course firing snapshot parses API payload', () {
    final snapshot = CourseFiringSnapshot.fromJson({
      'section': 'All',
      'lastSyncedAt': '2026-06-06T12:00:00.000',
      'sections': ['All', 'Main'],
      'stats': {
        'totalSessions': 2,
        'activeFires': 3,
        'heldCourses': 1,
        'vipSessions': 1,
        'syncAlerts': 1,
      },
      'smartFiring': {
        'tablePacing': true,
        'guestPacing': true,
        'delaySynchronization': true,
        'multiCourseCoordination': true,
      },
      'coordinationBoard': [
        {
          'sessionId': 'FIRE-T12',
          'location': 'Table 12',
          'mode': 'sequential',
          'nextAction': 'Fire Main course',
          'etaMinutes': 18,
        },
      ],
      'sessions': [
        {
          'id': 'FIRE-T12',
          'location': 'Table 12',
          'tableNumber': '12',
          'guestType': 'Regular',
          'deliveryType': 'Dine-in',
          'sections': ['Tandoor'],
          'servingMode': 'sequential',
          'servingModeLabel': 'Sequential serving',
          'linkedOrderIds': ['ORD-1842'],
          'vip': false,
          'pacing': {
            'tableMinutesSinceSeat': 18,
            'guestReady': true,
            'syncDelayMinutes': 2,
            'targetGapMinutes': 12,
          },
          'sessionActions': ['simultaneous_serving', 'sync_pacing'],
          'courses': [
            {
              'type': 'starter',
              'label': 'Starter',
              'status': 'fired',
              'statusLabel': 'Fired',
              'items': ['1x Soup'],
              'firedSecondsAgo': 120,
              'etaMinutes': 8,
              'linkedKot': 'KOT #1842-S',
              'elapsed': '02:00',
              'availableActions': ['hold_starter'],
            },
          ],
        },
      ],
    });

    expect(snapshot.sessions.length, 1);
    expect(snapshot.stats.activeFires, 3);
    expect(snapshot.smartFiring.tablePacing, isTrue);
    expect(snapshot.sessions.first.courses.first.availableActions,
        contains('hold_starter'));
  });
}
