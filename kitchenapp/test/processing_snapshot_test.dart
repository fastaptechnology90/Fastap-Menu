import 'package:flutter_test/flutter_test.dart';

import 'package:kitchenapp/models/processing/processing_snapshot.dart';

void main() {
  test('processing snapshot parses API payload', () {
    final snapshot = ProcessingSnapshot.fromJson({
      'section': 'All',
      'lastSyncedAt': '2026-06-06T12:00:00.000',
      'sections': ['All', 'Main'],
      'stats': {
        'total': 2,
        'held': 1,
        'vip': 1,
        'rush': 0,
        'batchGroups': 1,
      },
      'smartProcessing': {
        'autoQueueSorting': true,
        'aiPriorityHandling': true,
        'vipPrioritization': true,
        'rushHourOptimization': false,
        'batchCookingManagement': true,
        'smartCookingSequence': true,
      },
      'batchCooking': [
        {
          'id': 'BATCH-Main-Main course',
          'label': 'Main · Main course',
          'orderCount': 2,
          'orders': ['KOT #1', 'KOT #2'],
        },
      ],
      'cookingSequence': [
        {
          'orderId': 'ORD-1',
          'kotNumber': 'KOT #1',
          'step': 'Start preparation',
          'etaMinutes': 5,
        },
      ],
      'orders': [
        {
          'id': 'ORD-1',
          'kotNumber': 'KOT #1',
          'location': 'Table 1',
          'section': 'Main',
          'items': ['1x Soup'],
          'status': 'accepted',
          'timer': '05:00',
          'progress': 0.5,
          'priority': 'normal',
          'vip': false,
          'allergy': false,
          'lineItems': [
            {
              'name': '1x Soup',
              'status': 'active',
              'modifiable': true,
            },
          ],
          'held': false,
          'availableActions': ['prepare', 'hold'],
        },
      ],
    });

    expect(snapshot.orders.length, 1);
    expect(snapshot.stats.held, 1);
    expect(snapshot.smartProcessing.autoQueueSorting, isTrue);
    expect(snapshot.batchCooking.first.orderCount, 2);
    expect(snapshot.orders.first.availableActions, contains('prepare'));
  });
}
