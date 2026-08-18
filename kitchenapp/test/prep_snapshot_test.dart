import 'package:flutter_test/flutter_test.dart';

import 'package:kitchenapp/models/prep/prep_snapshot.dart';

void main() {
  test('prep snapshot parses API payload', () {
    final snapshot = PrepSnapshot.fromJson({
      'section': 'All',
      'lastSyncedAt': '2026-06-06T12:00:00.000',
      'sections': ['All', 'Tandoor'],
      'stats': {
        'total': 2,
        'active': 1,
        'paused': 1,
        'pending': 0,
        'alerts': 3,
      },
      'prepModes': [
        {
          'mode': 'standard',
          'label': 'Standard preparation',
          'count': 1,
        },
      ],
      'stationLoad': [
        {
          'section': 'Tandoor',
          'load': 0.62,
          'taskCount': 1,
        },
      ],
      'tasks': [
        {
          'id': 'PREP-1842',
          'orderId': 'ORD-1842',
          'kotNumber': 'KOT #1842',
          'section': 'Tandoor',
          'dishName': 'Tandoori platter',
          'location': 'Table 12',
          'assignedChef': 'Ravi Tandoor',
          'mode': 'standard',
          'modeLabel': 'Standard preparation',
          'status': 'in_progress',
          'statusLabel': 'In preparation',
          'timerSeconds': 438,
          'timerTargetSeconds': 720,
          'timer': '07:18',
          'timerRemaining': '04:42',
          'portions': 1,
          'progress': 0.62,
          'vip': false,
          'allergy': false,
          'alerts': ['Next step · Skewer & tandoor fire'],
          'availableActions': ['pause', 'complete_step'],
          'steps': [
            {
              'order': 1,
              'label': 'Marinate protein',
              'done': true,
              'durationMinutes': 15,
            },
          ],
          'ingredients': [
            {
              'name': 'Chicken',
              'quantity': '250g',
              'checked': true,
            },
          ],
        },
      ],
    });

    expect(snapshot.tasks.length, 1);
    expect(snapshot.stats.active, 1);
    expect(snapshot.prepModes.first.count, 1);
    expect(snapshot.tasks.first.steps.first.done, isTrue);
  });
}
