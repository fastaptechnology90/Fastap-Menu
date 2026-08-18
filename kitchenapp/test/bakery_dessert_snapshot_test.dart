import 'package:flutter_test/flutter_test.dart';

import 'package:kitchenapp/models/bakery/bakery_dessert_snapshot.dart';

void main() {
  test('bakery dessert snapshot parses API payload', () {
    final snapshot = BakeryDessertSnapshot.fromJson({
      'section': 'All',
      'lastSyncedAt': '2026-06-06T12:00:00.000',
      'sections': ['All', 'Dessert'],
      'dessertQueue': [
        {
          'id': 'DSR-ORD-1845',
          'orderId': 'ORD-1845',
          'kotNumber': 'KOT #1845',
          'section': 'Dessert',
          'location': 'Banquet A',
          'itemName': '40x Gulab jamun',
          'jobType': 'event',
          'customization': 'Silver service',
          'status': 'preparing',
          'batchSize': 40,
          'timerSeconds': 690,
          'timerLabel': '11:30',
          'availableActions': ['complete_item', 'plan_event_batch'],
        },
      ],
      'productionBatches': [
        {
          'id': 'BAT-001',
          'itemName': 'Gulab jamun batch',
          'quantity': 40,
          'status': 'baking',
          'expiryMinutes': 28,
          'section': 'Dessert',
        },
      ],
      'eventPlans': [
        {
          'id': 'EVT-001',
          'eventName': 'Banquet A dessert service',
          'location': 'Banquet A',
          'items': ['40x Gulab jamun'],
          'totalServings': 80,
          'status': 'in_progress',
        },
      ],
      'stats': {
        'queuedJobs': 0,
        'inProduction': 1,
        'customCakes': 0,
        'eventPlans': 1,
        'completedToday': 9,
        'activeBatches': 1,
      },
      'bakeryFeatures': {
        'dessertPreparationQueue': true,
        'bakeryProductionTracking': true,
        'cakeCustomization': false,
        'eventDessertPlanning': true,
      },
    });

    expect(snapshot.dessertQueue.length, 1);
    expect(snapshot.dessertQueue.first.batchSize, 40);
    expect(snapshot.bakeryFeatures.eventDessertPlanning, isTrue);
    expect(snapshot.stats.activeBatches, 1);
  });
}
