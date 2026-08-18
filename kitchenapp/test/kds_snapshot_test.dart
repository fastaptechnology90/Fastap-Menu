import 'package:flutter_test/flutter_test.dart';

import 'package:kitchenapp/models/kds/kds_snapshot.dart';

void main() {
  test('kds snapshot parses queue API payload', () {
    final snapshot = KdsSnapshot.fromJson({
      'section': 'Main',
      'view': 'queue',
      'filter': 'all',
      'lastSyncedAt': '2026-06-06T12:00:00.000',
      'orders': [
        {
          'id': 'ORD-1843',
          'orderId': 'ORD-1843',
          'kotNumber': 'KOT #1843',
          'section': 'Main',
          'category': 'Main',
          'assignedChef': 'Chef Arjun Mehta',
          'guestType': 'VIP',
          'deliveryType': 'Room service',
          'items': ['1x Dal makhani'],
          'addOns': ['Extra butter'],
          'modifiers': ['Nut allergy protocol'],
          'cookingNotes': ['Serve hot'],
          'status': 'preparing',
          'priority': 'vip',
          'timerSeconds': 282,
          'progress': 0.78,
          'sortOrder': 1,
          'vip': true,
          'allergy': true,
          'reFireRequested': false,
          'tableNumber': '12',
          'roomNumber': '804',
          'location': 'Room 804',
        },
      ],
      'stats': {
        'total': 1,
        'delayed': 0,
        'vip': 1,
        'priority': 1,
      },
    });

    expect(snapshot.orders.length, 1);
    expect(snapshot.orders.first.kotNumber, 'KOT #1843');
    expect(snapshot.orders.first.isPriority, isTrue);
    expect(snapshot.stats.vip, 1);
    expect(snapshot.isGrouped, isFalse);
  });

  test('kds snapshot parses grouped section view payload', () {
    final snapshot = KdsSnapshot.fromJson({
      'section': 'All',
      'view': 'section',
      'filter': 'all',
      'lastSyncedAt': '2026-06-06T12:00:00.000',
      'orders': [
        {
          'group': 'Main',
          'orders': [
            {
              'id': 'ORD-1',
              'orderId': 'ORD-1',
              'kotNumber': 'KOT #1',
              'section': 'Main',
              'items': ['Soup'],
              'status': 'accepted',
              'priority': 'normal',
              'timerSeconds': 120,
              'progress': 0.2,
              'sortOrder': 0,
              'vip': false,
              'allergy': false,
              'reFireRequested': false,
            },
          ],
        },
      ],
      'stats': {'total': 1, 'delayed': 0, 'vip': 0, 'priority': 0},
    });

    expect(snapshot.isGrouped, isTrue);
    expect(snapshot.groups.first.label, 'Main');
    expect(snapshot.orders.first.section, 'Main');
  });
}
