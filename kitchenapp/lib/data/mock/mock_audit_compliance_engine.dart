import 'mock_section_registry.dart';

class MockAuditComplianceRegistry {
  MockAuditComplianceRegistry._();

  static final List<Map<String, dynamic>> _actions = _seedActions();
  static final List<Map<String, dynamic>> _foodSafety = _seedFoodSafety();
  static final List<Map<String, dynamic>> _hygiene = _seedHygiene();
  static final List<Map<String, dynamic>> _staff = _seedStaff();
  static final List<Map<String, dynamic>> _incidents = _seedIncidents();
  static int _exportedToday = 11;

  static List<Map<String, dynamic>> actionsFor(String section) {
    return _filterSection(_actions, section).map(_serializeAction).toList();
  }

  static List<Map<String, dynamic>> foodSafetyFor(String section) {
    return _filterSection(_foodSafety, section)
        .map(_serializeFoodSafety)
        .toList();
  }

  static List<Map<String, dynamic>> hygieneFor(String section) {
    return _filterSection(_hygiene, section).map(_serializeHygiene).toList();
  }

  static List<Map<String, dynamic>> staffFor(String section) {
    return _filterSection(_staff, section).map(_serializeStaff).toList();
  }

  static List<Map<String, dynamic>> incidentsFor(String section) {
    return _filterSection(_incidents, section).map(_serializeIncident).toList();
  }

  static Map<String, dynamic> performActionLogAction({
    required String logId,
    required String action,
  }) {
    final log = _find(_actions, logId);
    if (log == null) {
      throw ArgumentError('Action log not found');
    }

    final label = log['actionLabel'] as String;

    switch (action) {
      case 'review_log':
        log['status'] = 'reviewed';
        return {'success': true, 'message': 'Action log reviewed · $label'};
      case 'flag_action':
        log['status'] = 'flagged';
        log['severity'] = 'high';
        return {'success': true, 'message': 'Action flagged · $label'};
      case 'archive_log':
        log['status'] = 'archived';
        _exportedToday++;
        return {'success': true, 'message': 'Action log archived · $label'};
      default:
        throw ArgumentError('Unknown action log action: $action');
    }
  }

  static Map<String, dynamic> performFoodSafetyAction({
    required String logId,
    required String action,
  }) {
    final log = _find(_foodSafety, logId);
    if (log == null) {
      throw ArgumentError('Food safety log not found');
    }

    final name = log['checkName'] as String;

    switch (action) {
      case 'acknowledge_check':
        log['status'] = 'acknowledged';
        return {'success': true, 'message': 'Food safety check acknowledged · $name'};
      case 'escalate_check':
        log['status'] = 'escalated';
        return {'success': true, 'message': 'Food safety escalated · $name'};
      case 'schedule_recheck':
        log['status'] = 'scheduled';
        return {'success': true, 'message': 'Recheck scheduled · $name'};
      default:
        throw ArgumentError('Unknown food safety action: $action');
    }
  }

  static Map<String, dynamic> performHygieneAction({
    required String logId,
    required String action,
  }) {
    final log = _find(_hygiene, logId);
    if (log == null) {
      throw ArgumentError('Hygiene log not found');
    }

    final name = log['taskName'] as String;

    switch (action) {
      case 'acknowledge_task':
        log['status'] = 'acknowledged';
        return {'success': true, 'message': 'Hygiene task acknowledged · $name'};
      case 'schedule_clean':
        log['status'] = 'scheduled';
        return {'success': true, 'message': 'Cleaning scheduled · $name'};
      case 'mark_compliant':
        log['status'] = 'compliant';
        log['complianceLevel'] = 'ok';
        return {'success': true, 'message': 'Marked compliant · $name'};
      default:
        throw ArgumentError('Unknown hygiene action: $action');
    }
  }

  static Map<String, dynamic> performStaffAction({
    required String logId,
    required String action,
  }) {
    final log = _find(_staff, logId);
    if (log == null) {
      throw ArgumentError('Staff activity log not found');
    }

    final label = log['activityLabel'] as String;

    switch (action) {
      case 'review_activity':
        log['status'] = 'reviewed';
        return {'success': true, 'message': 'Staff activity reviewed · $label'};
      case 'notify_manager':
        log['status'] = 'notified';
        return {'success': true, 'message': 'Manager notified · $label'};
      case 'clear_alert':
        log['status'] = 'cleared';
        return {'success': true, 'message': 'Staff alert cleared · $label'};
      default:
        throw ArgumentError('Unknown staff activity action: $action');
    }
  }

  static Map<String, dynamic> performIncidentAction({
    required String incidentId,
    required String action,
  }) {
    final incident = _find(_incidents, incidentId);
    if (incident == null) {
      throw ArgumentError('Incident log not found');
    }

    final title = incident['incidentTitle'] as String;

    switch (action) {
      case 'investigate_incident':
        incident['status'] = 'investigating';
        return {'success': true, 'message': 'Investigation opened · $title'};
      case 'escalate_incident':
        incident['severity'] = 'critical';
        incident['status'] = 'escalated';
        return {'success': true, 'message': 'Incident escalated · $title'};
      case 'close_incident':
        incident['status'] = 'closed';
        _exportedToday++;
        return {'success': true, 'message': 'Incident closed · $title'};
      default:
        throw ArgumentError('Unknown incident action: $action');
    }
  }

  static Map<String, dynamic> exportAll() {
    for (final log in _actions) {
      if (log['status'] == 'pending') {
        log['status'] = 'reviewed';
      }
    }
    for (final log in _foodSafety) {
      if (log['status'] == 'flagged') {
        log['status'] = 'acknowledged';
      }
    }
    _exportedToday += 5;
    return {
      'success': true,
      'message': 'Audit compliance export completed · 5 log categories',
    };
  }

  static int get exportedToday => _exportedToday;

  static List<Map<String, dynamic>> _filterSection(
    List<Map<String, dynamic>> items,
    String section,
  ) {
    if (section == 'All') {
      return items;
    }
    return items.where((item) => item['section'] == section).toList();
  }

  static Map<String, dynamic>? _find(
    List<Map<String, dynamic>> items,
    String id,
  ) {
    for (final item in items) {
      if (item['id'] == id) {
        return item;
      }
    }
    return null;
  }

  static Map<String, dynamic> _serializeAction(Map<String, dynamic> item) {
    return {
      'id': item['id'],
      'actionLabel': item['actionLabel'],
      'actorName': item['actorName'],
      'section': item['section'],
      'timestampLabel': item['timestampLabel'],
      'severity': item['severity'],
      'status': item['status'],
      'availableActions': const ['review_log', 'flag_action', 'archive_log'],
    };
  }

  static Map<String, dynamic> _serializeFoodSafety(Map<String, dynamic> item) {
    return {
      'id': item['id'],
      'checkName': item['checkName'],
      'section': item['section'],
      'reading': item['reading'],
      'threshold': item['threshold'],
      'status': item['status'],
      'availableActions': const [
        'acknowledge_check',
        'escalate_check',
        'schedule_recheck',
      ],
    };
  }

  static Map<String, dynamic> _serializeHygiene(Map<String, dynamic> item) {
    return {
      'id': item['id'],
      'taskName': item['taskName'],
      'section': item['section'],
      'dueLabel': item['dueLabel'],
      'complianceLevel': item['complianceLevel'],
      'status': item['status'],
      'availableActions': const [
        'acknowledge_task',
        'schedule_clean',
        'mark_compliant',
      ],
    };
  }

  static Map<String, dynamic> _serializeStaff(Map<String, dynamic> item) {
    return {
      'id': item['id'],
      'activityLabel': item['activityLabel'],
      'staffName': item['staffName'],
      'section': item['section'],
      'activityType': item['activityType'],
      'status': item['status'],
      'availableActions': const [
        'review_activity',
        'notify_manager',
        'clear_alert',
      ],
    };
  }

  static Map<String, dynamic> _serializeIncident(Map<String, dynamic> item) {
    return {
      'id': item['id'],
      'incidentTitle': item['incidentTitle'],
      'section': item['section'],
      'severity': item['severity'],
      'reportedAt': item['reportedAt'],
      'status': item['status'],
      'availableActions': const [
        'investigate_incident',
        'escalate_incident',
        'close_incident',
      ],
    };
  }

  static List<Map<String, dynamic>> _seedActions() {
    return [
      {
        'id': 'AU-ACT-001',
        'actionLabel': 'KDS order bump · #2847',
        'actorName': 'Chef Rahul',
        'section': 'Main',
        'timestampLabel': '12 min ago',
        'severity': 'info',
        'status': 'pending',
      },
      {
        'id': 'AU-ACT-002',
        'actionLabel': 'Section reroute · Tandoor',
        'actorName': 'Supervisor Meera',
        'section': 'Tandoor',
        'timestampLabel': '28 min ago',
        'severity': 'medium',
        'status': 'reviewed',
      },
    ];
  }

  static List<Map<String, dynamic>> _seedFoodSafety() {
    return [
      {
        'id': 'AU-FS-001',
        'checkName': 'Walk-in cooler temperature',
        'section': 'Continental',
        'reading': '6°C',
        'threshold': '≤ 4°C',
        'status': 'flagged',
      },
      {
        'id': 'AU-FS-002',
        'checkName': 'Allergen prep separation',
        'section': 'Main',
        'reading': 'Verified',
        'threshold': 'Required',
        'status': 'compliant',
      },
    ];
  }

  static List<Map<String, dynamic>> _seedHygiene() {
    return [
      {
        'id': 'AU-HYG-001',
        'taskName': 'Handwash station inspection',
        'section': 'Main',
        'dueLabel': 'Overdue 2 hr',
        'complianceLevel': 'warning',
        'status': 'pending',
      },
      {
        'id': 'AU-HYG-002',
        'taskName': 'Floor sanitization · Tandoor',
        'section': 'Tandoor',
        'dueLabel': 'Completed today',
        'complianceLevel': 'ok',
        'status': 'compliant',
      },
    ];
  }

  static List<Map<String, dynamic>> _seedStaff() {
    return [
      {
        'id': 'AU-STF-001',
        'activityLabel': 'Late clock-in · prep shift',
        'staffName': 'Prep lead',
        'section': 'Main',
        'activityType': 'attendance',
        'status': 'pending',
      },
      {
        'id': 'AU-STF-002',
        'activityLabel': 'Unauthorized pass printer override',
        'staffName': 'Runner · Arjun',
        'section': 'Main',
        'activityType': 'security',
        'status': 'flagged',
      },
    ];
  }

  static List<Map<String, dynamic>> _seedIncidents() {
    return [
      {
        'id': 'AU-INC-001',
        'incidentTitle': 'Slip near pass station',
        'section': 'Main',
        'severity': 'high',
        'reportedAt': '45 min ago',
        'status': 'open',
      },
      {
        'id': 'AU-INC-002',
        'incidentTitle': 'Customer complaint · foreign object',
        'section': 'Continental',
        'severity': 'critical',
        'reportedAt': '2 hr ago',
        'status': 'investigating',
      },
    ];
  }
}

class MockAuditComplianceEngine {
  const MockAuditComplianceEngine._();

  static Map<String, dynamic> buildSnapshot({String section = 'All'}) {
    final actionLogs = MockAuditComplianceRegistry.actionsFor(section);
    final foodSafetyLogs = MockAuditComplianceRegistry.foodSafetyFor(section);
    final hygieneLogs = MockAuditComplianceRegistry.hygieneFor(section);
    final staffActivityLogs = MockAuditComplianceRegistry.staffFor(section);
    final incidentLogs = MockAuditComplianceRegistry.incidentsFor(section);

    return {
      'section': section,
      'lastSyncedAt': DateTime.now().toIso8601String(),
      'actionLogs': actionLogs,
      'foodSafetyLogs': foodSafetyLogs,
      'hygieneLogs': hygieneLogs,
      'staffActivityLogs': staffActivityLogs,
      'incidentLogs': incidentLogs,
      'stats': {
        'pendingReviews': actionLogs
                .where((item) => item['status'] == 'pending')
                .length +
            staffActivityLogs
                .where((item) => item['status'] == 'pending')
                .length,
        'foodSafetyFlags': foodSafetyLogs
            .where((item) => item['status'] == 'flagged')
            .length,
        'hygieneIssues': hygieneLogs
            .where((item) => item['complianceLevel'] != 'ok')
            .length,
        'staffAlerts': staffActivityLogs
            .where((item) =>
                item['status'] == 'pending' || item['status'] == 'flagged')
            .length,
        'openIncidents': incidentLogs
            .where((item) => item['status'] != 'closed')
            .length,
        'exportedToday': MockAuditComplianceRegistry.exportedToday,
      },
      'auditFeatures': {
        'actionLogs': actionLogs.isNotEmpty,
        'foodSafetyLogs': foodSafetyLogs.isNotEmpty,
        'hygieneLogs': hygieneLogs.isNotEmpty,
        'staffActivityLogs': staffActivityLogs.isNotEmpty,
        'incidentLogs': incidentLogs.isNotEmpty,
      },
      'sections': MockSectionRegistry.filterSections,
    };
  }
}
