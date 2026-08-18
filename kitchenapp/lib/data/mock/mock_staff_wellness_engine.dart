import 'mock_section_registry.dart';
import 'mock_staff_directory.dart';

class MockStaffWellnessRegistry {
  MockStaffWellnessRegistry._();

  static final List<Map<String, dynamic>> _burnout = _seedBurnout();
  static final List<Map<String, dynamic>> _slowAlerts = _seedSlowAlerts();
  static final List<Map<String, dynamic>> _overwork = _seedOverwork();
  static final List<Map<String, dynamic>> _breaks = _seedBreaks();
  static int _aiScansToday = 6;

  static List<Map<String, dynamic>> burnoutFor(String section) {
    if (section == 'All') {
      return _burnout.map(_serializeBurnout).toList();
    }
    return _burnout
        .where((item) => item['section'] == section)
        .map(_serializeBurnout)
        .toList();
  }

  static List<Map<String, dynamic>> slowAlertsFor(String section) {
    if (section == 'All') {
      return _slowAlerts.map(_serializeSlowAlert).toList();
    }
    return _slowAlerts
        .where((item) => item['section'] == section)
        .map(_serializeSlowAlert)
        .toList();
  }

  static List<Map<String, dynamic>> overworkFor(String section) {
    if (section == 'All') {
      return _overwork.map(_serializeOverwork).toList();
    }
    return _overwork
        .where((item) => item['section'] == section)
        .map(_serializeOverwork)
        .toList();
  }

  static List<Map<String, dynamic>> breaksFor(String section) {
    if (section == 'All') {
      return _breaks.map(_serializeBreak).toList();
    }
    return _breaks
        .where((item) => item['section'] == section)
        .map(_serializeBreak)
        .toList();
  }

  static Map<String, dynamic> performAlertAction({
    required String alertId,
    required String action,
  }) {
    final burnout = _findBurnout(alertId);
    final slow = _findSlowAlert(alertId);
    final overwork = _findOverwork(alertId);
    final target = burnout ?? slow ?? overwork;

    if (target == null) {
      throw ArgumentError('Wellness alert not found');
    }

    final staffName = target['staffName'] as String;

    switch (action) {
      case 'acknowledge_alert':
        target['status'] = 'acknowledged';
        if (burnout != null) {
          burnout['riskScore'] = (burnout['riskScore'] as int) - 5;
        }
        return {
          'success': true,
          'message': 'Alert acknowledged · $staffName',
        };
      case 'schedule_break':
        target['status'] = 'break_scheduled';
        _breaks.add({
          'id': 'BRK-${_breaks.length + 1}'.padLeft(7, '0'),
          'staffId': target['staffId'],
          'staffName': staffName,
          'section': target['section'],
          'recommendedBreakIn': '10 min',
          'reason': 'AI break scheduled after alert',
          'status': 'pending',
        });
        return {
          'success': true,
          'message': 'Break scheduled · $staffName',
        };
      case 'escalate_supervisor':
        target['status'] = 'escalated';
        return {
          'success': true,
          'message': 'Supervisor notified · $staffName',
        };
      case 'dismiss_alert':
        if (slow != null) {
          slow['status'] = 'dismissed';
        } else if (overwork != null) {
          overwork['status'] = 'dismissed';
        } else if (burnout != null) {
          burnout['riskLevel'] = 'low';
          burnout['riskScore'] = 30;
        }
        return {
          'success': true,
          'message': 'Alert dismissed · $staffName',
        };
      default:
        throw ArgumentError('Unknown wellness alert action: $action');
    }
  }

  static Map<String, dynamic> performRecommendationAction({
    required String recommendationId,
    required String action,
  }) {
    final recommendation = _findBreak(recommendationId);
    if (recommendation == null) {
      throw ArgumentError('Break recommendation not found');
    }

    final staffName = recommendation['staffName'] as String;

    switch (action) {
      case 'apply_break':
        recommendation['status'] = 'applied';
        return {
          'success': true,
          'message': 'Break applied · $staffName',
        };
      case 'snooze_recommendation':
        recommendation['recommendedBreakIn'] = '30 min';
        recommendation['status'] = 'snoozed';
        return {
          'success': true,
          'message': 'Break snoozed · $staffName',
        };
      case 'dismiss_recommendation':
        recommendation['status'] = 'dismissed';
        return {
          'success': true,
          'message': 'Recommendation dismissed · $staffName',
        };
      default:
        throw ArgumentError('Unknown recommendation action: $action');
    }
  }

  static Map<String, dynamic> runScan() {
    _aiScansToday++;
    for (final item in _burnout) {
      if ((item['riskScore'] as int) < 90) {
        item['riskScore'] = (item['riskScore'] as int) + 2;
      }
    }
    return {
      'success': true,
      'message':
          'AI wellness scan complete · ${_burnout.length + _slowAlerts.length + _overwork.length} signals reviewed',
    };
  }

  static Map<String, dynamic>? _findBurnout(String id) {
    for (final item in _burnout) {
      if (item['id'] == id) {
        return item;
      }
    }
    return null;
  }

  static Map<String, dynamic>? _findSlowAlert(String id) {
    for (final item in _slowAlerts) {
      if (item['id'] == id) {
        return item;
      }
    }
    return null;
  }

  static Map<String, dynamic>? _findOverwork(String id) {
    for (final item in _overwork) {
      if (item['id'] == id) {
        return item;
      }
    }
    return null;
  }

  static Map<String, dynamic>? _findBreak(String id) {
    for (final item in _breaks) {
      if (item['id'] == id) {
        return item;
      }
    }
    return null;
  }

  static Map<String, dynamic> _serializeBurnout(Map<String, dynamic> item) {
    return {
      'id': item['id'],
      'staffId': item['staffId'],
      'staffName': item['staffName'],
      'section': item['section'],
      'riskLevel': item['riskLevel'],
      'riskScore': item['riskScore'],
      'predictionSummary': item['predictionSummary'],
      'availableActions': _alertActions(item),
    };
  }

  static Map<String, dynamic> _serializeSlowAlert(Map<String, dynamic> item) {
    return {
      'id': item['id'],
      'staffId': item['staffId'],
      'staffName': item['staffName'],
      'section': item['section'],
      'slowdownPercent': item['slowdownPercent'],
      'detectedAt': item['detectedAt'],
      'status': item['status'],
      'availableActions': item['status'] == 'active'
          ? ['acknowledge_alert', 'schedule_break', 'dismiss_alert']
          : <String>[],
    };
  }

  static Map<String, dynamic> _serializeOverwork(Map<String, dynamic> item) {
    return {
      'id': item['id'],
      'staffId': item['staffId'],
      'staffName': item['staffName'],
      'section': item['section'],
      'hoursOnShift': item['hoursOnShift'],
      'thresholdHours': item['thresholdHours'],
      'status': item['status'],
      'availableActions': item['status'] == 'active'
          ? [
              'acknowledge_alert',
              'schedule_break',
              'escalate_supervisor',
              'dismiss_alert',
            ]
          : <String>[],
    };
  }

  static Map<String, dynamic> _serializeBreak(Map<String, dynamic> item) {
    return {
      'id': item['id'],
      'staffId': item['staffId'],
      'staffName': item['staffName'],
      'section': item['section'],
      'recommendedBreakIn': item['recommendedBreakIn'],
      'reason': item['reason'],
      'status': item['status'],
      'availableActions': item['status'] == 'pending' ||
              item['status'] == 'snoozed'
          ? ['apply_break', 'snooze_recommendation', 'dismiss_recommendation']
          : <String>[],
    };
  }

  static List<String> _alertActions(Map<String, dynamic> item) {
    return [
      'acknowledge_alert',
      'schedule_break',
      'escalate_supervisor',
      'dismiss_alert',
    ];
  }

  static List<Map<String, dynamic>> _seedBurnout() {
    final staff = MockStaffDirectory.all;
    return [
      {
        'id': 'WLN-BRN-001',
        'staffId': staff[2]['id'],
        'staffName': staff[2]['name'],
        'section': staff[2]['section'],
        'riskLevel': 'high',
        'riskScore': 78,
        'predictionSummary':
            'Extended tandoor shift · 45m overtime · prep speed down 12%',
        'status': 'active',
      },
      {
        'id': 'WLN-BRN-002',
        'staffId': staff[3]['id'],
        'staffName': staff[3]['name'],
        'section': staff[3]['section'],
        'riskLevel': 'moderate',
        'riskScore': 58,
        'predictionSummary':
            'Repeated delay tickets · complaint ratio trending up',
        'status': 'active',
      },
    ];
  }

  static List<Map<String, dynamic>> _seedSlowAlerts() {
    return [
      {
        'id': 'WLN-SLW-001',
        'staffId': 'STF-003',
        'staffName': 'Ravi Tandoor',
        'section': 'Tandoor',
        'slowdownPercent': 18,
        'detectedAt': '12 min ago',
        'status': 'active',
      },
      {
        'id': 'WLN-SLW-002',
        'staffId': 'STF-004',
        'staffName': 'Mei Lin',
        'section': 'Chinese',
        'slowdownPercent': 24,
        'detectedAt': '28 min ago',
        'status': 'active',
      },
    ];
  }

  static List<Map<String, dynamic>> _seedOverwork() {
    return [
      {
        'id': 'WLN-OVR-001',
        'staffId': 'STF-003',
        'staffName': 'Ravi Tandoor',
        'section': 'Tandoor',
        'hoursOnShift': 10.5,
        'thresholdHours': 8,
        'status': 'active',
      },
      {
        'id': 'WLN-OVR-002',
        'staffId': 'STF-001',
        'staffName': 'Chef Arjun Mehta',
        'section': 'Main',
        'hoursOnShift': 9.2,
        'thresholdHours': 8,
        'status': 'acknowledged',
      },
    ];
  }

  static List<Map<String, dynamic>> _seedBreaks() {
    return [
      {
        'id': 'BRK-001',
        'staffId': 'STF-002',
        'staffName': 'Sous Chef Priya Nair',
        'section': 'Main',
        'recommendedBreakIn': '8 min',
        'reason': 'On shift 4h · no break logged · queue spike predicted',
        'status': 'pending',
      },
      {
        'id': 'BRK-002',
        'staffId': 'STF-003',
        'staffName': 'Ravi Tandoor',
        'section': 'Tandoor',
        'recommendedBreakIn': 'Now',
        'reason': 'Overwork alert + burnout risk high',
        'status': 'pending',
      },
    ];
  }

  static int get aiScansToday => _aiScansToday;
}

class MockStaffWellnessEngine {
  const MockStaffWellnessEngine._();

  static Map<String, dynamic> buildSnapshot({String section = 'All'}) {
    final burnoutPredictions = MockStaffWellnessRegistry.burnoutFor(section);
    final slowPerformanceAlerts =
        MockStaffWellnessRegistry.slowAlertsFor(section);
    final overworkAlerts = MockStaffWellnessRegistry.overworkFor(section);
    final breakRecommendations = MockStaffWellnessRegistry.breaksFor(section);

    final avgRisk = burnoutPredictions.isEmpty
        ? 0
        : (burnoutPredictions
                    .map((item) => item['riskScore'] as int)
                    .reduce((a, b) => a + b) /
                burnoutPredictions.length)
            .round();

    return {
      'section': section,
      'lastSyncedAt': DateTime.now().toIso8601String(),
      'burnoutPredictions': burnoutPredictions,
      'slowPerformanceAlerts': slowPerformanceAlerts,
      'overworkAlerts': overworkAlerts,
      'breakRecommendations': breakRecommendations,
      'stats': {
        'highBurnoutRisk': burnoutPredictions
            .where((item) => item['riskLevel'] == 'high')
            .length,
        'activeSlowAlerts': slowPerformanceAlerts
            .where((item) => item['status'] == 'active')
            .length,
        'overworkAlerts': overworkAlerts
            .where((item) => item['status'] == 'active')
            .length,
        'pendingBreaks': breakRecommendations
            .where((item) => item['status'] == 'pending')
            .length,
        'aiScansToday': MockStaffWellnessRegistry.aiScansToday,
        'avgRiskScore': avgRisk,
      },
      'wellnessFeatures': {
        'burnoutPrediction': burnoutPredictions.isNotEmpty,
        'slowPerformanceDetection': slowPerformanceAlerts.isNotEmpty,
        'overworkAlerts': overworkAlerts.isNotEmpty,
        'breakRecommendations': breakRecommendations.isNotEmpty,
      },
      'sections': MockSectionRegistry.filterSections,
    };
  }
}
