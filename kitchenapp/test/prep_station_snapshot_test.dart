import 'package:flutter_test/flutter_test.dart';

import 'package:kitchenapp/models/prep_stations/prep_station_snapshot.dart';

void main() {
  test('prep station snapshot parses API payload', () {
    final snapshot = PrepStationSnapshot.fromJson({
      'section': 'All',
      'lastSyncedAt': '2026-06-06T12:00:00.000',
      'sections': ['All', 'Main'],
      'stations': [
        {
          'id': 'STN-GRILL',
          'name': 'Grill station',
          'type': 'grill',
          'kitchenSection': 'Grill',
          'assignedStaff': 'Grill Station',
          'queueCount': 4,
          'timerSeconds': 510,
          'timerRunning': true,
          'timerLabel': '08:30',
          'workload': 0.83,
          'productivityScore': 0.76,
          'status': 'active',
          'availableActions': ['start_timer', 'pause_timer', 'reduce_load'],
        },
      ],
      'stats': {
        'stations': 1,
        'activeTimers': 1,
        'avgWorkload': 0.83,
        'totalQueue': 4,
        'avgProductivity': 0.76,
      },
      'stationFeatures': {
        'cuttingStation': false,
        'sauceStation': false,
        'grillStation': true,
        'fryStation': false,
        'beverageStation': false,
        'dessertPrepStation': false,
        'stationWorkloadTracking': true,
        'prepTimers': true,
        'queueBalancing': true,
        'staffAssignment': true,
        'productivityTracking': true,
      },
    });

    expect(snapshot.stations.length, 1);
    expect(snapshot.stations.first.type, 'grill');
    expect(snapshot.stats.totalQueue, 4);
    expect(snapshot.stationFeatures.prepTimers, isTrue);
  });
}
