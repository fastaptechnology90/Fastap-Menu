import 'mock_order_store.dart';
import 'mock_section_registry.dart';

class MockDelayEscalationRegistry {
  MockDelayEscalationRegistry._();

  static final List<Map<String, dynamic>> _history = _seedHistory();
  static final List<Map<String, dynamic>> _escalations = _seedEscalations();

  static List<Map<String, dynamic>> delayedOrdersFor(String section) {
    MockOrderStore.tickTimers();
    var orders = MockOrderStore.activeOrders(section)
        .where((order) {
          return order['status'] == 'delayed' ||
              (order['timerSeconds'] as int) > 720 ||
              order['escalated'] == true;
        })
        .toList();

    if (orders.isEmpty) {
      orders = MockOrderStore.activeOrders(section)
          .where((o) => (o['timerSeconds'] as int) > 600)
          .take(3)
          .toList();
    }

    return orders.map(_serializeDelayOrder).toList();
  }

  static List<Map<String, dynamic>> historyFor(String section) {
    final items = section == 'All'
        ? _history
        : _history.where((item) => item['section'] == section);
    return items.map(Map<String, dynamic>.from).toList();
  }

  static List<Map<String, dynamic>> escalationsFor(String section) {
    final items = section == 'All'
        ? _escalations
        : _escalations.where((item) => item['section'] == section);
    return items.map(Map<String, dynamic>.from).toList();
  }

  static List<Map<String, dynamic>> bottlenecksFor(String section) {
    final orders = MockOrderStore.activeOrders(section);
    final counts = <String, int>{};
    for (final order in orders) {
      if (order['status'] == 'delayed' ||
          (order['timerSeconds'] as int) > 720) {
        final sec = order['section'] as String;
        counts[sec] = (counts[sec] ?? 0) + 1;
      }
    }

    return counts.entries
        .map(
          (entry) => {
            'section': entry.key,
            'delayedOrders': entry.value,
            'severity': entry.value >= 2 ? 'critical' : 'high',
            'bottleneck': entry.value >= 2 ? 'Station overload' : 'Recovery needed',
          },
        )
        .toList();
  }

  static Map<String, dynamic> logDelayReason({
    required String orderId,
    required String reason,
  }) {
    final order = MockOrderStore.findById(orderId);
    if (order == null) {
      throw ArgumentError('Order not found');
    }

    MockOrderStore.processAction(orderId, 'delay');
    order['delayReason'] = reason;

    _history.insert(0, {
      'id': 'HIS-${DateTime.now().millisecondsSinceEpoch}',
      'orderId': orderId,
      'kotNumber': order['kotNumber'],
      'section': order['section'],
      'reason': reason,
      'loggedAt': DateTime.now().toIso8601String(),
    });

    return {
      'success': true,
      'message': 'Delay reason logged · ${order['kotNumber']}',
    };
  }

  static Map<String, dynamic> autoEscalateAll() {
    var count = 0;
    for (final order in MockOrderStore.activeOrders('All')) {
      if (order['status'] == 'delayed' && order['escalated'] != true) {
        _escalateOrder(order, 'kitchen_manager');
        count++;
      }
    }

    return {
      'success': true,
      'message': count == 0
          ? 'No orders required auto escalation'
          : 'Auto escalation applied · $count orders escalated',
    };
  }

  static Map<String, dynamic> performAction({
    required String orderId,
    required String action,
    String? reason,
    String? level,
  }) {
    final order = MockOrderStore.findById(orderId);
    if (order == null) {
      throw ArgumentError('Order not found');
    }

    switch (action) {
      case 'log_reason':
        return logDelayReason(
          orderId: orderId,
          reason: reason ?? 'Kitchen backlog',
        );
      case 'escalate_chef':
        _escalateOrder(order, 'chef');
        return {
          'success': true,
          'message': 'Chef alert sent · ${order['kotNumber']}',
        };
      case 'escalate_manager':
        _escalateOrder(order, 'kitchen_manager');
        return {
          'success': true,
          'message': 'Kitchen manager alert · ${order['kotNumber']}',
        };
      case 'escalate_operations':
        _escalateOrder(order, 'operations');
        return {
          'success': true,
          'message': 'Operations alert · ${order['kotNumber']}',
        };
      case 'resolve':
        order['status'] = 'preparing';
        order['escalated'] = false;
        order['escalationLevel'] = null;
        _escalations.removeWhere((item) => item['orderId'] == orderId);
        return {
          'success': true,
          'message': 'Delay resolved · ${order['kotNumber']}',
        };
      case 'auto_escalate':
        if (order['escalated'] != true) {
          _escalateOrder(order, level ?? 'kitchen_manager');
        }
        return {
          'success': true,
          'message': 'Auto escalation · ${order['kotNumber']}',
        };
      default:
        throw ArgumentError('Unknown delay action: $action');
    }
  }

  static void _escalateOrder(Map<String, dynamic> order, String level) {
    order['status'] = 'delayed';
    order['escalated'] = true;
    order['escalationLevel'] = level;

    final existing = _escalations.cast<Map<String, dynamic>?>().firstWhere(
          (item) => item?['orderId'] == order['id'],
          orElse: () => null,
        );

    if (existing != null) {
      existing['level'] = level;
      existing['updatedAt'] = DateTime.now().toIso8601String();
      return;
    }

    _escalations.insert(0, {
      'id': 'ESC-${order['id']}',
      'orderId': order['id'],
      'kotNumber': order['kotNumber'],
      'section': order['section'],
      'level': level,
      'levelLabel': _levelLabel(level),
      'reason': order['delayReason'] ?? 'Delay threshold exceeded',
      'updatedAt': DateTime.now().toIso8601String(),
    });
  }

  static String _levelLabel(String level) {
    return switch (level) {
      'chef' => 'Chef alert',
      'kitchen_manager' => 'Kitchen manager alert',
      'operations' => 'Operations alert',
      _ => level,
    };
  }

  static Map<String, dynamic> _serializeDelayOrder(Map<String, dynamic> order) {
    final timer = order['timerSeconds'] as int;
    return {
      'orderId': order['id'],
      'kotNumber': order['kotNumber'],
      'section': order['section'],
      'location': order['location'],
      'status': order['status'],
      'delayMinutes': timer ~/ 60,
      'timerLabel': _formatTimer(timer),
      'delayReason': order['delayReason'],
      'escalated': order['escalated'] == true,
      'escalationLevel': order['escalationLevel'],
      'availableActions': _availableActions(order),
    };
  }

  static List<String> _availableActions(Map<String, dynamic> order) {
    final actions = <String>['log_reason', 'escalate_chef'];
    if (order['escalated'] == true) {
      actions.addAll(['escalate_manager', 'escalate_operations', 'resolve']);
    } else {
      actions.addAll(['auto_escalate', 'escalate_manager']);
    }
    return actions;
  }

  static String _formatTimer(int seconds) {
    final minutes = seconds ~/ 60;
    final remainder = seconds % 60;
    return '${minutes.toString().padLeft(2, '0')}:${remainder.toString().padLeft(2, '0')}';
  }

  static List<Map<String, dynamic>> _seedHistory() {
    return [
      {
        'id': 'HIS-001',
        'orderId': 'ORD-1844',
        'kotNumber': 'KOT #1844',
        'section': 'Chinese',
        'reason': 'Rider waiting · wok station backlog',
        'loggedAt': DateTime.now()
            .subtract(const Duration(minutes: 18))
            .toIso8601String(),
      },
      {
        'id': 'HIS-002',
        'orderId': 'ORD-1847',
        'kotNumber': 'KOT #1847',
        'section': 'Grill',
        'reason': 'QC hold · seafood temperature check',
        'loggedAt': DateTime.now()
            .subtract(const Duration(minutes: 42))
            .toIso8601String(),
      },
    ];
  }

  static List<Map<String, dynamic>> _seedEscalations() {
    return [
      {
        'id': 'ESC-ORD-1844',
        'orderId': 'ORD-1844',
        'kotNumber': 'KOT #1844',
        'section': 'Chinese',
        'level': 'kitchen_manager',
        'levelLabel': 'Kitchen manager alert',
        'reason': 'Express delivery delay · 16 min over SLA',
        'updatedAt': DateTime.now()
            .subtract(const Duration(minutes: 8))
            .toIso8601String(),
      },
    ];
  }
}

class MockDelayEscalationEngine {
  const MockDelayEscalationEngine._();

  static Map<String, dynamic> buildSnapshot({String section = 'All'}) {
    final delayedOrders = MockDelayEscalationRegistry.delayedOrdersFor(section);
    final history = MockDelayEscalationRegistry.historyFor(section);
    final escalations = MockDelayEscalationRegistry.escalationsFor(section);
    final bottlenecks = MockDelayEscalationRegistry.bottlenecksFor(section);

    return {
      'section': section,
      'lastSyncedAt': DateTime.now().toIso8601String(),
      'delayedOrders': delayedOrders,
      'history': history,
      'escalations': escalations,
      'bottlenecks': bottlenecks,
      'stats': {
        'delayedOrders': delayedOrders.length,
        'openEscalations': escalations.length,
        'historyEvents': history.length,
        'bottlenecks': bottlenecks.length,
        'chefAlerts': escalations.where((e) => e['level'] == 'chef').length,
        'managerAlerts':
            escalations.where((e) => e['level'] == 'kitchen_manager').length,
        'operationsAlerts':
            escalations.where((e) => e['level'] == 'operations').length,
      },
      'delayFeatures': {
        'delayTimer': delayedOrders.isNotEmpty,
        'delayReasonLogging': history.isNotEmpty,
        'autoEscalation': escalations.isNotEmpty,
        'delayHistory': history.isNotEmpty,
        'bottleneckDetection': bottlenecks.isNotEmpty,
        'chefAlert': escalations.any((e) => e['level'] == 'chef'),
        'kitchenManagerAlert':
            escalations.any((e) => e['level'] == 'kitchen_manager'),
        'operationsAlert':
            escalations.any((e) => e['level'] == 'operations'),
      },
      'sections': MockSectionRegistry.filterSections,
    };
  }
}
