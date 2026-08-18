import 'package:flutter_test/flutter_test.dart';

import 'package:kitchenapp/models/priority/order_priority_snapshot.dart';

void main() {
  test('order priority snapshot parses API payload', () {
    final snapshot = OrderPrioritySnapshot.fromJson({
      'section': 'All',
      'lastSyncedAt': '2026-06-06T12:00:00.000',
      'sections': ['All', 'Main'],
      'orders': [
        {
          'id': 'ORD-1843',
          'kotNumber': 'KOT #1843',
          'location': 'Room 804',
          'section': 'Main',
          'items': ['1x Dal makhani'],
          'status': 'preparing',
          'statusLabel': 'VIP',
          'timer': '04:42',
          'progress': 0.78,
          'priority': 'vip',
          'vip': true,
          'priorityType': 'vip',
          'priorityLabel': 'VIP order',
          'priorityScore': 1180,
          'queuePosition': 1,
          'flashAlert': false,
          'soundAlert': false,
          'escalated': false,
          'availableActions': ['queue_jump', 'flash_alert'],
        },
      ],
      'lanes': [
        {
          'type': 'vip',
          'label': 'VIP order',
          'count': 1,
          'orderIds': ['ORD-1843'],
        },
      ],
      'alerts': [],
      'stats': {
        'total': 1,
        'vip': 1,
        'express': 0,
        'roomService': 0,
        'event': 0,
        'delivery': 0,
        'childMeal': 0,
        'flashAlerts': 0,
        'escalated': 0,
      },
      'priorityEngine': {
        'vipPrioritization': true,
        'expressLane': true,
        'roomServicePriority': true,
        'eventPriority': true,
        'deliveryPriority': true,
        'childMealPriority': true,
        'queueJump': true,
        'flashAlert': false,
        'soundAlert': false,
        'autoEscalation': false,
        'autoReassignment': true,
      },
    });

    expect(snapshot.orders.length, 1);
    expect(snapshot.orders.first.priorityType, 'vip');
    expect(snapshot.stats.vip, 1);
    expect(snapshot.priorityEngine.queueJump, isTrue);
    expect(snapshot.lanes.first.label, 'VIP order');
  });
}
