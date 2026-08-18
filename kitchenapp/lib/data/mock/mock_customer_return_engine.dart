import 'mock_order_store.dart';

import 'mock_section_registry.dart';



class MockCustomerReturnRegistry {

  MockCustomerReturnRegistry._();



  static final List<Map<String, dynamic>> _returns = _seedReturns();

  static final List<Map<String, dynamic>> _complaintTags = _seedComplaintTags();

  static final List<Map<String, dynamic>> _history = _seedHistory();



  static List<Map<String, dynamic>> returnsFor(String section) {

    final items = section == 'All'

        ? _returns

        : _returns.where((item) => item['section'] == section);

    return items

        .where((item) => item['status'] != 'resolved')

        .map(_serializeReturn)

        .toList();

  }



  static List<Map<String, dynamic>> complaintTagsFor(String section) {

    final items = section == 'All'

        ? _complaintTags

        : _complaintTags.where((item) => item['section'] == section);

    return items.map(Map<String, dynamic>.from).toList();

  }



  static List<Map<String, dynamic>> historyFor(String section) {

    final items = section == 'All'

        ? _history

        : _history.where((item) => item['section'] == section);

    return items.map(Map<String, dynamic>.from).toList();

  }



  static Map<String, dynamic> createReturn({

    required String orderId,

    required String returnType,

    required String reason,

  }) {

    final order = MockOrderStore.findById(orderId);

    if (order == null) {

      throw ArgumentError('Order not found');

    }



    final items = order['items'] as List<dynamic>;

    final dishName = items.isEmpty ? 'Kitchen item' : items.first.toString();

    final id = 'RET-${DateTime.now().millisecondsSinceEpoch}';



    _returns.insert(0, {

      'id': id,

      'orderId': orderId,

      'kotNumber': order['kotNumber'],

      'section': order['section'],

      'location': order['location'],

      'dishName': dishName,

      'returnType': returnType,

      'reason': reason,

      'status': 'open',

      'priorityRemake': false,

      'complaintTags': <String>[],

    });



    return {

      'success': true,

      'message': 'Return logged · ${order['kotNumber']}',

    };

  }



  static Map<String, dynamic> performAction({

    required String returnId,

    required String action,

    String? tag,

    String? severity,

  }) {

    final request = _findReturn(returnId);

    if (request == null) {

      throw ArgumentError('Return request not found');

    }



    final order = MockOrderStore.findById(request['orderId'] as String);

    final orderId = request['orderId'] as String;

    final kotNumber = request['kotNumber'] as String;



    switch (action) {

      case 'wrong_item_replacement':

        request['returnType'] = 'wrong_item';

        request['status'] = 'in_progress';

        order?['status'] = 'preparing';

        order?['reFireRequested'] = true;

        order?['progress'] = 0.35;

        _logHistory(

          orderId: orderId,

          kotNumber: kotNumber,

          section: request['section'] as String,

          action: action,

          summary: 'Wrong item replacement started · $kotNumber',

        );

        return {

          'success': true,

          'message': 'Wrong item remake queued · $kotNumber',

        };

      case 'burnt_item_replacement':

        request['returnType'] = 'burnt_item';

        request['status'] = 'in_progress';

        order?['status'] = 'preparing';

        order?['reFireRequested'] = true;

        order?['progress'] = 0.25;

        _logHistory(

          orderId: orderId,

          kotNumber: kotNumber,

          section: request['section'] as String,

          action: action,

          summary: 'Burnt item replacement · $kotNumber',

        );

        return {

          'success': true,

          'message': 'Burnt item replacement queued · $kotNumber',

        };

      case 'refire_request':

        request['returnType'] = 'refire';

        request['status'] = 'in_progress';

        MockOrderStore.processAction(orderId, 'refire');

        _logHistory(

          orderId: orderId,

          kotNumber: kotNumber,

          section: request['section'] as String,

          action: action,

          summary: 'Re-fire request sent to kitchen · $kotNumber',

        );

        return {

          'success': true,

          'message': 'Re-fire request active · $kotNumber',

        };

      case 'priority_remake':

        request['priorityRemake'] = true;

        request['status'] = 'in_progress';

        order?['priority'] = 'express';

        order?['reFireRequested'] = true;

        order?['status'] = 'preparing';

        order?['sortOrder'] = 0;

        MockOrderStore.bumpSortOrder(orderId);

        _logHistory(

          orderId: orderId,

          kotNumber: kotNumber,

          section: request['section'] as String,

          action: action,

          summary: 'Priority remake escalated · $kotNumber',

        );

        return {

          'success': true,

          'message': 'Priority remake · $kotNumber bumped to front',

        };

      case 'tag_complaint':

        final complaintTag = tag ?? 'Guest complaint';

        final tags = List<String>.from(

          (request['complaintTags'] as List<dynamic>?) ?? const [],

        );

        if (!tags.contains(complaintTag)) {

          tags.add(complaintTag);

        }

        request['complaintTags'] = tags;



        _complaintTags.insert(0, {

          'id': 'TAG-${DateTime.now().millisecondsSinceEpoch}',

          'returnId': returnId,

          'orderId': orderId,

          'kotNumber': kotNumber,

          'section': request['section'],

          'tag': complaintTag,

          'severity': severity ?? 'medium',

          'loggedAt': DateTime.now().toIso8601String(),

        });

        return {

          'success': true,

          'message': 'Complaint tagged · $complaintTag',

        };

      case 'resolve':

        request['status'] = 'resolved';

        order?['reFireRequested'] = false;

        _logHistory(

          orderId: orderId,

          kotNumber: kotNumber,

          section: request['section'] as String,

          action: action,

          summary: 'Return resolved · $kotNumber',

        );

        return {

          'success': true,

          'message': 'Return resolved · $kotNumber',

        };

      case 'dismiss':

        request['status'] = 'dismissed';

        return {

          'success': true,

          'message': 'Return dismissed · $kotNumber',

        };

      default:

        throw ArgumentError('Unknown return action: $action');

    }

  }



  static Map<String, dynamic>? _findReturn(String returnId) {

    for (final request in _returns) {

      if (request['id'] == returnId) {

        return request;

      }

    }

    return null;

  }



  static void _logHistory({

    required String orderId,

    required String kotNumber,

    required String section,

    required String action,

    required String summary,

  }) {

    _history.insert(0, {

      'id': 'RHIS-${DateTime.now().millisecondsSinceEpoch}',

      'orderId': orderId,

      'kotNumber': kotNumber,

      'section': section,

      'action': action,

      'summary': summary,

      'loggedAt': DateTime.now().toIso8601String(),

    });

  }



  static Map<String, dynamic> _serializeReturn(Map<String, dynamic> request) {

    return {

      'id': request['id'],

      'orderId': request['orderId'],

      'kotNumber': request['kotNumber'],

      'section': request['section'],

      'location': request['location'],

      'dishName': request['dishName'],

      'returnType': request['returnType'],

      'reason': request['reason'],

      'status': request['status'],

      'priorityRemake': request['priorityRemake'] == true,

      'complaintTags': List<String>.from(

        (request['complaintTags'] as List<dynamic>?) ?? const [],

      ),

      'availableActions': _availableActions(request),

    };

  }



  static List<String> _availableActions(Map<String, dynamic> request) {

    if (request['status'] == 'resolved' || request['status'] == 'dismissed') {

      return const [];

    }

    return [

      'wrong_item_replacement',

      'burnt_item_replacement',

      'refire_request',

      'priority_remake',

      'tag_complaint',

      'resolve',

      'dismiss',

    ];

  }



  static List<Map<String, dynamic>> _seedReturns() {

    return [

      {

        'id': 'RET-001',

        'orderId': 'ORD-1851',

        'kotNumber': 'KOT #1851',

        'section': 'Main',

        'location': 'Table 2',

        'dishName': '1x Paneer tikka',

        'returnType': 'wrong_item',

        'reason': 'Guest received wrong spice level · requested replacement',

        'status': 'open',

        'priorityRemake': false,

        'complaintTags': ['Wrong spice level'],

      },

      {

        'id': 'RET-002',

        'orderId': 'ORD-1842',

        'kotNumber': 'KOT #1842',

        'section': 'Tandoor',

        'location': 'Table 12',

        'dishName': '2x Butter naan',

        'returnType': 'burnt_item',

        'reason': 'Naan burnt · guest refused plate',

        'status': 'in_progress',

        'priorityRemake': true,

        'complaintTags': ['Burnt item', 'Table complaint'],

      },

      {

        'id': 'RET-003',

        'orderId': 'ORD-1847',

        'kotNumber': 'KOT #1847',

        'section': 'Grill',

        'location': 'Table 4',

        'dishName': '1x Grilled fish',

        'returnType': 'refire',

        'reason': 'Fish undercooked · re-fire requested by floor staff',

        'status': 'open',

        'priorityRemake': false,

        'complaintTags': [],

      },

    ];

  }



  static List<Map<String, dynamic>> _seedComplaintTags() {

    return [

      {

        'id': 'TAG-001',

        'returnId': 'RET-001',

        'orderId': 'ORD-1851',

        'kotNumber': 'KOT #1851',

        'section': 'Main',

        'tag': 'Wrong spice level',

        'severity': 'medium',

        'loggedAt': DateTime.now()

            .subtract(const Duration(minutes: 22))

            .toIso8601String(),

      },

      {

        'id': 'TAG-002',

        'returnId': 'RET-002',

        'orderId': 'ORD-1842',

        'kotNumber': 'KOT #1842',

        'section': 'Tandoor',

        'tag': 'Burnt item',

        'severity': 'high',

        'loggedAt': DateTime.now()

            .subtract(const Duration(minutes: 48))

            .toIso8601String(),

      },

    ];

  }



  static List<Map<String, dynamic>> _seedHistory() {

    return [

      {

        'id': 'RHIS-001',

        'orderId': 'ORD-1840',

        'kotNumber': 'KOT #1840',

        'section': 'Chinese',

        'action': 'refire_request',

        'summary': 'Re-fire completed · fried rice remade',

        'loggedAt': DateTime.now()

            .subtract(const Duration(hours: 3))

            .toIso8601String(),

      },

    ];

  }

}



class MockCustomerReturnEngine {

  const MockCustomerReturnEngine._();



  static Map<String, dynamic> buildSnapshot({String section = 'All'}) {

    final returnRequests = MockCustomerReturnRegistry.returnsFor(section);

    final complaintTags = MockCustomerReturnRegistry.complaintTagsFor(section);

    final history = MockCustomerReturnRegistry.historyFor(section);



    return {

      'section': section,

      'lastSyncedAt': DateTime.now().toIso8601String(),

      'returnRequests': returnRequests,

      'complaintTags': complaintTags,

      'history': history,

      'stats': {

        'openReturns': returnRequests.length,

        'priorityRemakes':

            returnRequests.where((item) => item['priorityRemake'] == true).length,

        'refireQueue': returnRequests

            .where((item) => item['returnType'] == 'refire')

            .length,

        'complaintTags': complaintTags.length,

        'resolvedToday': history

            .where((item) => item['action'] == 'resolve')

            .length,

        'wrongItemCount': returnRequests

            .where((item) => item['returnType'] == 'wrong_item')

            .length,

        'burntItemCount': returnRequests

            .where((item) => item['returnType'] == 'burnt_item')

            .length,

      },

      'returnFeatures': {

        'wrongItemReplacement': returnRequests.any(

          (item) => item['returnType'] == 'wrong_item',

        ),

        'burntItemReplacement': returnRequests.any(

          (item) => item['returnType'] == 'burnt_item',

        ),

        'refireRequest': returnRequests.any(

          (item) => item['returnType'] == 'refire',

        ),

        'priorityRemake': returnRequests.any(

          (item) => item['priorityRemake'] == true,

        ),

        'complaintTagging': complaintTags.isNotEmpty,

      },

      'sections': MockSectionRegistry.filterSections,

    };

  }

}

