import 'mock_dashboard_calculator.dart';
import 'mock_order_store.dart';

class MockKdsEngine {
  const MockKdsEngine._();

  static Map<String, dynamic> buildPayload({
    required String section,
    required String view,
    required String filter,
  }) {
    var orders = MockOrderStore.activeOrders(section);

    orders = switch (filter) {
      'vip' => orders.where((order) => order['vip'] == true).toList(),
      'priority' => orders
          .where((order) => (order['priority'] as String) != 'normal')
          .toList(),
      _ => orders,
    };

    orders.sort(
      (a, b) => (a['sortOrder'] as int).compareTo(b['sortOrder'] as int),
    );

    final serialized = orders
        .map(MockDashboardCalculator.serializeOrder)
        .toList();

    return {
      'section': section,
      'view': view,
      'filter': filter,
      'lastSyncedAt': DateTime.now().toIso8601String(),
      'orders': _layoutOrders(serialized, view),
      'stats': {
        'total': serialized.length,
        'delayed': serialized.where((o) => o['status'] == 'delayed').length,
        'vip': serialized.where((o) => o['vip'] == true).length,
        'priority': serialized
            .where((o) => (o['priority'] as String) != 'normal')
            .length,
      },
    };
  }

  static List<dynamic> _layoutOrders(
    List<Map<String, dynamic>> orders,
    String view,
  ) {
    if (view == 'queue' || view == 'priority' || view == 'vip') {
      return orders;
    }

    if (view == 'section') {
      return _groupBy(orders, 'section');
    }
    if (view == 'chef') {
      return _groupBy(orders, 'assignedChef');
    }
    if (view == 'category') {
      return _groupBy(orders, 'category');
    }
    if (view == 'timeline') {
      return _timelineGroups(orders);
    }
    return orders;
  }

  static List<Map<String, dynamic>> _groupBy(
    List<Map<String, dynamic>> orders,
    String key,
  ) {
    final groups = <String, List<Map<String, dynamic>>>{};
    for (final order in orders) {
      final label = order[key]?.toString() ?? 'Other';
      groups.putIfAbsent(label, () => []).add(order);
    }
    return groups.entries
        .map(
          (entry) => {
            'group': entry.key,
            'orders': entry.value,
          },
        )
        .toList();
  }

  static List<Map<String, dynamic>> _timelineGroups(
    List<Map<String, dynamic>> orders,
  ) {
    final buckets = <String, List<Map<String, dynamic>>>{
      '0-5 min': [],
      '5-10 min': [],
      '10+ min': [],
    };

    for (final order in orders) {
      final seconds = order['timerSeconds'] as int;
      if (seconds < 300) {
        buckets['0-5 min']!.add(order);
      } else if (seconds < 600) {
        buckets['5-10 min']!.add(order);
      } else {
        buckets['10+ min']!.add(order);
      }
    }

    return buckets.entries
        .where((entry) => entry.value.isNotEmpty)
        .map(
          (entry) => {
            'group': entry.key,
            'orders': entry.value,
          },
        )
        .toList();
  }
}
