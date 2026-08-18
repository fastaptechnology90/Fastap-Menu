import 'mock_order_store.dart';
import 'mock_section_registry.dart';

class MockCloudKitchenRegistry {
  MockCloudKitchenRegistry._();

  static final List<Map<String, dynamic>> _brandLanes = _seedBrandLanes();
  static final Map<String, Map<String, dynamic>> _orders = _seedOrders();
  static final List<Map<String, dynamic>> _deliveryQueue = _seedDeliveryQueue();
  static final List<Map<String, dynamic>> _loadBalance = _seedLoadBalance();
  static final List<Map<String, dynamic>> _sharedInventory =
      _seedSharedInventory();
  static int _completedToday = 14;

  static List<Map<String, dynamic>> brandLanesFor(String section) {
    if (section == 'All') {
      return _brandLanes.map(Map<String, dynamic>.from).toList();
    }
    return _brandLanes
        .where((lane) => lane['section'] == section)
        .map(Map<String, dynamic>.from)
        .toList();
  }

  static List<Map<String, dynamic>> ordersFor(String section) {
    _syncFromOrderStore();
    final items = section == 'All'
        ? _orders.values
        : _orders.values.where((order) => order['section'] == section);
    return items
        .where((order) => order['status'] != 'completed')
        .map(_serializeOrder)
        .toList();
  }

  static List<Map<String, dynamic>> deliveryQueueFor(String section) {
    _syncFromOrderStore();
    if (section == 'All') {
      return _deliveryQueue.map(Map<String, dynamic>.from).toList();
    }
    return _deliveryQueue
        .where((entry) {
          final order = _orders[entry['orderId']];
          return order?['section'] == section;
        })
        .map(Map<String, dynamic>.from)
        .toList();
  }

  static List<Map<String, dynamic>> loadBalanceFor(String section) {
    if (section == 'All') {
      return _loadBalance.map(Map<String, dynamic>.from).toList();
    }
    return _loadBalance
        .where((slot) => slot['section'] == section)
        .map(Map<String, dynamic>.from)
        .toList();
  }

  static List<Map<String, dynamic>> sharedInventoryFor(String section) {
    return _sharedInventory.map(Map<String, dynamic>.from).toList();
  }

  static Map<String, dynamic> performAction({
    required String orderId,
    required String action,
    String? brandId,
  }) {
    final order = _orders.values.cast<Map<String, dynamic>?>().firstWhere(
          (item) => item?['orderId'] == orderId,
          orElse: () => null,
        );
    if (order == null) {
      throw ArgumentError('Cloud kitchen order not found');
    }

    final storeOrder = MockOrderStore.findById(orderId);
    final kotNumber = order['kotNumber'] as String;
    final brandName = order['brandName'] as String;

    switch (action) {
      case 'segregate_brand':
        order['status'] = 'segregated';
        if (brandId != null) {
          final lane = _brandLanes.firstWhere(
            (item) => item['id'] == brandId,
            orElse: () => _brandLanes.first,
          );
          order['brandId'] = lane['id'];
          order['brandName'] = lane['brandName'];
        }
        return {
          'success': true,
          'message': 'Brand lane assigned · $brandName · $kotNumber',
        };
      case 'accept_delivery':
        order['status'] = 'accepted';
        storeOrder?['status'] = 'accepted';
        _updateDeliveryEntry(orderId, 'accepted');
        return {
          'success': true,
          'message': 'Delivery accepted · $kotNumber',
        };
      case 'route_section':
        order['status'] = 'preparing';
        storeOrder?['status'] = 'preparing';
        _incrementLaneLoad(order['brandId'] as String);
        return {
          'success': true,
          'message': 'Routed to ${order['section']} · $kotNumber',
        };
      case 'complete_order':
        order['status'] = 'completed';
        order['timerSeconds'] = 0;
        storeOrder?['status'] = 'ready';
        storeOrder?['progress'] = 1.0;
        _decrementLaneLoad(order['brandId'] as String);
        _updateDeliveryEntry(orderId, 'ready');
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
        throw ArgumentError('Unknown cloud kitchen action: $action');
    }
  }

  static Map<String, dynamic> balanceLoad() {
    for (final slot in _loadBalance) {
      if ((slot['queueDepth'] as int) > (slot['capacity'] as int)) {
        slot['queueDepth'] =
            ((slot['queueDepth'] as int) - 2).clamp(0, slot['capacity'] as int);
        slot['recommendation'] = 'balanced';
      }
    }

    for (final lane in _brandLanes) {
      if ((lane['loadPercent'] as int) > 80) {
        lane['loadPercent'] = (lane['loadPercent'] as int) - 8;
        lane['status'] = 'balanced';
      }
    }

    return {
      'success': true,
      'message': 'Kitchen load balanced across brand lanes',
    };
  }

  static void _updateDeliveryEntry(String orderId, String status) {
    for (final entry in _deliveryQueue) {
      if (entry['orderId'] == orderId) {
        entry['status'] = status;
        break;
      }
    }
  }

  static void _incrementLaneLoad(String brandId) {
    final lane = _brandLanes.cast<Map<String, dynamic>?>().firstWhere(
          (item) => item?['id'] == brandId,
          orElse: () => null,
        );
    if (lane == null) {
      return;
    }
    lane['activeOrders'] = (lane['activeOrders'] as int) + 1;
    lane['loadPercent'] = ((lane['loadPercent'] as int) + 5).clamp(0, 100);
    lane['status'] =
        (lane['loadPercent'] as int) > 85 ? 'overloaded' : 'active';
  }

  static void _decrementLaneLoad(String brandId) {
    final lane = _brandLanes.cast<Map<String, dynamic>?>().firstWhere(
          (item) => item?['id'] == brandId,
          orElse: () => null,
        );
    if (lane == null) {
      return;
    }
    lane['activeOrders'] = ((lane['activeOrders'] as int) - 1).clamp(0, 99);
    lane['loadPercent'] = ((lane['loadPercent'] as int) - 4).clamp(0, 100);
    lane['status'] = 'active';
  }

  static void _syncFromOrderStore() {
    for (final order in MockOrderStore.activeOrders('All')) {
      final deliveryType = order['deliveryType'] as String? ?? '';
      if (deliveryType != 'Delivery' && deliveryType != 'Aggregator') {
        continue;
      }

      final orderId = order['id'] as String;
      final key = 'CK-$orderId';
      if (_orders.containsKey(key)) {
        final existing = _orders[key]!;
        if (existing['status'] == 'preparing') {
          existing['timerSeconds'] = order['timerSeconds'];
        }
        continue;
      }

      final built = _buildOrder(order);
      _orders[key] = built;
      _deliveryQueue.add({
        'id': 'DLV-$orderId',
        'orderId': orderId,
        'kotNumber': order['kotNumber'],
        'brandName': built['brandName'],
        'platform': built['channel'],
        'riderEtaMinutes': 12,
        'status': 'pending',
        'priority': order['priority'] == 'high' ? 'rush' : 'normal',
      });
    }
  }

  static Map<String, dynamic> _buildOrder(Map<String, dynamic> order) {
    final items = order['items'] as List<dynamic>;
    final itemSummary =
        items.isEmpty ? 'Multi-brand item' : items.take(2).join(' · ');
    final section = order['section'] as String;
    final brand = _brandForSection(section);

    return {
      'id': 'CK-${order['id']}',
      'orderId': order['id'],
      'kotNumber': order['kotNumber'],
      'brandName': brand['brandName'],
      'brandId': brand['id'],
      'section': section,
      'channel': _channelForOrder(order),
      'itemSummary': itemSummary,
      'deliveryType': order['deliveryType'],
      'status': 'queued',
      'timerSeconds': order['timerSeconds'] as int,
    };
  }

  static Map<String, dynamic> _brandForSection(String section) {
    return switch (section) {
      'Chinese' => _brandLanes[1],
      'Tandoor' => _brandLanes[0],
      'Continental' => _brandLanes[2],
      'Indian' => _brandLanes[3],
      _ => _brandLanes[0],
    };
  }

  static String _channelForOrder(Map<String, dynamic> order) {
    final location = order['location'] as String? ?? '';
    if (location.contains('Swiggy')) {
      return 'Swiggy';
    }
    if (location.contains('Zomato')) {
      return 'Zomato';
    }
    if (location.contains('ONDC')) {
      return 'ONDC';
    }
    return 'Direct delivery';
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
      'brandName': order['brandName'],
      'brandId': order['brandId'],
      'section': order['section'],
      'channel': order['channel'],
      'itemSummary': order['itemSummary'],
      'deliveryType': order['deliveryType'],
      'status': order['status'],
      'timerSeconds': order['timerSeconds'],
      'timerLabel': _formatTimer(order['timerSeconds'] as int),
      'availableActions': _availableActions(order),
    };
  }

  static List<String> _availableActions(Map<String, dynamic> order) {
    if (order['status'] == 'completed') {
      return const [];
    }

    final actions = <String>[
      'segregate_brand',
      'accept_delivery',
      'route_section',
    ];

    if (order['status'] == 'preparing' ||
        order['status'] == 'accepted' ||
        order['status'] == 'segregated') {
      actions.add('complete_order');
    }

    actions.add('hold_order');
    return actions;
  }

  static List<Map<String, dynamic>> _seedBrandLanes() {
    return [
      {
        'id': 'BRD-FASTAP',
        'brandName': 'Fastap Kitchen',
        'cuisine': 'North Indian',
        'section': 'Tandoor',
        'activeOrders': 5,
        'loadPercent': 72,
        'status': 'active',
        'colorTag': 'primary',
      },
      {
        'id': 'BRD-SPICE',
        'brandName': 'Spice Route',
        'cuisine': 'Pan-Asian',
        'section': 'Chinese',
        'activeOrders': 7,
        'loadPercent': 85,
        'status': 'overloaded',
        'colorTag': 'warning',
      },
      {
        'id': 'BRD-GREEN',
        'brandName': 'Green Bowl Express',
        'cuisine': 'Salads & Bowls',
        'section': 'Continental',
        'activeOrders': 3,
        'loadPercent': 45,
        'status': 'active',
        'colorTag': 'info',
      },
      {
        'id': 'BRD-BIRYANI',
        'brandName': 'Biryani House',
        'cuisine': 'Hyderabadi Biryani',
        'section': 'Indian',
        'activeOrders': 8,
        'loadPercent': 91,
        'status': 'overloaded',
        'colorTag': 'danger',
      },
    ];
  }

  static Map<String, Map<String, dynamic>> _seedOrders() {
    return {
      'CK-ORD-1901': {
        'id': 'CK-ORD-1901',
        'orderId': 'ORD-1901',
        'kotNumber': 'KOT #1901',
        'brandName': 'Fastap Kitchen',
        'brandId': 'BRD-FASTAP',
        'section': 'Tandoor',
        'channel': 'Swiggy',
        'itemSummary': 'Butter chicken · Garlic naan',
        'deliveryType': 'Delivery',
        'status': 'preparing',
        'timerSeconds': 540,
      },
      'CK-ORD-1902': {
        'id': 'CK-ORD-1902',
        'orderId': 'ORD-1902',
        'kotNumber': 'KOT #1902',
        'brandName': 'Spice Route',
        'brandId': 'BRD-SPICE',
        'section': 'Chinese',
        'channel': 'Zomato',
        'itemSummary': 'Hakka noodles · Manchurian',
        'deliveryType': 'Delivery',
        'status': 'segregated',
        'timerSeconds': 420,
      },
      'CK-ORD-1903': {
        'id': 'CK-ORD-1903',
        'orderId': 'ORD-1903',
        'kotNumber': 'KOT #1903',
        'brandName': 'Green Bowl Express',
        'brandId': 'BRD-GREEN',
        'section': 'Continental',
        'channel': 'ONDC',
        'itemSummary': 'Buddha bowl · Fresh juice',
        'deliveryType': 'Delivery',
        'status': 'queued',
        'timerSeconds': 0,
      },
      'CK-ORD-1904': {
        'id': 'CK-ORD-1904',
        'orderId': 'ORD-1904',
        'kotNumber': 'KOT #1904',
        'brandName': 'Biryani House',
        'brandId': 'BRD-BIRYANI',
        'section': 'Indian',
        'channel': 'Swiggy',
        'itemSummary': 'Hyderabadi biryani · Raita',
        'deliveryType': 'Delivery',
        'status': 'accepted',
        'timerSeconds': 660,
      },
    };
  }

  static List<Map<String, dynamic>> _seedDeliveryQueue() {
    return [
      {
        'id': 'DLV-ORD-1901',
        'orderId': 'ORD-1901',
        'kotNumber': 'KOT #1901',
        'brandName': 'Fastap Kitchen',
        'platform': 'Swiggy',
        'riderEtaMinutes': 8,
        'status': 'preparing',
        'priority': 'normal',
      },
      {
        'id': 'DLV-ORD-1902',
        'orderId': 'ORD-1902',
        'kotNumber': 'KOT #1902',
        'brandName': 'Spice Route',
        'platform': 'Zomato',
        'riderEtaMinutes': 5,
        'status': 'accepted',
        'priority': 'rush',
      },
      {
        'id': 'DLV-ORD-1904',
        'orderId': 'ORD-1904',
        'kotNumber': 'KOT #1904',
        'brandName': 'Biryani House',
        'platform': 'Swiggy',
        'riderEtaMinutes': 11,
        'status': 'accepted',
        'priority': 'normal',
      },
    ];
  }

  static List<Map<String, dynamic>> _seedLoadBalance() {
    return [
      {
        'section': 'Tandoor',
        'brandName': 'Fastap Kitchen',
        'queueDepth': 5,
        'capacity': 8,
        'recommendation': 'stable',
      },
      {
        'section': 'Chinese',
        'brandName': 'Spice Route',
        'queueDepth': 9,
        'capacity': 8,
        'recommendation': 'reroute',
      },
      {
        'section': 'Continental',
        'brandName': 'Green Bowl Express',
        'queueDepth': 3,
        'capacity': 6,
        'recommendation': 'accept_more',
      },
      {
        'section': 'Indian',
        'brandName': 'Biryani House',
        'queueDepth': 10,
        'capacity': 8,
        'recommendation': 'reroute',
      },
    ];
  }

  static List<Map<String, dynamic>> _seedSharedInventory() {
    return [
      {
        'id': 'INV-CK-001',
        'itemName': 'Basmati rice',
        'quantity': 12,
        'unit': 'kg',
        'sharedByBrands': [
          'Fastap Kitchen',
          'Biryani House',
          'Spice Route',
        ],
        'stockLevel': 'ok',
      },
      {
        'id': 'INV-CK-002',
        'itemName': 'Refined cooking oil',
        'quantity': 8,
        'unit': 'L',
        'sharedByBrands': ['Fastap Kitchen', 'Spice Route', 'Green Bowl Express'],
        'stockLevel': 'ok',
      },
      {
        'id': 'INV-CK-003',
        'itemName': 'Paneer blocks',
        'quantity': 4,
        'unit': 'kg',
        'sharedByBrands': ['Fastap Kitchen', 'Green Bowl Express'],
        'stockLevel': 'low',
      },
    ];
  }

  static int get completedToday => _completedToday;
}

class MockCloudKitchenEngine {
  const MockCloudKitchenEngine._();

  static Map<String, dynamic> buildSnapshot({String section = 'All'}) {
    final brandLanes = MockCloudKitchenRegistry.brandLanesFor(section);
    final brandOrders = MockCloudKitchenRegistry.ordersFor(section);
    final deliveryQueue = MockCloudKitchenRegistry.deliveryQueueFor(section);
    final loadBalance = MockCloudKitchenRegistry.loadBalanceFor(section);
    final sharedInventory = MockCloudKitchenRegistry.sharedInventoryFor(section);

    return {
      'section': section,
      'lastSyncedAt': DateTime.now().toIso8601String(),
      'brandLanes': brandLanes,
      'brandOrders': brandOrders,
      'deliveryQueue': deliveryQueue,
      'loadBalance': loadBalance,
      'sharedInventory': sharedInventory,
      'stats': {
        'activeBrands': brandLanes.length,
        'totalOrders': brandOrders.length,
        'deliveryPending': deliveryQueue
            .where((entry) => entry['status'] != 'ready')
            .length,
        'overloadedLanes':
            brandLanes.where((lane) => lane['status'] == 'overloaded').length,
        'sharedItems': sharedInventory.length,
        'completedToday': MockCloudKitchenRegistry.completedToday,
      },
      'cloudKitchenFeatures': {
        'multiBrandOrderManagement': brandOrders.isNotEmpty,
        'brandWiseSegregation': brandLanes.isNotEmpty,
        'deliveryOrderHandling': deliveryQueue.isNotEmpty,
        'kitchenLoadBalancing': loadBalance.isNotEmpty,
        'sharedInventoryVisibility': sharedInventory.isNotEmpty,
      },
      'sections': MockSectionRegistry.filterSections,
    };
  }
}
