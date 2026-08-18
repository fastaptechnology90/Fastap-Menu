import 'mock_order_store.dart';

import 'mock_section_registry.dart';



class MockDeliveryAggregatorRegistry {

  MockDeliveryAggregatorRegistry._();



  static final Map<String, Map<String, dynamic>> _orders = _seedOrders();

  static final List<Map<String, dynamic>> _riderAlerts = _seedRiderAlerts();

  static final List<Map<String, dynamic>> _dispatchTracking =

      _seedDispatchTracking();

  static int _dispatchedToday = 6;



  static List<Map<String, dynamic>> ordersFor(String section) {

    _syncFromOrderStore();

    final items = section == 'All'

        ? _orders.values

        : _orders.values.where((order) => order['section'] == section);

    return items

        .where((order) => order['dispatchStatus'] != 'dispatched')

        .map(_serializeOrder)

        .toList();

  }



  static List<Map<String, dynamic>> riderAlertsFor(String section) {

    final items = section == 'All'

        ? _riderAlerts

        : _riderAlerts.where((alert) {

            final order = _orders.values.cast<Map<String, dynamic>?>().firstWhere(

                  (item) => item?['orderId'] == alert['orderId'],

                  orElse: () => null,

                );

            return order?['section'] == section;

          });

    return items.map(Map<String, dynamic>.from).toList();

  }



  static List<Map<String, dynamic>> dispatchTrackingFor(String section) {

    if (section == 'All') {

      return _dispatchTracking.map(Map<String, dynamic>.from).toList();

    }

    return _dispatchTracking

        .where((entry) {

          final order = _findByOrderId(entry['orderId'] as String);

          return order?['section'] == section;

        })

        .map(Map<String, dynamic>.from)

        .toList();

  }



  static Map<String, dynamic> performAction({

    required String orderId,

    required String action,

  }) {

    final order = _findByOrderId(orderId);

    if (order == null) {

      throw ArgumentError('Aggregator order not found');

    }



    final storeOrder = MockOrderStore.findById(orderId);

    final kotNumber = order['kotNumber'] as String;



    switch (action) {

      case 'sync_order':

        order['syncStatus'] = 'synced';

        order['lastSyncedAt'] = DateTime.now().toIso8601String();

        return {

          'success': true,

          'message': 'Order synced · $kotNumber (${order['platform']})',

        };

      case 'acknowledge_rider':

        order['riderWaiting'] = false;

        _riderAlerts.removeWhere((alert) => alert['orderId'] == orderId);

        return {

          'success': true,

          'message': 'Rider alert acknowledged · $kotNumber',

        };

      case 'start_prep_timer':

        order['prepTimerSeconds'] = order['timerSeconds'] as int? ?? 600;

        order['dispatchStatus'] = 'preparing';

        storeOrder?['status'] = 'preparing';

        return {

          'success': true,

          'message': 'Prep timer started · $kotNumber',

        };

      case 'ready_for_pickup':

        order['dispatchStatus'] = 'ready_for_pickup';

        order['pickupCountdownSeconds'] = 300;

        storeOrder?['status'] = 'ready';

        _trackDispatch(orderId, kotNumber, order['platform'] as String, 'ready_for_pickup');

        return {

          'success': true,

          'message': 'Ready for pickup · $kotNumber',

        };

      case 'dispatch':

        order['dispatchStatus'] = 'dispatched';

        order['pickupCountdownSeconds'] = 0;

        storeOrder?['status'] = 'served';

        _dispatchedToday++;

        _trackDispatch(orderId, kotNumber, order['platform'] as String, 'dispatched');

        return {

          'success': true,

          'message': 'Dispatched to rider · $kotNumber',

        };

      case 'extend_countdown':

        order['pickupCountdownSeconds'] =

            (order['pickupCountdownSeconds'] as int) + 120;

        return {

          'success': true,

          'message': 'Pickup countdown extended · $kotNumber',

        };

      default:

        throw ArgumentError('Unknown aggregator action: $action');

    }

  }



  static Map<String, dynamic> syncAllOrders() {

    var count = 0;

    for (final order in _orders.values) {

      if (order['dispatchStatus'] != 'dispatched') {

        order['syncStatus'] = 'synced';

        order['lastSyncedAt'] = DateTime.now().toIso8601String();

        count++;

      }

    }

    return {

      'success': true,

      'message': count == 0

          ? 'No aggregator orders to sync'

          : 'Synced $count aggregator orders',

    };

  }



  static void _syncFromOrderStore() {

    for (final order in MockOrderStore.activeOrders('All')) {

      final platform = _platformFor(order['deliveryType'] as String);

      if (platform == null) {

        continue;

      }



      final orderId = order['id'] as String;

      if (_orders.containsKey(orderId)) {

        final existing = _orders[orderId]!;

        existing['timerSeconds'] = order['timerSeconds'];

        if ((order['timerSeconds'] as int) > 600) {

          existing['riderWaiting'] = true;

        }

        continue;

      }



      _orders[orderId] = _buildAggregatorOrder(order, platform);

    }

  }



  static Map<String, dynamic> _buildAggregatorOrder(

    Map<String, dynamic> order,

    String platform,

  ) {

    final items = order['items'] as List<dynamic>;

    final timer = order['timerSeconds'] as int;

    final riderWaiting = (order['cookingNotes'] as List<dynamic>?)

            ?.any((note) => note.toString().toLowerCase().contains('rider')) ==

        true;



    return {

      'id': 'AGG-${order['id']}',

      'orderId': order['id'],

      'kotNumber': order['kotNumber'],

      'platform': platform,

      'section': order['section'],

      'location': order['location'],

      'itemsSummary': items.isEmpty ? 'Aggregator order' : items.join(', '),

      'syncStatus': 'pending',

      'pickupCountdownSeconds': riderWaiting ? 180 : 420,

      'prepTimerSeconds': timer,

      'timerSeconds': timer,

      'dispatchStatus': order['status'] == 'ready' ? 'ready_for_pickup' : 'preparing',

      'riderWaiting': riderWaiting,

    };

  }



  static String? _platformFor(String deliveryType) {

    return switch (deliveryType) {

      'Swiggy' => 'Swiggy',

      'Zomato' => 'Zomato',

      'ONDC' => 'ONDC',

      _ => null,

    };

  }



  static Map<String, dynamic>? _findByOrderId(String orderId) {

    return _orders[orderId];

  }



  static void _trackDispatch(

    String orderId,

    String kotNumber,

    String platform,

    String status,

  ) {

    _dispatchTracking.insert(0, {

      'orderId': orderId,

      'kotNumber': kotNumber,

      'platform': platform,

      'status': status,

      'updatedAt': DateTime.now().toIso8601String(),

    });

  }



  static String _formatTimer(int seconds) {

    final minutes = seconds ~/ 60;

    final remainder = seconds % 60;

    return '${minutes.toString().padLeft(2, '0')}:${remainder.toString().padLeft(2, '0')}';

  }



  static Map<String, dynamic> _serializeOrder(Map<String, dynamic> order) {

    final pickup = order['pickupCountdownSeconds'] as int;

    final prep = order['prepTimerSeconds'] as int;

    return {

      'id': order['id'],

      'orderId': order['orderId'],

      'kotNumber': order['kotNumber'],

      'platform': order['platform'],

      'section': order['section'],

      'location': order['location'],

      'itemsSummary': order['itemsSummary'],

      'syncStatus': order['syncStatus'],

      'pickupCountdownSeconds': pickup,

      'countdownLabel': _formatTimer(pickup),

      'prepTimerSeconds': prep,

      'prepTimerLabel': _formatTimer(prep),

      'dispatchStatus': order['dispatchStatus'],

      'riderWaiting': order['riderWaiting'] == true,

      'availableActions': _availableActions(order),

    };

  }



  static List<String> _availableActions(Map<String, dynamic> order) {

    if (order['dispatchStatus'] == 'dispatched') {

      return const [];

    }



    final actions = <String>['sync_order', 'start_prep_timer'];

    if (order['riderWaiting'] == true) {

      actions.add('acknowledge_rider');

    }

    if (order['dispatchStatus'] == 'preparing') {

      actions.add('ready_for_pickup');

    }

    if (order['dispatchStatus'] == 'ready_for_pickup') {

      actions.addAll(['dispatch', 'extend_countdown']);

    }

    return actions;

  }



  static Map<String, Map<String, dynamic>> _seedOrders() {

    return {

      'ORD-1844': {

        'id': 'AGG-ORD-1844',

        'orderId': 'ORD-1844',

        'kotNumber': 'KOT #1844',

        'platform': 'Zomato',

        'section': 'Chinese',

        'location': 'Zomato',

        'itemsSummary': '2x Hakka noodles, 1x Manchurian gravy',

        'syncStatus': 'synced',

        'pickupCountdownSeconds': 165,

        'prepTimerSeconds': 965,

        'timerSeconds': 965,

        'dispatchStatus': 'preparing',

        'riderWaiting': true,

      },

      'ORD-1848': {

        'id': 'AGG-ORD-1848',

        'orderId': 'ORD-1848',

        'kotNumber': 'KOT #1848',

        'platform': 'Swiggy',

        'section': 'Fry',

        'location': 'Swiggy',

        'itemsSummary': '1x Loaded fries, 1x Chicken strips',

        'syncStatus': 'pending',

        'pickupCountdownSeconds': 480,

        'prepTimerSeconds': 45,

        'timerSeconds': 45,

        'dispatchStatus': 'preparing',

        'riderWaiting': true,

      },

      'ORD-OND-001': {

        'id': 'AGG-ORD-OND-001',

        'orderId': 'ORD-OND-001',

        'kotNumber': 'KOT #OND-001',

        'platform': 'ONDC',

        'section': 'Main',

        'location': 'ONDC',

        'itemsSummary': '1x Veg thali, 1x Roti basket',

        'syncStatus': 'synced',

        'pickupCountdownSeconds': 360,

        'prepTimerSeconds': 240,

        'timerSeconds': 240,

        'dispatchStatus': 'ready_for_pickup',

        'riderWaiting': false,

      },

    };

  }



  static List<Map<String, dynamic>> _seedRiderAlerts() {

    return [

      {

        'id': 'RDR-001',

        'orderId': 'ORD-1844',

        'kotNumber': 'KOT #1844',

        'platform': 'Zomato',

        'message': 'Rider waiting · 16 min over pickup SLA',

        'severity': 'high',

        'triggeredAt': DateTime.now()

            .subtract(const Duration(minutes: 4))

            .toIso8601String(),

      },

      {

        'id': 'RDR-002',

        'orderId': 'ORD-1848',

        'kotNumber': 'KOT #1848',

        'platform': 'Swiggy',

        'message': 'Rider assigned · waiting at pickup counter',

        'severity': 'medium',

        'triggeredAt': DateTime.now()

            .subtract(const Duration(minutes: 2))

            .toIso8601String(),

      },

    ];

  }



  static List<Map<String, dynamic>> _seedDispatchTracking() {

    return [

      {

        'orderId': 'ORD-1840',

        'kotNumber': 'KOT #1840',

        'platform': 'Zomato',

        'status': 'dispatched',

        'updatedAt': DateTime.now()

            .subtract(const Duration(hours: 1))

            .toIso8601String(),

      },

    ];

  }



  static int get dispatchedToday => _dispatchedToday;

}



class MockDeliveryAggregatorEngine {

  const MockDeliveryAggregatorEngine._();



  static Map<String, dynamic> buildSnapshot({String section = 'All'}) {

    final orders = MockDeliveryAggregatorRegistry.ordersFor(section);

    final riderAlerts = MockDeliveryAggregatorRegistry.riderAlertsFor(section);

    final dispatchTracking =

        MockDeliveryAggregatorRegistry.dispatchTrackingFor(section);



    return {

      'section': section,

      'lastSyncedAt': DateTime.now().toIso8601String(),

      'orders': orders,

      'riderAlerts': riderAlerts,

      'dispatchTracking': dispatchTracking,

      'stats': {

        'activeOrders': orders.length,

        'swiggyOrders':

            orders.where((order) => order['platform'] == 'Swiggy').length,

        'zomatoOrders':

            orders.where((order) => order['platform'] == 'Zomato').length,

        'ondcOrders':

            orders.where((order) => order['platform'] == 'ONDC').length,

        'riderAlerts': riderAlerts.length,

        'awaitingPickup': orders

            .where((order) => order['dispatchStatus'] == 'ready_for_pickup')

            .length,

        'dispatchedToday': MockDeliveryAggregatorRegistry.dispatchedToday,

      },

      'aggregatorFeatures': {

        'aggregatorOrderSync': orders.any(

          (order) => order['syncStatus'] == 'synced',

        ),

        'pickupCountdown': orders.isNotEmpty,

        'riderWaitingAlerts': riderAlerts.isNotEmpty,

        'dispatchTracking': dispatchTracking.isNotEmpty,

        'deliveryPrepTimers': orders.any(

          (order) => (order['prepTimerSeconds'] as int) > 0,

        ),

        'swiggy': orders.any((order) => order['platform'] == 'Swiggy'),

        'zomato': orders.any((order) => order['platform'] == 'Zomato'),

        'ondc': orders.any((order) => order['platform'] == 'ONDC'),

      },

      'sections': MockSectionRegistry.filterSections,

    };

  }

}

