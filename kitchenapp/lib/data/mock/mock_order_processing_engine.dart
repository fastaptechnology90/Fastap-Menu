import 'mock_dashboard_calculator.dart';
import 'mock_order_store.dart';
import 'mock_section_registry.dart';

class MockOrderProcessingEngine {
  const MockOrderProcessingEngine._();

  static Map<String, dynamic> buildSnapshot({String section = 'All'}) {
    MockOrderStore.tickTimers();
    var orders = MockOrderStore.processingOrders(section);
    orders = _sortBySmartPriority(orders);

    final serialized = orders
        .map((order) => _serializeProcessingOrder(order))
        .toList();

    final held = orders.where((o) => o['status'] == 'on_hold').length;
    final vip = orders.where((o) => o['vip'] == true).length;
    final rush = orders.where((o) => o['status'] == 'delayed').length;

    return {
      'section': section,
      'lastSyncedAt': DateTime.now().toIso8601String(),
      'orders': serialized,
      'stats': {
        'total': serialized.length,
        'held': held,
        'vip': vip,
        'rush': rush,
        'batchGroups': _batchGroups(orders).length,
      },
      'smartProcessing': {
        'autoQueueSorting': true,
        'aiPriorityHandling': true,
        'vipPrioritization': true,
        'rushHourOptimization': rush > 0,
        'batchCookingManagement': true,
        'smartCookingSequence': true,
      },
      'batchCooking': _batchGroups(orders),
      'cookingSequence': _cookingSequence(orders),
      'sections': MockSectionRegistry.filterSections,
    };
  }

  static Map<String, dynamic> optimizeQueue() {
    MockOrderStore.autoSortQueue();
    return {
      'success': true,
      'message': 'AI queue optimized · VIP and rush orders reprioritized',
    };
  }

  static List<Map<String, dynamic>> _sortBySmartPriority(
    List<Map<String, dynamic>> orders,
  ) {
    final sorted = [...orders];
    sorted.sort((a, b) {
      int score(Map<String, dynamic> order) {
        var value = 0;
        if (order['vip'] == true) {
          value += 1000;
        }
        if (order['status'] == 'delayed') {
          value += 500;
        }
        if (order['priority'] == 'express') {
          value += 300;
        }
        if (order['status'] == 'new') {
          value += 200;
        }
        value -= order['sortOrder'] as int;
        return value;
      }

      return score(b).compareTo(score(a));
    });
    return sorted;
  }

  static List<Map<String, dynamic>> _batchGroups(
    List<Map<String, dynamic>> orders,
  ) {
    final groups = <String, List<Map<String, dynamic>>>{};
    for (final order in orders) {
      if (order['status'] == 'on_hold') {
        continue;
      }
      final key = '${order['section']}-${order['category'] ?? order['section']}';
      groups.putIfAbsent(key, () => []).add(order);
    }

    return groups.entries
        .where((entry) => entry.value.length > 1)
        .map(
          (entry) => {
            'id': 'BATCH-${entry.key}',
            'label': entry.key.replaceAll('-', ' · '),
            'orderCount': entry.value.length,
            'orders': entry.value.map((o) => o['kotNumber']).toList(),
          },
        )
        .take(3)
        .toList();
  }

  static List<Map<String, dynamic>> _cookingSequence(
    List<Map<String, dynamic>> orders,
  ) {
    final active = orders
        .where((o) => o['status'] != 'on_hold' && o['status'] != 'ready')
        .take(5);

    return active
        .map(
          (order) => {
            'orderId': order['id'],
            'kotNumber': order['kotNumber'],
            'step': _sequenceStep(order),
            'etaMinutes': ((order['timerSeconds'] as int) / 60).ceil(),
          },
        )
        .toList();
  }

  static String _sequenceStep(Map<String, dynamic> order) {
    return switch (order['status']) {
      'new' => 'Accept → prep',
      'accepted' => 'Start preparation',
      'preparing' => 'Finish & mark ready',
      'delayed' => 'Escalate & recover',
      _ => 'Dispatch',
    };
  }

  static Map<String, dynamic> _serializeProcessingOrder(
    Map<String, dynamic> order,
  ) {
    final base = MockDashboardCalculator.serializeOrder(order);
    return {
      ...base,
      'lineItems': MockOrderStore.lineItemsFor(order),
      'held': order['status'] == 'on_hold',
      'availableActions': MockOrderStore.availableActions(order),
    };
  }
}
