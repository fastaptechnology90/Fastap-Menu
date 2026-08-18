import 'mock_section_registry.dart';

class MockLiveAlertRegistry {
  MockLiveAlertRegistry._();

  static final List<Map<String, dynamic>> _alerts = _seedAlerts();
  static int _resolvedToday = 8;

  static List<Map<String, dynamic>> alertsFor(String section) {
    if (section == 'All') {
      return _alerts.map(_serializeAlert).toList();
    }
    return _alerts
        .where((item) => item['section'] == section)
        .map(_serializeAlert)
        .toList();
  }

  static Map<String, dynamic> performAction({
    required String alertId,
    required String action,
  }) {
    final alert = _findAlert(alertId);
    if (alert == null) {
      throw ArgumentError('Live alert not found');
    }

    final title = alert['title'] as String;

    switch (action) {
      case 'acknowledge_alert':
        alert['status'] = 'acknowledged';
        return {
          'success': true,
          'message': 'Alert acknowledged · $title',
        };
      case 'escalate_alert':
        alert['status'] = 'escalated';
        alert['severity'] = 'critical';
        return {
          'success': true,
          'message': 'Alert escalated · $title',
        };
      case 'resolve_alert':
        alert['status'] = 'resolved';
        _resolvedToday++;
        return {
          'success': true,
          'message': 'Alert resolved · $title',
        };
      case 'snooze_alert':
        alert['status'] = 'snoozed';
        return {
          'success': true,
          'message': 'Alert snoozed · $title',
        };
      case 'broadcast_alert':
        alert['status'] = 'broadcast';
        return {
          'success': true,
          'message': 'Emergency broadcast sent · $title',
        };
      default:
        throw ArgumentError('Unknown live alert action: $action');
    }
  }

  static Map<String, dynamic> syncAll() {
    for (final alert in _alerts) {
      if (alert['status'] == 'snoozed') {
        alert['status'] = 'active';
      }
    }
    return {
      'success': true,
      'message': 'Live alert engine synced · ${_alerts.length} alerts',
    };
  }

  static Map<String, dynamic>? _findAlert(String alertId) {
    for (final alert in _alerts) {
      if (alert['id'] == alertId) {
        return alert;
      }
    }
    return null;
  }

  static Map<String, dynamic> _serializeAlert(Map<String, dynamic> alert) {
    return {
      'id': alert['id'],
      'alertType': alert['alertType'],
      'title': alert['title'],
      'section': alert['section'],
      'severity': alert['severity'],
      'message': alert['message'],
      'triggeredAt': alert['triggeredAt'],
      'status': alert['status'],
      'availableActions': _actionsForAlert(alert),
    };
  }

  static List<String> _actionsForAlert(Map<String, dynamic> alert) {
    if (alert['status'] == 'resolved') {
      return <String>[];
    }

    final actions = <String>[
      'acknowledge_alert',
      'resolve_alert',
      'snooze_alert',
    ];

    if (alert['severity'] == 'high' || alert['severity'] == 'critical') {
      actions.add('escalate_alert');
    }

    if (alert['alertType'] == 'emergency') {
      actions.add('broadcast_alert');
    }

    return actions;
  }

  static List<Map<String, dynamic>> _seedAlerts() {
    return [
      {
        'id': 'ALT-DLY-001',
        'alertType': 'delay',
        'title': 'KOT delay · Table 12',
        'section': 'Main',
        'severity': 'high',
        'message': 'Order delayed 18 min · butter chicken re-fire pending',
        'triggeredAt': '2 min ago',
        'status': 'active',
      },
      {
        'id': 'ALT-VIP-001',
        'alertType': 'vip',
        'title': 'VIP guest arrival',
        'section': 'Main',
        'severity': 'critical',
        'message': 'Suite 804 VIP · 6 covers · tasting menu in 25 min',
        'triggeredAt': '5 min ago',
        'status': 'active',
      },
      {
        'id': 'ALT-EMG-001',
        'alertType': 'emergency',
        'title': 'Walk-in cooler temp spike',
        'section': 'Continental',
        'severity': 'critical',
        'message': 'Temperature 9°C · threshold 4°C · stock at risk',
        'triggeredAt': 'Just now',
        'status': 'active',
      },
      {
        'id': 'ALT-STK-001',
        'alertType': 'low_stock',
        'title': 'Low stock · Basmati rice',
        'section': 'Main',
        'severity': 'medium',
        'message': '12 kg remaining · par level 25 kg · banquet tonight',
        'triggeredAt': '14 min ago',
        'status': 'active',
      },
      {
        'id': 'ALT-EQP-001',
        'alertType': 'equipment',
        'title': 'Fryer #2 offline',
        'section': 'Main',
        'severity': 'high',
        'message': 'Smart fryer disconnected · filter maintenance overdue',
        'triggeredAt': '8 min ago',
        'status': 'acknowledged',
      },
      {
        'id': 'ALT-HYG-001',
        'alertType': 'hygiene',
        'title': 'Hygiene audit due',
        'section': 'Tandoor',
        'severity': 'medium',
        'message': 'Surface sanitization log missing · shift handover gap',
        'triggeredAt': '22 min ago',
        'status': 'active',
      },
    ];
  }

  static int get resolvedToday => _resolvedToday;
}

class MockLiveAlertEngine {
  const MockLiveAlertEngine._();

  static Map<String, dynamic> buildSnapshot({String section = 'All'}) {
    final alerts = MockLiveAlertRegistry.alertsFor(section);
    final active = alerts.where((item) => item['status'] == 'active').toList();

    return {
      'section': section,
      'lastSyncedAt': DateTime.now().toIso8601String(),
      'alerts': alerts,
      'stats': {
        'activeAlerts': active.length,
        'criticalAlerts': alerts
            .where((item) => item['severity'] == 'critical')
            .length,
        'delayAlerts':
            alerts.where((item) => item['alertType'] == 'delay').length,
        'vipAlerts': alerts.where((item) => item['alertType'] == 'vip').length,
        'emergencyAlerts':
            alerts.where((item) => item['alertType'] == 'emergency').length,
        'resolvedToday': MockLiveAlertRegistry.resolvedToday,
      },
      'alertFeatures': {
        'delayAlerts':
            alerts.any((item) => item['alertType'] == 'delay'),
        'vipAlerts': alerts.any((item) => item['alertType'] == 'vip'),
        'emergencyAlerts':
            alerts.any((item) => item['alertType'] == 'emergency'),
        'lowStockAlerts':
            alerts.any((item) => item['alertType'] == 'low_stock'),
        'equipmentAlerts':
            alerts.any((item) => item['alertType'] == 'equipment'),
        'hygieneAlerts':
            alerts.any((item) => item['alertType'] == 'hygiene'),
      },
      'sections': MockSectionRegistry.filterSections,
    };
  }
}
