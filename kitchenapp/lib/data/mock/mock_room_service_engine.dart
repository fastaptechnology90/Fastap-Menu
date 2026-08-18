import 'mock_order_store.dart';
import 'mock_section_registry.dart';

class MockRoomServiceRegistry {
  MockRoomServiceRegistry._();

  static final Map<String, Map<String, dynamic>> _orders = _seedOrders();
  static final List<Map<String, dynamic>> _vipAlerts = _seedVipAlerts();
  static final List<Map<String, dynamic>> _scheduled = _seedScheduled();
  static final List<Map<String, dynamic>> _trays = _seedTrays();
  static final List<Map<String, dynamic>> _miniBar = _seedMiniBar();
  static int _completedToday = 11;

  static List<Map<String, dynamic>> roomOrdersFor(String section) {
    _syncFromOrderStore();
    final items = section == 'All'
        ? _orders.values
        : _orders.values.where((order) => order['section'] == section);
    return items
        .where((order) => order['status'] != 'completed')
        .map(_serializeOrder)
        .toList();
  }

  static List<Map<String, dynamic>> vipAlertsFor(String section) {
    if (section == 'All') {
      return _vipAlerts.map(Map<String, dynamic>.from).toList();
    }
    return _vipAlerts
        .where((alert) {
          final order = _findByRoom(alert['roomNumber'] as String);
          return order?['section'] == section;
        })
        .map(Map<String, dynamic>.from)
        .toList();
  }

  static List<Map<String, dynamic>> scheduledFor(String section) {
    if (section == 'All') {
      return _scheduled.map(Map<String, dynamic>.from).toList();
    }
    return _scheduled
        .where((entry) {
          final order = _orders.values.cast<Map<String, dynamic>?>().firstWhere(
                (item) => item?['orderId'] == entry['orderId'],
                orElse: () => null,
              );
          return order?['section'] == section;
        })
        .map(Map<String, dynamic>.from)
        .toList();
  }

  static List<Map<String, dynamic>> traysFor(String section) {
    if (section == 'All') {
      return _trays.map(Map<String, dynamic>.from).toList();
    }
    return _trays
        .where((tray) {
          final order = _orders.values.cast<Map<String, dynamic>?>().firstWhere(
                (item) => item?['orderId'] == tray['orderId'],
                orElse: () => null,
              );
          return order?['section'] == section;
        })
        .map(Map<String, dynamic>.from)
        .toList();
  }

  static List<Map<String, dynamic>> miniBarFor(String section) {
    return _miniBar.map(Map<String, dynamic>.from).toList();
  }

  static Map<String, dynamic> performAction({
    required String orderId,
    required String action,
    String? trayId,
    String? scheduledTime,
  }) {
    final order = _findByOrderId(orderId);
    if (order == null) {
      throw ArgumentError('Room service order not found');
    }

    final storeOrder = MockOrderStore.findById(orderId);
    final kotNumber = order['kotNumber'] as String;
    final roomNumber = order['roomNumber'] as String;

    switch (action) {
      case 'acknowledge_vip':
        order['priority'] = 'vip_acknowledged';
        _vipAlerts.removeWhere((alert) => alert['roomNumber'] == roomNumber);
        return {
          'success': true,
          'message': 'VIP priority acknowledged · Room $roomNumber',
        };
      case 'start_preparation':
        order['status'] = 'preparing';
        storeOrder?['status'] = 'preparing';
        return {
          'success': true,
          'message': 'Preparation started · $kotNumber',
        };
      case 'schedule_delivery':
        order['status'] = 'scheduled';
        _scheduled.add({
          'id': 'SCH-$orderId',
          'orderId': orderId,
          'kotNumber': kotNumber,
          'roomNumber': roomNumber,
          'scheduledTime': scheduledTime ?? '20:30',
          'itemSummary': order['itemSummary'],
          'status': 'scheduled',
        });
        return {
          'success': true,
          'message': 'Delivery scheduled · Room $roomNumber',
        };
      case 'assign_tray':
        final tray = trayId ?? 'TRAY-${DateTime.now().millisecondsSinceEpoch}';
        _trays.insert(0, {
          'id': 'ASG-$orderId',
          'trayId': tray,
          'roomNumber': roomNumber,
          'orderId': orderId,
          'kotNumber': kotNumber,
          'staffName': 'Room Service Staff',
          'status': 'assigned',
        });
        order['status'] = 'tray_assigned';
        return {
          'success': true,
          'message': 'Tray assigned · $tray · Room $roomNumber',
        };
      case 'sync_minibar':
        for (final item in _miniBar) {
          if (item['roomNumber'] == roomNumber) {
            item['syncStatus'] = 'synced';
            item['lastSyncedAt'] = DateTime.now().toIso8601String();
          }
        }
        return {
          'success': true,
          'message': 'Mini-bar synced · Room $roomNumber',
        };
      case 'dispatch_tray':
        order['status'] = 'in_transit';
        final tray = _trays.cast<Map<String, dynamic>?>().firstWhere(
              (item) => item?['orderId'] == orderId,
              orElse: () => null,
            );
        tray?['status'] = 'in_transit';
        storeOrder?['status'] = 'ready';
        return {
          'success': true,
          'message': 'Tray dispatched · Room $roomNumber',
        };
      case 'complete_order':
        order['status'] = 'completed';
        order['timerSeconds'] = 0;
        storeOrder?['status'] = 'served';
        storeOrder?['progress'] = 1.0;
        _completedToday++;
        return {
          'success': true,
          'message': 'Order completed · $kotNumber',
        };
      case 'hold_order':
        order['status'] = 'on_hold';
        return {
          'success': true,
          'message': 'Order held · $kotNumber',
        };
      default:
        throw ArgumentError('Unknown room service action: $action');
    }
  }

  static Map<String, dynamic> dispatchTray({String? orderId}) {
    if (orderId != null) {
      return performAction(orderId: orderId, action: 'dispatch_tray');
    }

    var count = 0;
    for (final order in _orders.values) {
      if (order['status'] == 'tray_assigned') {
        performAction(
          orderId: order['orderId'] as String,
          action: 'dispatch_tray',
        );
        count++;
      }
    }

    return {
      'success': true,
      'message': count == 0
          ? 'No trays ready for dispatch'
          : 'Dispatched $count room service trays',
    };
  }

  static Map<String, dynamic>? _findByOrderId(String orderId) {
    return _orders.values.cast<Map<String, dynamic>?>().firstWhere(
          (item) => item?['orderId'] == orderId,
          orElse: () => null,
        );
  }

  static Map<String, dynamic>? _findByRoom(String roomNumber) {
    return _orders.values.cast<Map<String, dynamic>?>().firstWhere(
          (item) => item?['roomNumber'] == roomNumber,
          orElse: () => null,
        );
  }

  static void _syncFromOrderStore() {
    for (final order in MockOrderStore.activeOrders('All')) {
      if (order['deliveryType'] != 'Room service') {
        continue;
      }

      final orderId = order['id'] as String;
      final key = 'RS-$orderId';
      if (_orders.containsKey(key)) {
        final existing = _orders[key]!;
        if (existing['status'] == 'preparing') {
          existing['timerSeconds'] = order['timerSeconds'];
        }
        continue;
      }

      final built = _buildOrder(order);
      _orders[key] = built;

      if (built['priority'] == 'vip' || order['vip'] == true) {
        _vipAlerts.add({
          'id': 'VIP-$orderId',
          'roomNumber': built['roomNumber'],
          'guestName': '${built['guestType']} guest',
          'alertType': 'priority_service',
          'priority': 'vip',
          'status': 'active',
        });
      }
    }
  }

  static Map<String, dynamic> _buildOrder(Map<String, dynamic> order) {
    final items = order['items'] as List<dynamic>;
    return {
      'id': 'RS-${order['id']}',
      'orderId': order['id'],
      'kotNumber': order['kotNumber'],
      'roomNumber': order['roomNumber'] ?? order['location'],
      'section': order['section'],
      'guestType': order['guestType'],
      'itemSummary': items.isEmpty ? 'Room service item' : items.join(' · '),
      'status': order['status'] == 'served' ? 'completed' : 'queued',
      'priority': order['priority'] ?? 'normal',
      'timerSeconds': order['timerSeconds'] as int,
    };
  }

  static String _formatTimer(int seconds) {
    final minutes = seconds ~/ 60;
    final remainder = seconds % 60;
    return '${minutes.toString().padLeft(2, '0')}:${remainder.toString().padLeft(2, '0')}';
  }

  static Map<String, dynamic> _serializeOrder(Map<String, dynamic> order) {
    return {
      'id': order['id'],
      'orderId': order['orderId'],
      'kotNumber': order['kotNumber'],
      'roomNumber': order['roomNumber'],
      'section': order['section'],
      'guestType': order['guestType'],
      'itemSummary': order['itemSummary'],
      'status': order['status'],
      'priority': order['priority'],
      'timerSeconds': order['timerSeconds'],
      'timerLabel': _formatTimer(order['timerSeconds'] as int),
      'availableActions': _availableActions(order),
    };
  }

  static List<String> _availableActions(Map<String, dynamic> order) {
    if (order['status'] == 'completed') {
      return const [];
    }

    final actions = <String>['start_preparation', 'schedule_delivery'];
    if (order['priority'] == 'vip' || order['priority'] == 'vip_acknowledged') {
      actions.insert(0, 'acknowledge_vip');
    }
    if (order['status'] == 'preparing' ||
        order['status'] == 'scheduled' ||
        order['status'] == 'tray_assigned') {
      actions.addAll(['assign_tray', 'sync_minibar', 'dispatch_tray']);
    }
    if (order['status'] == 'in_transit' || order['status'] == 'preparing') {
      actions.add('complete_order');
    }
    actions.add('hold_order');
    return actions;
  }

  static Map<String, Map<String, dynamic>> _seedOrders() {
    return {
      'RS-ORD-1843': {
        'id': 'RS-ORD-1843',
        'orderId': 'ORD-1843',
        'kotNumber': 'KOT #1843',
        'roomNumber': '804',
        'section': 'Main',
        'guestType': 'VIP',
        'itemSummary': 'Dal makhani · Steamed rice',
        'status': 'preparing',
        'priority': 'vip',
        'timerSeconds': 282,
      },
      'RS-ORD-1852': {
        'id': 'RS-ORD-1852',
        'orderId': 'ORD-1852',
        'kotNumber': 'KOT #1852',
        'roomNumber': '215',
        'section': 'Continental',
        'guestType': 'Regular',
        'itemSummary': 'Club sandwich · Fries',
        'status': 'scheduled',
        'priority': 'normal',
        'timerSeconds': 0,
      },
      'RS-ORD-1853': {
        'id': 'RS-ORD-1853',
        'orderId': 'ORD-1853',
        'kotNumber': 'KOT #1853',
        'roomNumber': '1205',
        'section': 'Main',
        'guestType': 'VIP',
        'itemSummary': 'Grilled salmon · Mashed potato',
        'status': 'queued',
        'priority': 'vip',
        'timerSeconds': 0,
      },
    };
  }

  static List<Map<String, dynamic>> _seedVipAlerts() {
    return [
      {
        'id': 'VIP-804',
        'roomNumber': '804',
        'guestName': 'VIP guest · Suite 804',
        'alertType': 'allergy_protocol',
        'priority': 'vip',
        'status': 'active',
      },
      {
        'id': 'VIP-1205',
        'roomNumber': '1205',
        'guestName': 'Presidential suite guest',
        'alertType': 'priority_service',
        'priority': 'vip',
        'status': 'active',
      },
    ];
  }

  static List<Map<String, dynamic>> _seedScheduled() {
    return [
      {
        'id': 'SCH-1852',
        'orderId': 'ORD-1852',
        'kotNumber': 'KOT #1852',
        'roomNumber': '215',
        'scheduledTime': '20:30',
        'itemSummary': 'Club sandwich · Fries',
        'status': 'scheduled',
      },
    ];
  }

  static List<Map<String, dynamic>> _seedTrays() {
    return [
      {
        'id': 'ASG-1843',
        'trayId': 'TRAY-441',
        'roomNumber': '804',
        'orderId': 'ORD-1843',
        'kotNumber': 'KOT #1843',
        'staffName': 'Ravi Kumar',
        'status': 'assigned',
      },
    ];
  }

  static List<Map<String, dynamic>> _seedMiniBar() {
    return [
      {
        'id': 'MB-804',
        'roomNumber': '804',
        'itemName': 'Mineral water',
        'quantity': 2,
        'syncStatus': 'pending',
        'lastSyncedAt': '12m ago',
      },
      {
        'id': 'MB-1205',
        'roomNumber': '1205',
        'itemName': 'Sparkling wine',
        'quantity': 1,
        'syncStatus': 'pending',
        'lastSyncedAt': '5m ago',
      },
      {
        'id': 'MB-215',
        'roomNumber': '215',
        'itemName': 'Soft drinks combo',
        'quantity': 3,
        'syncStatus': 'synced',
        'lastSyncedAt': 'Just now',
      },
    ];
  }

  static int get completedToday => _completedToday;
}

class MockRoomServiceEngine {
  const MockRoomServiceEngine._();

  static Map<String, dynamic> buildSnapshot({String section = 'All'}) {
    final roomOrders = MockRoomServiceRegistry.roomOrdersFor(section);
    final vipRoomAlerts = MockRoomServiceRegistry.vipAlertsFor(section);
    final scheduledDeliveries = MockRoomServiceRegistry.scheduledFor(section);
    final trayAssignments = MockRoomServiceRegistry.traysFor(section);
    final miniBarSync = MockRoomServiceRegistry.miniBarFor(section);

    return {
      'section': section,
      'lastSyncedAt': DateTime.now().toIso8601String(),
      'roomOrders': roomOrders,
      'vipRoomAlerts': vipRoomAlerts,
      'scheduledDeliveries': scheduledDeliveries,
      'trayAssignments': trayAssignments,
      'miniBarSync': miniBarSync,
      'stats': {
        'activeRoomOrders': roomOrders.length,
        'vipRooms': vipRoomAlerts.length,
        'scheduledDeliveries': scheduledDeliveries.length,
        'traysInTransit': trayAssignments
            .where((tray) => tray['status'] == 'in_transit')
            .length,
        'miniBarPending': miniBarSync
            .where((item) => item['syncStatus'] == 'pending')
            .length,
        'completedToday': MockRoomServiceRegistry.completedToday,
      },
      'roomServiceFeatures': {
        'roomWiseOrderTracking': roomOrders.isNotEmpty,
        'vipRoomPriority': vipRoomAlerts.isNotEmpty,
        'scheduledRoomDelivery': scheduledDeliveries.isNotEmpty,
        'trayManagement': trayAssignments.isNotEmpty,
        'miniBarSynchronization': miniBarSync.isNotEmpty,
      },
      'sections': MockSectionRegistry.filterSections,
    };
  }
}
