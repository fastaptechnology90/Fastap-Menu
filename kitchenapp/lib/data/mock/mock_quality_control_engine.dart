import 'mock_order_store.dart';

import 'mock_section_registry.dart';



class MockQualityControlRegistry {

  MockQualityControlRegistry._();



  static final Map<String, Map<String, dynamic>> _checks = _seedChecks();

  static final List<Map<String, dynamic>> _audits = _seedAudits();

  static final List<Map<String, dynamic>> _complaints = _seedComplaints();

  static final List<Map<String, dynamic>> _rejections = _seedRejections();



  static List<Map<String, dynamic>> pendingChecksFor(String section) {

    _syncChecksFromOrders();

    final items = section == 'All'

        ? _checks.values

        : _checks.values.where((check) => check['section'] == section);

    return items

        .where((check) => check['status'] != 'approved')

        .map(_serializeCheck)

        .toList();

  }



  static List<Map<String, dynamic>> auditsFor(String section) {

    final items = section == 'All'

        ? _audits

        : _audits.where((item) => item['section'] == section);

    return items.map(Map<String, dynamic>.from).toList();

  }



  static List<Map<String, dynamic>> complaintsFor(String section) {

    final items = section == 'All'

        ? _complaints

        : _complaints.where((item) => item['section'] == section);

    return items.map(Map<String, dynamic>.from).toList();

  }



  static List<Map<String, dynamic>> rejectionsFor(String section) {

    final items = section == 'All'

        ? _rejections

        : _rejections.where((item) => item['section'] == section);

    return items.map(Map<String, dynamic>.from).toList();

  }



  static Map<String, dynamic> performCheckAction({

    required String checkId,

    required String action,

    String? itemId,

    bool? passed,

  }) {

    final check = _checks[checkId];

    if (check == null) {

      throw ArgumentError('QC check not found');

    }



    final checklist = check['checklist'] as List<Map<String, dynamic>>;



    switch (action) {

      case 'toggle_item':

        final item = _findChecklistItem(checklist, itemId);

        if (item == null) {

          throw ArgumentError('Checklist item not found');

        }

        item['passed'] = passed ?? !(item['passed'] == true);

        break;

      case 'validate_presentation':

        _validateCategory(checklist, 'presentation', passed ?? true);

        break;

      case 'validate_temperature':

        _validateCategory(checklist, 'temperature', passed ?? true);

        break;

      case 'validate_hygiene':

        _validateCategory(checklist, 'hygiene', passed ?? true);

        break;

      case 'validate_quality':

        _validateCategory(checklist, 'quality', passed ?? true);

        break;

      default:

        throw ArgumentError('Unknown QC check action: $action');

    }



    _refreshCheckState(check);

    return {

      'success': true,

      'message': 'Checklist updated · ${check['kotNumber']}',

    };

  }



  static Map<String, dynamic> performOrderAction({

    required String orderId,

    required String action,

    String? reason,

    String? supervisorName,

  }) {

    final checkEntry = _checks.values.cast<Map<String, dynamic>?>().firstWhere(

          (check) => check?['orderId'] == orderId,

          orElse: () => null,

        );

    if (checkEntry == null) {

      throw ArgumentError('QC check not found for order');

    }



    final order = MockOrderStore.findById(orderId);



    switch (action) {

      case 'supervisor_signoff':

        checkEntry['assignedSupervisor'] =

            supervisorName ?? 'Kitchen Supervisor';

        checkEntry['supervisorSigned'] = true;

        _refreshCheckState(checkEntry);

        return {

          'success': true,

          'message': 'Supervisor approval recorded · ${checkEntry['kotNumber']}',

        };

      case 'approve':

        if (!_allRequiredPassed(checkEntry)) {

          throw ArgumentError('Complete all required checklist items first');

        }

        if (checkEntry['supervisorRequired'] == true &&

            checkEntry['supervisorSigned'] != true) {

          throw ArgumentError('Supervisor approval required');

        }

        checkEntry['status'] = 'approved';

        order?['status'] = 'ready';

        order?['qcApproved'] = true;

        return {

          'success': true,

          'message': 'QC approved · ${checkEntry['kotNumber']}',

        };

      case 'reject':

        checkEntry['status'] = 'rejected';

        _rejections.insert(0, {

          'id': 'REJ-${DateTime.now().millisecondsSinceEpoch}',

          'orderId': orderId,

          'kotNumber': checkEntry['kotNumber'],

          'section': checkEntry['section'],

          'dishName': checkEntry['dishName'],

          'reason': reason ?? 'Failed QC validation',

          'rejectedBy': supervisorName ?? 'QC Supervisor',

          'rejectedAt': DateTime.now().toIso8601String(),

          'disposition': 'Waste log',

        });

        order?['status'] = 'rejected';

        return {

          'success': true,

          'message': 'Food rejected · ${checkEntry['kotNumber']}',

        };

      case 'request_redo':

        checkEntry['status'] = 'pending';

        for (final item in checkEntry['checklist'] as List<Map<String, dynamic>>) {

          item['passed'] = null;

        }

        checkEntry['supervisorSigned'] = false;

        checkEntry['score'] = 0;

        order?['status'] = 'preparing';

        order?['progress'] = 0.45;

        return {

          'success': true,

          'message': 'Sent back for re-fire · ${checkEntry['kotNumber']}',

        };

      default:

        throw ArgumentError('Unknown QC order action: $action');

    }

  }



  static Map<String, dynamic> triggerRandomAudit({String? section}) {

    final orders = MockOrderStore.activeOrders(section ?? 'All');

    if (orders.isEmpty) {

      throw ArgumentError('No active orders available for audit');

    }



    final order = orders.first;

    final dish = (order['items'] as List<dynamic>).first.toString();

    _audits.insert(0, {

      'id': 'AUD-${DateTime.now().millisecondsSinceEpoch}',

      'section': order['section'],

      'dishName': dish,

      'auditor': 'QC Lead · Random audit',

      'triggeredAt': DateTime.now().toIso8601String(),

      'score': 82,

      'notes': 'Spot check triggered · presentation and hygiene review',

      'status': 'open',

    });



    return {

      'success': true,

      'message': 'Random audit triggered · ${order['section']}',

    };

  }



  static Map<String, dynamic> logComplaint({

    required String orderId,

    required String reason,

    String severity = 'medium',

  }) {

    final order = MockOrderStore.findById(orderId);

    if (order == null) {

      throw ArgumentError('Order not found');

    }



    _complaints.insert(0, {

      'id': 'CMP-${DateTime.now().millisecondsSinceEpoch}',

      'orderId': orderId,

      'kotNumber': order['kotNumber'],

      'section': order['section'],

      'reason': reason,

      'severity': severity,

      'loggedAt': DateTime.now().toIso8601String(),

      'status': 'open',

    });



    return {

      'success': true,

      'message': 'Complaint logged · ${order['kotNumber']}',

    };

  }



  static void _syncChecksFromOrders() {

    for (final order in MockOrderStore.activeOrders('All')) {

      final orderId = order['id'] as String;

      if (_checks.containsKey('QC-$orderId')) {

        continue;

      }



      final status = order['status'] as String;

      final progress = order['progress'] as double? ?? 0;

      if (status == 'ready' ||

          (status == 'preparing' && progress >= 0.85) ||

          status == 'on_hold') {

        _checks['QC-$orderId'] = _buildCheck(order);

      }

    }

  }



  static Map<String, dynamic> _buildCheck(Map<String, dynamic> order) {

    final items = order['items'] as List<dynamic>;

    final dishName = items.isEmpty ? 'Kitchen item' : items.first.toString();

    final supervisorRequired =

        order['vip'] == true || order['allergy'] == true || order['priority'] == 'vip';



    return {

      'id': 'QC-${order['id']}',

      'orderId': order['id'],

      'kotNumber': order['kotNumber'],

      'section': order['section'],

      'location': order['location'],

      'dishName': dishName,

      'status': 'pending',

      'score': 0,

      'supervisorRequired': supervisorRequired,

      'assignedSupervisor': supervisorRequired ? 'Pending supervisor' : null,

      'supervisorSigned': false,

      'checklist': _defaultChecklist(order),

    };

  }



  static List<Map<String, dynamic>> _defaultChecklist(Map<String, dynamic> order) {

    final tempRequired = order['section'] == 'Grill' ||

        (order['cookingNotes'] as List<dynamic>?)

                ?.any((note) => note.toString().toLowerCase().contains('temperature')) ==

            true;



    return [

      {

        'id': 'quality-portion',

        'label': 'Portion size matches standard',

        'category': 'quality',

        'passed': null,

        'required': true,

      },

      {

        'id': 'quality-freshness',

        'label': 'Ingredients fresh · no discoloration',

        'category': 'quality',

        'passed': null,

        'required': true,

      },

      {

        'id': 'presentation-plating',

        'label': 'Plating matches recipe standard',

        'category': 'presentation',

        'passed': null,

        'required': true,

      },

      {

        'id': 'presentation-garnish',

        'label': 'Garnish complete · no smudges',

        'category': 'presentation',

        'passed': null,

        'required': true,

      },

      {

        'id': 'temperature-core',

        'label': 'Core temperature within range',

        'category': 'temperature',

        'passed': tempRequired ? null : true,

        'required': tempRequired,

      },

      {

        'id': 'temperature-hold',

        'label': 'Hot hold above 63°C',

        'category': 'temperature',

        'passed': tempRequired ? null : true,

        'required': tempRequired,

      },

      {

        'id': 'hygiene-gloves',

        'label': 'Gloves changed · station sanitized',

        'category': 'hygiene',

        'passed': null,

        'required': true,

      },

      {

        'id': 'hygiene-cross',

        'label': 'No cross-contamination risk',

        'category': 'hygiene',

        'passed': null,

        'required': true,

      },

    ];

  }



  static void _validateCategory(

    List<Map<String, dynamic>> checklist,

    String category,

    bool passed,

  ) {

    for (final item in checklist) {

      if (item['category'] == category) {

        item['passed'] = passed;

      }

    }

  }



  static Map<String, dynamic>? _findChecklistItem(

    List<Map<String, dynamic>> checklist,

    String? itemId,

  ) {

    if (itemId == null) {

      return null;

    }

    for (final item in checklist) {

      if (item['id'] == itemId) {

        return item;

      }

    }

    return null;

  }



  static bool _allRequiredPassed(Map<String, dynamic> check) {

    final checklist = check['checklist'] as List<Map<String, dynamic>>;

    for (final item in checklist) {

      if (item['required'] == true && item['passed'] != true) {

        return false;

      }

    }

    return true;

  }



  static void _refreshCheckState(Map<String, dynamic> check) {

    final checklist = check['checklist'] as List<Map<String, dynamic>>;

    var passed = 0;

    var required = 0;

    for (final item in checklist) {

      if (item['required'] == true) {

        required++;

        if (item['passed'] == true) {

          passed++;

        }

      }

    }



    final score = required == 0 ? 0 : ((passed / required) * 100).round();

    check['score'] = score;



    if (_allRequiredPassed(check)) {

      check['status'] = check['supervisorRequired'] == true &&

              check['supervisorSigned'] != true

          ? 'awaiting_supervisor'

          : 'ready_to_approve';

    } else {

      check['status'] = passed == 0 ? 'pending' : 'partial';

    }

  }



  static Map<String, dynamic> _serializeCheck(Map<String, dynamic> check) {

    _refreshCheckState(check);

    return {

      'id': check['id'],

      'orderId': check['orderId'],

      'kotNumber': check['kotNumber'],

      'section': check['section'],

      'location': check['location'],

      'dishName': check['dishName'],

      'status': check['status'],

      'score': check['score'],

      'checklist': (check['checklist'] as List<Map<String, dynamic>>)

          .map(Map<String, dynamic>.from)

          .toList(),

      'supervisorRequired': check['supervisorRequired'] == true,

      'assignedSupervisor': check['assignedSupervisor'] as String?,

      'availableActions': _availableActions(check),

    };

  }



  static List<String> _availableActions(Map<String, dynamic> check) {

    final actions = <String>[

      'validate_presentation',

      'validate_temperature',

      'validate_hygiene',

      'validate_quality',

    ];

    if (check['supervisorRequired'] == true && check['supervisorSigned'] != true) {

      actions.add('supervisor_signoff');

    }

    if (_allRequiredPassed(check)) {

      actions.addAll(['approve', 'reject', 'request_redo']);

    } else {

      actions.add('request_redo');

    }

    return actions;

  }



  static Map<String, Map<String, dynamic>> _seedChecks() {

    return {

      'QC-ORD-1846': {

        'id': 'QC-ORD-1846',

        'orderId': 'ORD-1846',

        'kotNumber': 'KOT #1846',

        'section': 'Beverage',

        'location': 'Takeaway',

        'dishName': '2x Cold coffee',

        'status': 'partial',

        'score': 75,

        'supervisorRequired': false,

        'assignedSupervisor': null,

        'supervisorSigned': false,

        'checklist': [

          {

            'id': 'quality-portion',

            'label': 'Portion size matches standard',

            'category': 'quality',

            'passed': true,

            'required': true,

          },

          {

            'id': 'quality-freshness',

            'label': 'Ingredients fresh · no discoloration',

            'category': 'quality',

            'passed': true,

            'required': true,

          },

          {

            'id': 'presentation-plating',

            'label': 'Plating matches recipe standard',

            'category': 'presentation',

            'passed': true,

            'required': true,

          },

          {

            'id': 'presentation-garnish',

            'label': 'Garnish complete · no smudges',

            'category': 'presentation',

            'passed': null,

            'required': true,

          },

          {

            'id': 'temperature-core',

            'label': 'Core temperature within range',

            'category': 'temperature',

            'passed': true,

            'required': false,

          },

          {

            'id': 'temperature-hold',

            'label': 'Hot hold above 63°C',

            'category': 'temperature',

            'passed': true,

            'required': false,

          },

          {

            'id': 'hygiene-gloves',

            'label': 'Gloves changed · station sanitized',

            'category': 'hygiene',

            'passed': true,

            'required': true,

          },

          {

            'id': 'hygiene-cross',

            'label': 'No cross-contamination risk',

            'category': 'hygiene',

            'passed': null,

            'required': true,

          },

        ],

      },

      'QC-ORD-1843': {

        'id': 'QC-ORD-1843',

        'orderId': 'ORD-1843',

        'kotNumber': 'KOT #1843',

        'section': 'Main',

        'location': 'Room 804',

        'dishName': '1x Dal makhani',

        'status': 'awaiting_supervisor',

        'score': 100,

        'supervisorRequired': true,

        'assignedSupervisor': 'Pending supervisor',

        'supervisorSigned': false,

        'checklist': [

          {

            'id': 'quality-portion',

            'label': 'Portion size matches standard',

            'category': 'quality',

            'passed': true,

            'required': true,

          },

          {

            'id': 'quality-freshness',

            'label': 'Ingredients fresh · no discoloration',

            'category': 'quality',

            'passed': true,

            'required': true,

          },

          {

            'id': 'presentation-plating',

            'label': 'Plating matches recipe standard',

            'category': 'presentation',

            'passed': true,

            'required': true,

          },

          {

            'id': 'presentation-garnish',

            'label': 'Garnish complete · no smudges',

            'category': 'presentation',

            'passed': true,

            'required': true,

          },

          {

            'id': 'temperature-core',

            'label': 'Core temperature within range',

            'category': 'temperature',

            'passed': true,

            'required': false,

          },

          {

            'id': 'temperature-hold',

            'label': 'Hot hold above 63°C',

            'category': 'temperature',

            'passed': true,

            'required': false,

          },

          {

            'id': 'hygiene-gloves',

            'label': 'Gloves changed · station sanitized',

            'category': 'hygiene',

            'passed': true,

            'required': true,

          },

          {

            'id': 'hygiene-cross',

            'label': 'No cross-contamination risk',

            'category': 'hygiene',

            'passed': true,

            'required': true,

          },

        ],

      },

    };

  }



  static List<Map<String, dynamic>> _seedAudits() {

    return [

      {

        'id': 'AUD-001',

        'section': 'Grill',

        'dishName': '1x Grilled fish',

        'auditor': 'QC Lead · Priya Nair',

        'triggeredAt': DateTime.now()

            .subtract(const Duration(minutes: 35))

            .toIso8601String(),

        'score': 88,

        'notes': 'Temperature probe verified · plating acceptable',

        'status': 'closed',

      },

    ];

  }



  static List<Map<String, dynamic>> _seedComplaints() {

    return [

      {

        'id': 'CMP-001',

        'orderId': 'ORD-1842',

        'kotNumber': 'KOT #1842',

        'section': 'Tandoor',

        'reason': 'Naan served cold · guest complaint at Table 12',

        'severity': 'high',

        'loggedAt': DateTime.now()

            .subtract(const Duration(hours: 2))

            .toIso8601String(),

        'status': 'investigating',

      },

    ];

  }



  static List<Map<String, dynamic>> _seedRejections() {

    return [

      {

        'id': 'REJ-001',

        'orderId': 'ORD-1840',

        'kotNumber': 'KOT #1840',

        'section': 'Chinese',

        'dishName': '1x Fried rice',

        'reason': 'Burnt edges · presentation fail',

        'rejectedBy': 'QC Supervisor',

        'rejectedAt': DateTime.now()

            .subtract(const Duration(hours: 5))

            .toIso8601String(),

        'disposition': 'Waste log',

      },

    ];

  }

}



class MockQualityControlEngine {

  const MockQualityControlEngine._();



  static Map<String, dynamic> buildSnapshot({String section = 'All'}) {

    final pendingChecks = MockQualityControlRegistry.pendingChecksFor(section);

    final randomAudits = MockQualityControlRegistry.auditsFor(section);

    final complaints = MockQualityControlRegistry.complaintsFor(section);

    final rejections = MockQualityControlRegistry.rejectionsFor(section);



    final scores = pendingChecks.map((check) => check['score'] as int).toList();

    final averageScore = scores.isEmpty

        ? 92

        : (scores.reduce((a, b) => a + b) / scores.length).round();

    final awaitingSupervisor = pendingChecks

        .where((check) => check['status'] == 'awaiting_supervisor')

        .length;

    final approvedToday = pendingChecks

        .where((check) => check['status'] == 'approved')

        .length;

    final passRate = pendingChecks.isEmpty

        ? 94

        : ((approvedToday / pendingChecks.length) * 100).round();



    return {

      'section': section,

      'lastSyncedAt': DateTime.now().toIso8601String(),

      'pendingChecks': pendingChecks,

      'randomAudits': randomAudits,

      'complaints': complaints,

      'rejections': rejections,

      'stats': {

        'pendingChecks': pendingChecks.length,

        'awaitingSupervisor': awaitingSupervisor,

        'passRate': passRate.clamp(0, 100),

        'averageScore': averageScore,

        'openComplaints':

            complaints.where((item) => item['status'] != 'closed').length,

        'rejectionsToday': rejections.length,

        'randomAudits': randomAudits.length,

      },

      'qcFeatures': {

        'foodQualityChecklist': pendingChecks.isNotEmpty,

        'presentationValidation': pendingChecks.any(

          (check) => (check['checklist'] as List).any(

            (item) => item['category'] == 'presentation',

          ),

        ),

        'temperatureValidation': pendingChecks.any(

          (check) => (check['checklist'] as List).any(

            (item) => item['category'] == 'temperature' && item['required'] == true,

          ),

        ),

        'hygieneValidation': pendingChecks.isNotEmpty,

        'supervisorApproval': awaitingSupervisor > 0 ||

            pendingChecks.any((check) => check['supervisorRequired'] == true),

        'randomAudits': randomAudits.isNotEmpty,

        'qcScoring': averageScore > 0,

        'complaintTracking': complaints.isNotEmpty,

        'rejectedFoodTracking': rejections.isNotEmpty,

      },

      'sections': MockSectionRegistry.filterSections,

    };

  }

}

