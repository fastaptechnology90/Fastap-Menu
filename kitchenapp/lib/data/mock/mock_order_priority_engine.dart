import 'mock_dashboard_calculator.dart';
import 'mock_order_store.dart';
import 'mock_section_registry.dart';

class MockOrderPriorityEngine {
  const MockOrderPriorityEngine._();

  static Map<String, dynamic> buildSnapshot({String section = 'All'}) {
    MockOrderStore.tickTimers();
    var orders = MockOrderStore.activeOrders(section);
    orders = _sortByPriorityScore(orders);

    final serialized = orders.map(_serializePriorityOrder).toList();
    final lanes = _priorityLanes(orders);
    final alerts = _activeAlerts(orders);

    return {
      'section': section,
      'lastSyncedAt': DateTime.now().toIso8601String(),
      'orders': serialized,
      'lanes': lanes,
      'alerts': alerts,
      'stats': {
        'total': serialized.length,
        'vip': orders.where((o) => _priorityType(o) == 'vip').length,
        'express': orders.where((o) => _priorityType(o) == 'express').length,
        'roomService':
            orders.where((o) => _priorityType(o) == 'room_service').length,
        'event': orders.where((o) => _priorityType(o) == 'event').length,
        'delivery': orders.where((o) => _priorityType(o) == 'delivery').length,
        'childMeal': orders.where((o) => _priorityType(o) == 'child_meal').length,
        'flashAlerts': orders.where((o) => o['flashAlert'] == true).length,
        'escalated': orders.where((o) => o['escalated'] == true).length,
      },
      'priorityEngine': {
        'vipPrioritization': true,
        'expressLane': true,
        'roomServicePriority': true,
        'eventPriority': true,
        'deliveryPriority': true,
        'childMealPriority': true,
        'queueJump': true,
        'flashAlert': alerts.any((a) => a['type'] == 'flash'),
        'soundAlert': alerts.any((a) => a['type'] == 'sound'),
        'autoEscalation': orders.any((o) => o['escalated'] == true),
        'autoReassignment': true,
      },
      'sections': MockSectionRegistry.filterSections,
    };
  }

  static Map<String, dynamic> reprioritizeQueue() {
    MockOrderStore.autoSortQueue();
    return {
      'success': true,
      'message': 'Priority engine reprioritized · VIP, express, and rush lanes updated',
    };
  }

  static Map<String, dynamic> performAction(String orderId, String action) {
    return MockOrderStore.performPriorityAction(orderId, action);
  }

  static List<Map<String, dynamic>> _sortByPriorityScore(
    List<Map<String, dynamic>> orders,
  ) {
    final sorted = [...orders];
    sorted.sort((a, b) => _priorityScore(b).compareTo(_priorityScore(a)));
    return sorted;
  }

  static int _priorityScore(Map<String, dynamic> order) {
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
    if (order['priority'] == 'event') {
      value += 250;
    }
    if (order['priority'] == 'delivery' || order['guestType'] == 'Delivery') {
      value += 220;
    }
    if (order['deliveryType'] == 'Room service') {
      value += 180;
    }
    if (order['childMeal'] == true) {
      value += 160;
    }
    if (order['status'] == 'new') {
      value += 200;
    }
    if (order['status'] == 'on_hold') {
      value -= 800;
    }
    if (order['flashAlert'] == true) {
      value += 120;
    }
    if (order['escalated'] == true) {
      value += 90;
    }
    value -= order['sortOrder'] as int;
    return value;
  }

  static String _priorityType(Map<String, dynamic> order) {
    if (order['vip'] == true || order['priority'] == 'vip') {
      return 'vip';
    }
    if (order['childMeal'] == true) {
      return 'child_meal';
    }
    if (order['priority'] == 'express') {
      return 'express';
    }
    if (order['deliveryType'] == 'Room service' ||
        order['roomNumber'] != null) {
      return 'room_service';
    }
    if (order['priority'] == 'event' || order['guestType'] == 'Event') {
      return 'event';
    }
    if (order['priority'] == 'delivery' ||
        order['guestType'] == 'Delivery' ||
        {'Swiggy', 'Zomato'}.contains(order['deliveryType'])) {
      return 'delivery';
    }
    return 'standard';
  }

  static String _priorityLabel(String type) {
    return switch (type) {
      'vip' => 'VIP order',
      'express' => 'Express order',
      'room_service' => 'Room service priority',
      'event' => 'Event priority',
      'delivery' => 'Delivery priority',
      'child_meal' => 'Child meal priority',
      _ => 'Standard queue',
    };
  }

  static List<Map<String, dynamic>> _priorityLanes(
    List<Map<String, dynamic>> orders,
  ) {
    const laneTypes = [
      'vip',
      'express',
      'room_service',
      'event',
      'delivery',
      'child_meal',
    ];

    return laneTypes
        .map((type) {
          final laneOrders = orders.where((o) => _priorityType(o) == type);
          return {
            'type': type,
            'label': _priorityLabel(type),
            'count': laneOrders.length,
            'orderIds': laneOrders.map((o) => o['id']).take(4).toList(),
          };
        })
        .where((lane) => (lane['count'] as int) > 0)
        .toList();
  }

  static List<Map<String, dynamic>> _activeAlerts(
    List<Map<String, dynamic>> orders,
  ) {
    final alerts = <Map<String, dynamic>>[];

    for (final order in orders) {
      if (order['flashAlert'] == true) {
        alerts.add({
          'id': 'FLASH-${order['id']}',
          'type': 'flash',
          'orderId': order['id'],
          'kotNumber': order['kotNumber'],
          'message': 'Flash alert active · ${order['kotNumber']}',
        });
      }
      if (order['soundAlert'] == true) {
        alerts.add({
          'id': 'SOUND-${order['id']}',
          'type': 'sound',
          'orderId': order['id'],
          'kotNumber': order['kotNumber'],
          'message': 'Sound alert active · ${order['kotNumber']}',
        });
      }
      if (order['escalated'] == true) {
        alerts.add({
          'id': 'ESC-${order['id']}',
          'type': 'escalation',
          'orderId': order['id'],
          'kotNumber': order['kotNumber'],
          'message': 'Auto escalation · supervisor loop engaged',
        });
      }
    }

    return alerts.take(6).toList();
  }

  static Map<String, dynamic> _serializePriorityOrder(
    Map<String, dynamic> order,
  ) {
    final type = _priorityType(order);
    final base = MockDashboardCalculator.serializeOrder(order);
    return {
      ...base,
      'priorityType': type,
      'priorityLabel': _priorityLabel(type),
      'priorityScore': _priorityScore(order),
      'queuePosition': order['sortOrder'],
      'flashAlert': order['flashAlert'] == true,
      'soundAlert': order['soundAlert'] == true,
      'escalated': order['escalated'] == true,
      'availableActions': MockOrderStore.availablePriorityActions(order),
    };
  }
}
