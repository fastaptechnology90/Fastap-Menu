import 'package:flutter_test/flutter_test.dart';

import 'package:kitchenapp/models/dashboard/dashboard_snapshot.dart';

void main() {
  test('dashboard snapshot parses API payload', () {
    final snapshot = DashboardSnapshot.fromJson({
      'section': 'All',
      'lastSyncedAt': '2026-06-06T12:00:00.000',
      'sections': ['All', 'Main'],
      'widgets': [
        {
          'key': 'activeOrders',
          'label': 'Active orders',
          'value': '8',
          'detail': 'Steady flow',
          'tone': 'danger',
        },
      ],
      'metrics': [
        {
          'key': 'kitchenEfficiency',
          'label': 'Kitchen efficiency',
          'value': '91%',
          'detail': '+6%',
          'tone': 'primary',
        },
      ],
      'sectionWorkload': [
        {
          'section': 'Main',
          'activeOrders': 2,
          'load': 0.4,
          'staffAssigned': 2,
        },
      ],
      'rushAlerts': [],
      'orders': [
        {
          'id': 'ORD-1',
          'kotNumber': 'KOT #1',
          'location': 'Table 1',
          'section': 'Main',
          'items': ['1x Soup'],
          'status': 'preparing',
          'timer': '05:00',
          'progress': 0.5,
          'priority': 'normal',
          'vip': false,
          'allergy': false,
        },
      ],
    });

    expect(snapshot.widgets.length, 1);
    expect(snapshot.metrics.length, 1);
    expect(snapshot.orders.length, 1);
    expect(snapshot.orders.first.title, 'KOT #1');
  });

  test('dashboard snapshot accepts API trend alias on metrics', () {
    final snapshot = DashboardSnapshot.fromJson({
      'section': 'All',
      'lastSyncedAt': '2026-06-06T12:00:00.000Z',
      'sections': ['All'],
      'widgets': [],
      'metrics': [
        {
          'key': 'kitchenEfficiency',
          'label': 'Kitchen efficiency',
          'value': '91%',
          'trend': 'Live',
          'tone': 'primary',
        },
      ],
      'sectionWorkload': [],
      'rushAlerts': [],
      'orders': [],
    });

    expect(snapshot.metrics.single.detail, 'Live');
  });

  test('dashboard snapshot tolerates missing optional lists', () {
    final snapshot = DashboardSnapshot.fromJson({
      'section': 'All',
      'lastSyncedAt': '2026-06-06T12:00:00.000Z',
    });

    expect(snapshot.widgets, isEmpty);
    expect(snapshot.metrics, isEmpty);
    expect(snapshot.orders, isEmpty);
    expect(snapshot.sections, ['All']);
  });
}
