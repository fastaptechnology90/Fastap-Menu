import 'mock_section_registry.dart';

class MockSmartwatchSupportRegistry {
  MockSmartwatchSupportRegistry._();

  static final List<Map<String, dynamic>> _orderAlerts = _seedOrderAlerts();
  static final List<Map<String, dynamic>> _delayAlerts = _seedDelayAlerts();
  static final List<Map<String, dynamic>> _emergencyAlerts =
      _seedEmergencyAlerts();
  static final List<Map<String, dynamic>> _taskNotifications =
      _seedTaskNotifications();
  static int _pushedToday = 24;
  static const int _watchesConnected = 5;

  static List<Map<String, dynamic>> orderAlertsFor(String section) {
    return _filterSection(_orderAlerts, section).map(_serializeOrder).toList();
  }

  static List<Map<String, dynamic>> delayAlertsFor(String section) {
    return _filterSection(_delayAlerts, section).map(_serializeDelay).toList();
  }

  static List<Map<String, dynamic>> emergencyAlertsFor(String section) {
    return _filterSection(_emergencyAlerts, section)
        .map(_serializeEmergency)
        .toList();
  }

  static List<Map<String, dynamic>> taskNotificationsFor(String section) {
    return _filterSection(_taskNotifications, section)
        .map(_serializeTask)
        .toList();
  }

  static Map<String, dynamic> performOrderAction({
    required String alertId,
    required String action,
  }) {
    final alert = _find(_orderAlerts, alertId);
    if (alert == null) {
      throw ArgumentError('Order alert not found');
    }

    final title = alert['title'] as String;

    switch (action) {
      case 'push_to_watch':
        alert['status'] = 'pushed';
        _pushedToday++;
        return {'success': true, 'message': 'Order alert pushed · $title'};
      case 'acknowledge_order':
        alert['status'] = 'acknowledged';
        return {'success': true, 'message': 'Order alert acknowledged · $title'};
      case 'mute_order':
        alert['status'] = 'muted';
        return {'success': true, 'message': 'Order alert muted · $title'};
      default:
        throw ArgumentError('Unknown order alert action: $action');
    }
  }

  static Map<String, dynamic> performDelayAction({
    required String alertId,
    required String action,
  }) {
    final alert = _find(_delayAlerts, alertId);
    if (alert == null) {
      throw ArgumentError('Delay alert not found');
    }

    final title = alert['title'] as String;

    switch (action) {
      case 'push_to_watch':
        alert['status'] = 'pushed';
        _pushedToday++;
        return {'success': true, 'message': 'Delay alert pushed · $title'};
      case 'escalate_delay':
        alert['severity'] = 'critical';
        alert['status'] = 'escalated';
        return {'success': true, 'message': 'Delay escalated · $title'};
      case 'snooze_delay':
        alert['status'] = 'snoozed';
        return {'success': true, 'message': 'Delay alert snoozed · $title'};
      default:
        throw ArgumentError('Unknown delay alert action: $action');
    }
  }

  static Map<String, dynamic> performEmergencyAction({
    required String alertId,
    required String action,
  }) {
    final alert = _find(_emergencyAlerts, alertId);
    if (alert == null) {
      throw ArgumentError('Emergency alert not found');
    }

    final title = alert['title'] as String;

    switch (action) {
      case 'broadcast_emergency':
        alert['status'] = 'broadcast';
        _pushedToday += 2;
        return {
          'success': true,
          'message': 'Emergency broadcast to all watches · $title',
        };
      case 'acknowledge_emergency':
        alert['status'] = 'acknowledged';
        return {'success': true, 'message': 'Emergency acknowledged · $title'};
      case 'resolve_emergency':
        alert['status'] = 'resolved';
        return {'success': true, 'message': 'Emergency resolved · $title'};
      default:
        throw ArgumentError('Unknown emergency alert action: $action');
    }
  }

  static Map<String, dynamic> performTaskAction({
    required String taskId,
    required String action,
  }) {
    final task = _find(_taskNotifications, taskId);
    if (task == null) {
      throw ArgumentError('Task notification not found');
    }

    final title = task['title'] as String;

    switch (action) {
      case 'push_to_watch':
        task['status'] = 'pushed';
        _pushedToday++;
        return {'success': true, 'message': 'Task notification pushed · $title'};
      case 'mark_done':
        task['status'] = 'completed';
        return {'success': true, 'message': 'Task marked done · $title'};
      case 'reassign_task':
        task['status'] = 'reassigned';
        return {'success': true, 'message': 'Task reassigned · $title'};
      default:
        throw ArgumentError('Unknown task notification action: $action');
    }
  }

  static Map<String, dynamic> pushAll() {
    for (final alert in _orderAlerts) {
      if (alert['status'] == 'pending') {
        alert['status'] = 'pushed';
      }
    }
    for (final alert in _delayAlerts) {
      if (alert['status'] == 'active') {
        alert['status'] = 'pushed';
      }
    }
    for (final task in _taskNotifications) {
      if (task['status'] == 'pending') {
        task['status'] = 'pushed';
      }
    }
    _pushedToday += 6;
    return {
      'success': true,
      'message': 'All smartwatch alerts pushed · $_watchesConnected watches',
    };
  }

  static int get pushedToday => _pushedToday;
  static int get watchesConnected => _watchesConnected;

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

  static Map<String, dynamic> _serializeOrder(Map<String, dynamic> item) {
    return {
      'id': item['id'],
      'title': item['title'],
      'section': item['section'],
      'priority': item['priority'],
      'recipient': item['recipient'],
      'status': item['status'],
      'availableActions': const [
        'push_to_watch',
        'acknowledge_order',
        'mute_order',
      ],
    };
  }

  static Map<String, dynamic> _serializeDelay(Map<String, dynamic> item) {
    return {
      'id': item['id'],
      'title': item['title'],
      'section': item['section'],
      'delayMinutes': item['delayMinutes'],
      'severity': item['severity'],
      'status': item['status'],
      'availableActions': const [
        'push_to_watch',
        'escalate_delay',
        'snooze_delay',
      ],
    };
  }

  static Map<String, dynamic> _serializeEmergency(Map<String, dynamic> item) {
    return {
      'id': item['id'],
      'title': item['title'],
      'section': item['section'],
      'alertType': item['alertType'],
      'severity': item['severity'],
      'status': item['status'],
      'availableActions': const [
        'broadcast_emergency',
        'acknowledge_emergency',
        'resolve_emergency',
      ],
    };
  }

  static Map<String, dynamic> _serializeTask(Map<String, dynamic> item) {
    return {
      'id': item['id'],
      'title': item['title'],
      'section': item['section'],
      'assignee': item['assignee'],
      'dueLabel': item['dueLabel'],
      'status': item['status'],
      'availableActions': const [
        'push_to_watch',
        'mark_done',
        'reassign_task',
      ],
    };
  }

  static List<Map<String, dynamic>> _seedOrderAlerts() {
    return [
      {
        'id': 'SW-ORD-001',
        'title': 'VIP order #2847 ready for pass',
        'section': 'Main',
        'priority': 'high',
        'recipient': 'Expeditor watch',
        'status': 'pending',
      },
      {
        'id': 'SW-ORD-002',
        'title': 'Queue surge · 8 tickets incoming',
        'section': 'Main',
        'priority': 'medium',
        'recipient': 'Chef de cuisine watch',
        'status': 'pushed',
      },
    ];
  }

  static List<Map<String, dynamic>> _seedDelayAlerts() {
    return [
      {
        'id': 'SW-DLY-001',
        'title': 'Main grill 18 min behind',
        'section': 'Main',
        'delayMinutes': 18,
        'severity': 'critical',
        'status': 'active',
      },
      {
        'id': 'SW-DLY-002',
        'title': 'Tandoor pickup lane delay',
        'section': 'Tandoor',
        'delayMinutes': 11,
        'severity': 'high',
        'status': 'active',
      },
    ];
  }

  static List<Map<String, dynamic>> _seedEmergencyAlerts() {
    return [
      {
        'id': 'SW-EMG-001',
        'title': 'Panic button test · Pass station',
        'section': 'Main',
        'alertType': 'panic_test',
        'severity': 'critical',
        'status': 'active',
      },
      {
        'id': 'SW-EMG-002',
        'title': 'Fire suppression drill reminder',
        'section': 'Continental',
        'alertType': 'safety_drill',
        'severity': 'medium',
        'status': 'acknowledged',
      },
    ];
  }

  static List<Map<String, dynamic>> _seedTaskNotifications() {
    return [
      {
        'id': 'SW-TSK-001',
        'title': 'Mise en place checklist due',
        'section': 'Main',
        'assignee': 'Prep lead',
        'dueLabel': '15 min',
        'status': 'pending',
      },
      {
        'id': 'SW-TSK-002',
        'title': 'Temperature log · Walk-in cooler',
        'section': 'Continental',
        'assignee': 'Sous chef',
        'dueLabel': '30 min',
        'status': 'pending',
      },
      {
        'id': 'SW-TSK-003',
        'title': 'Shift handover notes',
        'section': 'Main',
        'assignee': 'Chef Rahul',
        'dueLabel': 'End of shift',
        'status': 'pushed',
      },
    ];
  }
}

class MockSmartwatchSupportEngine {
  const MockSmartwatchSupportEngine._();

  static Map<String, dynamic> buildSnapshot({String section = 'All'}) {
    final orderAlerts = MockSmartwatchSupportRegistry.orderAlertsFor(section);
    final delayAlerts = MockSmartwatchSupportRegistry.delayAlertsFor(section);
    final emergencyAlerts =
        MockSmartwatchSupportRegistry.emergencyAlertsFor(section);
    final taskNotifications =
        MockSmartwatchSupportRegistry.taskNotificationsFor(section);

    return {
      'section': section,
      'lastSyncedAt': DateTime.now().toIso8601String(),
      'orderAlerts': orderAlerts,
      'delayAlerts': delayAlerts,
      'emergencyAlerts': emergencyAlerts,
      'taskNotifications': taskNotifications,
      'stats': {
        'activeOrderAlerts': orderAlerts
            .where((item) =>
                item['status'] == 'pending' || item['status'] == 'pushed')
            .length,
        'activeDelayAlerts': delayAlerts
            .where((item) =>
                item['status'] == 'active' || item['status'] == 'escalated')
            .length,
        'emergencyActive': emergencyAlerts
            .where((item) => item['status'] != 'resolved')
            .length,
        'pendingTasks': taskNotifications
            .where((item) => item['status'] == 'pending')
            .length,
        'watchesConnected': MockSmartwatchSupportRegistry.watchesConnected,
        'pushedToday': MockSmartwatchSupportRegistry.pushedToday,
      },
      'smartwatchFeatures': {
        'orderAlerts': orderAlerts.isNotEmpty,
        'delayAlerts': delayAlerts.isNotEmpty,
        'emergencyAlerts': emergencyAlerts.isNotEmpty,
        'taskNotifications': taskNotifications.isNotEmpty,
      },
      'sections': MockSectionRegistry.filterSections,
    };
  }
}
