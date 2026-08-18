import 'package:flutter_test/flutter_test.dart';

import 'package:kitchenapp/models/banquet/banquet_snapshot.dart';

void main() {
  test('banquet snapshot parses API payload', () {
    final snapshot = BanquetSnapshot.fromJson({
      'section': 'All',
      'lastSyncedAt': '2026-06-06T12:00:00.000',
      'sections': ['All', 'Indian'],
      'bulkPrepJobs': [
        {
          'id': 'BLK-001',
          'eventId': 'EVT-BNQ-001',
          'eventName': 'Wedding reception dinner',
          'section': 'Indian',
          'location': 'Banquet Hall A',
          'menuItems': ['200x Paneer tikka'],
          'guestCount': 200,
          'status': 'preparing',
          'timerSeconds': 840,
          'timerLabel': '14:00',
          'availableActions': ['coordinate_buffet', 'complete_event'],
        },
      ],
      'buffetStations': [
        {
          'id': 'BF-001',
          'stationName': 'Main buffet counter',
          'location': 'Banquet Hall A',
          'courses': ['Starters', 'Main course'],
          'status': 'prepping',
          'servingPercent': 0,
        },
      ],
      'eventSchedules': [
        {
          'id': 'EVT-BNQ-001',
          'eventName': 'Wedding reception dinner',
          'location': 'Banquet Hall A',
          'startTime': '19:00',
          'mealType': 'Dinner',
          'guestCount': 200,
          'status': 'preparing',
          'availableActions': ['coordinate_buffet'],
        },
      ],
      'guestCountPlans': [
        {
          'id': 'GST-001',
          'eventName': 'Wedding reception dinner',
          'confirmedGuests': 200,
          'bufferGuests': 20,
          'preparedServings': 220,
          'status': 'in_progress',
        },
      ],
      'counterCoordination': [
        {
          'id': 'CTR-001',
          'counterName': 'Main buffet counter',
          'assignedChef': 'Head Chef Raj',
          'linkedEvent': 'Wedding reception dinner',
          'queueDepth': 4,
          'status': 'active',
        },
      ],
      'stats': {
        'activeEvents': 1,
        'bulkPrepJobs': 1,
        'buffetLive': 0,
        'scheduledMeals': 0,
        'totalGuests': 200,
        'completedToday': 3,
      },
      'banquetFeatures': {
        'bulkMealPreparation': true,
        'buffetCoordination': true,
        'eventMealScheduling': true,
        'guestCountPreparation': true,
        'multiCounterCoordination': true,
      },
    });

    expect(snapshot.bulkPrepJobs.length, 1);
    expect(snapshot.bulkPrepJobs.first.guestCount, 200);
    expect(snapshot.banquetFeatures.buffetCoordination, isTrue);
    expect(snapshot.stats.totalGuests, 200);
  });
}
