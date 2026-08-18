import 'mock_order_store.dart';

import 'mock_section_registry.dart';



class MockExpeditorRegistry {

  MockExpeditorRegistry._();



  static final Map<String, Map<String, dynamic>> _tickets = _seedTickets();

  static final List<Map<String, dynamic>> _coordinationGroups =

      _seedCoordinationGroups();

  static final List<Map<String, dynamic>> _tableSync = _seedTableSync();

  static int _dispatchedToday = 2;



  static List<Map<String, dynamic>> ticketsFor(String section) {

    _syncTicketsFromOrders();

    final items = section == 'All'

        ? _tickets.values

        : _tickets.values.where((ticket) => ticket['section'] == section);

    return items

        .where((ticket) => ticket['status'] != 'dispatched')

        .map(_serializeTicket)

        .toList();

  }



  static List<Map<String, dynamic>> coordinationFor(String section) {

    if (section == 'All') {

      return _coordinationGroups.map(Map<String, dynamic>.from).toList();

    }

    return _coordinationGroups

        .where(

          (group) => (group['sections'] as List<dynamic>).any(

            (item) => (item as Map<String, dynamic>)['section'] == section,

          ),

        )

        .map(Map<String, dynamic>.from)

        .toList();

  }



  static List<Map<String, dynamic>> tableSyncFor(String section) {

    if (section == 'All') {

      return _tableSync.map(Map<String, dynamic>.from).toList();

    }

    return _tableSync

        .where((entry) => entry['section'] == section)

        .map(Map<String, dynamic>.from)

        .toList();

  }



  static Map<String, dynamic> performTicketAction({

    required String ticketId,

    required String action,

  }) {

    final ticket = _tickets[ticketId];

    if (ticket == null) {

      throw ArgumentError('Expeditor ticket not found');

    }



    final order = MockOrderStore.findById(ticket['orderId'] as String);

    final kotNumber = ticket['kotNumber'] as String;



    switch (action) {

      case 'validate_final':

        ticket['finalValidated'] = true;

        ticket['status'] = 'validated';

        return {

          'success': true,

          'message': 'Final validation passed · $kotNumber',

        };

      case 'verify_packaging':

        ticket['packagingVerified'] = true;

        ticket['status'] = 'packaging_verified';

        return {

          'success': true,

          'message': 'Packaging verified · $kotNumber',

        };

      case 'approve_dispatch':

        if (ticket['finalValidated'] != true) {

          throw ArgumentError('Complete final validation before dispatch');

        }

        if (_isPackagingRequired(ticket) && ticket['packagingVerified'] != true) {

          throw ArgumentError('Packaging verification required');

        }

        ticket['dispatchApproved'] = true;

        ticket['status'] = 'dispatch_ready';

        return {

          'success': true,

          'message': 'Dispatch approved · $kotNumber',

        };

      case 'dispatch':

        ticket['status'] = 'dispatched';

        order?['status'] = 'served';

        _dispatchedToday++;

        return {

          'success': true,

          'message': 'Order dispatched · $kotNumber',

        };

      case 'hold':

        ticket['status'] = 'on_hold';

        return {

          'success': true,

          'message': 'Dispatch held · $kotNumber',

        };

      default:

        throw ArgumentError('Unknown expeditor action: $action');

    }

  }



  static Map<String, dynamic> coordinateSections({String? groupId}) {

    Map<String, dynamic>? group;

    if (groupId != null) {

      for (final item in _coordinationGroups) {

        if (item['id'] == groupId) {

          group = item;

          break;

        }

      }

    } else if (_coordinationGroups.isNotEmpty) {

      group = _coordinationGroups.first;

    }



    if (group == null) {

      throw ArgumentError('No coordination group found');

    }



    group['syncStatus'] = 'coordinated';

    group['allReady'] = (group['sections'] as List<dynamic>)

        .every((item) => (item as Map<String, dynamic>)['status'] == 'ready');



    return {

      'success': true,

      'message': 'Sections coordinated · ${group['location']}',

    };

  }



  static Map<String, dynamic> syncTables({String? tableNumber}) {

    var synced = 0;

    for (final entry in _tableSync) {

      if (tableNumber != null && entry['tableNumber'] != tableNumber) {

        continue;

      }

      entry['syncStatus'] = 'synced';

      entry['lastSyncedAt'] = DateTime.now().toIso8601String();

      synced++;

    }



    if (synced == 0) {

      throw ArgumentError('Table not found for sync');

    }



    return {

      'success': true,

      'message': tableNumber == null

          ? 'All expeditor tables synchronized'

          : 'Table $tableNumber synchronized',

    };

  }



  static void _syncTicketsFromOrders() {

    for (final order in MockOrderStore.activeOrders('All')) {

      if (order['status'] != 'ready') {

        continue;

      }

      final orderId = order['id'] as String;

      final ticketId = 'EXP-$orderId';

      if (_tickets.containsKey(ticketId)) {

        continue;

      }

      _tickets[ticketId] = _buildTicket(order);

    }

  }



  static Map<String, dynamic> _buildTicket(Map<String, dynamic> order) {

    final items = order['items'] as List<dynamic>;

    final summary = items.isEmpty ? 'Kitchen order' : items.join(', ');

    return {

      'id': 'EXP-${order['id']}',

      'orderId': order['id'],

      'kotNumber': order['kotNumber'],

      'section': order['section'],

      'location': order['location'],

      'tableNumber': order['tableNumber'],

      'deliveryType': order['deliveryType'],

      'summary': summary,

      'status': 'awaiting_validation',

      'finalValidated': false,

      'packagingVerified': false,

      'dispatchApproved': false,

    };

  }



  static bool _isPackagingRequired(Map<String, dynamic> ticket) {

    final deliveryType = ticket['deliveryType'] as String;

    return {

      'Takeaway',

      'Zomato',

      'Swiggy',

      'Delivery',

      'Room service',

    }.contains(deliveryType);

  }



  static Map<String, dynamic> _serializeTicket(Map<String, dynamic> ticket) {

    return {

      'id': ticket['id'],

      'orderId': ticket['orderId'],

      'kotNumber': ticket['kotNumber'],

      'section': ticket['section'],

      'location': ticket['location'],

      'tableNumber': ticket['tableNumber'],

      'deliveryType': ticket['deliveryType'],

      'summary': ticket['summary'],

      'status': ticket['status'],

      'finalValidated': ticket['finalValidated'] == true,

      'packagingVerified': ticket['packagingVerified'] == true,

      'dispatchApproved': ticket['dispatchApproved'] == true,

      'availableActions': _availableActions(ticket),

    };

  }



  static List<String> _availableActions(Map<String, dynamic> ticket) {

    if (ticket['status'] == 'dispatched') {

      return const [];

    }



    final actions = <String>['validate_final', 'verify_packaging', 'hold'];

    if (ticket['finalValidated'] == true) {

      actions.add('approve_dispatch');

    }

    if (ticket['dispatchApproved'] == true || ticket['status'] == 'dispatch_ready') {

      actions.add('dispatch');

    }

    return actions;

  }



  static Map<String, Map<String, dynamic>> _seedTickets() {

    return {

      'EXP-ORD-1846': {

        'id': 'EXP-ORD-1846',

        'orderId': 'ORD-1846',

        'kotNumber': 'KOT #1846',

        'section': 'Beverage',

        'location': 'Takeaway',

        'tableNumber': null,

        'deliveryType': 'Takeaway',

        'summary': '2x Cold coffee, 1x Mango lassi',

        'status': 'awaiting_validation',

        'finalValidated': false,

        'packagingVerified': false,

        'dispatchApproved': false,

      },

      'EXP-ORD-1850': {

        'id': 'EXP-ORD-1850',

        'orderId': 'ORD-1850',

        'kotNumber': 'KOT #1850',

        'section': 'Bakery',

        'location': 'Room 512',

        'tableNumber': null,

        'deliveryType': 'Room service',

        'summary': '1x Croissant basket',

        'status': 'validated',

        'finalValidated': true,

        'packagingVerified': true,

        'dispatchApproved': false,

      },

    };

  }



  static List<Map<String, dynamic>> _seedCoordinationGroups() {

    return [

      {

        'id': 'COORD-12',

        'location': 'Table 12',

        'tableNumber': '12',

        'syncStatus': 'pending',

        'allReady': false,

        'sections': [

          {

            'section': 'Tandoor',

            'kotNumber': 'KOT #1842',

            'status': 'preparing',

          },

          {

            'section': 'Main',

            'kotNumber': 'KOT #1843',

            'status': 'preparing',

          },

          {

            'section': 'Beverage',

            'kotNumber': 'KOT #1846',

            'status': 'ready',

          },

        ],

      },

      {

        'id': 'COORD-7',

        'location': 'Table 7',

        'tableNumber': '7',

        'syncStatus': 'coordinated',

        'allReady': false,

        'sections': [

          {

            'section': 'Salad',

            'kotNumber': 'KOT #1849',

            'status': 'accepted',

          },

          {

            'section': 'Dessert',

            'kotNumber': 'KOT #1845',

            'status': 'preparing',

          },

        ],

      },

    ];

  }



  static List<Map<String, dynamic>> _seedTableSync() {

    return [

      {

        'tableNumber': '12',

        'location': 'Table 12',

        'section': 'Tandoor',

        'kotCount': 3,

        'syncStatus': 'pending',

        'lastSyncedAt': DateTime.now()

            .subtract(const Duration(minutes: 6))

            .toIso8601String(),

      },

      {

        'tableNumber': '7',

        'location': 'Table 7',

        'section': 'Salad',

        'kotCount': 2,

        'syncStatus': 'synced',

        'lastSyncedAt': DateTime.now()

            .subtract(const Duration(minutes: 2))

            .toIso8601String(),

      },

      {

        'tableNumber': '4',

        'location': 'Table 4',

        'section': 'Grill',

        'kotCount': 1,

        'syncStatus': 'pending',

        'lastSyncedAt': DateTime.now()

            .subtract(const Duration(minutes: 14))

            .toIso8601String(),

      },

    ];

  }



  static int get dispatchedToday => _dispatchedToday;

}



class MockExpeditorEngine {

  const MockExpeditorEngine._();



  static Map<String, dynamic> buildSnapshot({String section = 'All'}) {

    final tickets = MockExpeditorRegistry.ticketsFor(section);

    final coordinationGroups = MockExpeditorRegistry.coordinationFor(section);

    final tableSync = MockExpeditorRegistry.tableSyncFor(section);



    return {

      'section': section,

      'lastSyncedAt': DateTime.now().toIso8601String(),

      'tickets': tickets,

      'coordinationGroups': coordinationGroups,

      'tableSync': tableSync,

      'stats': {

        'awaitingValidation': tickets

            .where((item) => item['status'] == 'awaiting_validation')

            .length,

        'coordinationGroups': coordinationGroups.length,

        'packagingChecks': tickets

            .where((item) => item['packagingVerified'] == true)

            .length,

        'dispatchReady': tickets

            .where((item) => item['status'] == 'dispatch_ready')

            .length,

        'dispatchedToday': MockExpeditorRegistry.dispatchedToday,

        'tablesSynced': tableSync

            .where((item) => item['syncStatus'] == 'synced')

            .length,

      },

      'expeditorFeatures': {

        'finalOrderValidation': tickets.isNotEmpty,

        'multiSectionCoordination': coordinationGroups.isNotEmpty,

        'tableSynchronization': tableSync.isNotEmpty,

        'dispatchApproval': tickets.any(

          (item) => item['dispatchApproved'] == true,

        ),

        'packagingVerification': tickets.any(

          (item) =>

              item['deliveryType'] == 'Takeaway' ||

              item['deliveryType'] == 'Room service',

        ),

      },

      'sections': MockSectionRegistry.filterSections,

    };

  }

}

