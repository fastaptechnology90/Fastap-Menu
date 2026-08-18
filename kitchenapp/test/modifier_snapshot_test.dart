import 'package:flutter_test/flutter_test.dart';

import 'package:kitchenapp/models/modifiers/modifier_snapshot.dart';

void main() {
  test('modifier snapshot parses API payload', () {
    final snapshot = ModifierSnapshot.fromJson({
      'section': 'All',
      'lastSyncedAt': '2026-06-06T12:00:00.000',
      'sections': ['All', 'Main'],
      'stats': {
        'ordersWithModifiers': 1,
        'totalModifiers': 2,
        'pendingAcknowledgment': 1,
        'pendingChefConfirm': 1,
        'flashAlerts': 1,
        'allergyOrders': 1,
      },
      'smartAlerts': {
        'allergyFlashingAlerts': true,
        'priorityModifiers': true,
        'chefConfirmationRequired': true,
        'acknowledgmentTracking': true,
      },
      'catalog': [
        {'label': 'Extra spicy', 'type': 'preference'},
      ],
      'orders': [
        {
          'orderId': 'ORD-1843',
          'kotNumber': 'KOT #1843',
          'location': 'Room 804',
          'section': 'Main',
          'category': 'Main course',
          'status': 'preparing',
          'vip': true,
          'allergy': true,
          'items': ['1x Dal makhani'],
          'modifiers': [
            {
              'id': 'MOD-1843-0',
              'label': 'Nut allergy protocol',
              'type': 'allergy',
              'category': 'Allergy modifiers',
              'priority': 'critical',
              'flashAlert': true,
              'requiresChefConfirm': true,
              'acknowledged': false,
              'chefConfirmed': false,
            },
          ],
          'customizations': [],
          'stats': {
            'totalModifiers': 1,
            'pendingAcknowledgment': 1,
            'pendingChefConfirm': 1,
            'flashAlerts': 1,
          },
          'availableActions': ['acknowledge_all', 'apply_modifier'],
        },
      ],
    });

    expect(snapshot.orders.length, 1);
    expect(snapshot.stats.allergyOrders, 1);
    expect(snapshot.smartAlerts.allergyFlashingAlerts, isTrue);
    expect(snapshot.orders.first.modifiers.first.flashAlert, isTrue);
  });
}
