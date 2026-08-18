import 'package:flutter_test/flutter_test.dart';

import 'package:kitchenapp/models/chef_tasks/chef_task_snapshot.dart';

void main() {
  test('chef task snapshot parses API payload', () {
    final snapshot = ChefTaskSnapshot.fromJson({
      'section': 'All',
      'lastSyncedAt': '2026-06-06T12:00:00.000',
      'sections': ['All', 'Main'],
      'stats': {
        'total': 2,
        'assigned': 1,
        'inProgress': 1,
        'waiting': 0,
        'delayed': 0,
        'escalated': 0,
      },
      'chefs': [
        {
          'id': 'STF-001',
          'name': 'Chef Arjun Mehta',
          'role': 'headChef',
          'section': 'Main',
        },
      ],
      'workloadBoard': [
        {
          'chef': 'Chef Arjun Mehta',
          'taskCount': 1,
          'load': 0.81,
        },
      ],
      'tasks': [
        {
          'id': 'TASK-1843',
          'orderId': 'ORD-1843',
          'kotNumber': 'KOT #1843',
          'title': 'VIP dal makhani service',
          'section': 'Main',
          'assignedChef': 'Chef Arjun Mehta',
          'assignedChefId': 'STF-001',
          'skillTag': 'headChef',
          'shiftId': 'SHIFT-LIVE',
          'status': 'in_progress',
          'statusLabel': 'In progress',
          'priority': 'vip',
          'progress': 0.78,
          'workloadScore': 0.81,
          'coordination': ['Allergy protocol with Safety team'],
          'availableActions': ['complete', 'transfer', 'mark_waiting'],
        },
      ],
    });

    expect(snapshot.tasks.length, 1);
    expect(snapshot.stats.inProgress, 1);
    expect(snapshot.workloadBoard.first.chef, 'Chef Arjun Mehta');
    expect(snapshot.tasks.first.availableActions, contains('complete'));
  });
}
