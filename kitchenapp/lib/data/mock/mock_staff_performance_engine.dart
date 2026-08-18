import 'mock_section_registry.dart';
import 'mock_staff_directory.dart';

class MockStaffPerformanceRegistry {
  MockStaffPerformanceRegistry._();

  static final List<Map<String, dynamic>> _records = _seedRecords();
  static final List<Map<String, dynamic>> _incentives = _seedIncentives();
  static int _bonusesThisMonth = 4;

  static List<Map<String, dynamic>> recordsFor(String section) {
    if (section == 'All') {
      return _records.map(_serializeRecord).toList();
    }
    return _records
        .where((item) => item['section'] == section)
        .map(_serializeRecord)
        .toList();
  }

  static List<Map<String, dynamic>> incentivesFor(String section) {
    if (section == 'All') {
      return _incentives.map(_serializeIncentive).toList();
    }
    return _incentives
        .where((item) => item['section'] == section)
        .map(_serializeIncentive)
        .toList();
  }

  static Map<String, dynamic> performStaffAction({
    required String staffId,
    required String action,
  }) {
    final record = _findRecord(staffId);
    if (record == null) {
      throw ArgumentError('Staff performance record not found');
    }

    final staffName = record['staffName'] as String;

    switch (action) {
      case 'refresh_metrics':
        record['productivityScore'] =
            ((record['productivityScore'] as int) + 2).clamp(0, 100);
        record['trend'] = 'up';
        return {
          'success': true,
          'message': 'Metrics refreshed · $staffName',
        };
      case 'apply_speed_incentive':
        _incentives.add({
          'id': 'INC-${_incentives.length + 1}'.padLeft(7, '0'),
          'staffId': staffId,
          'staffName': staffName,
          'section': record['section'],
          'incentiveType': 'speed_incentive',
          'amountLabel': '₹500',
          'reason': 'Fast prep streak · ${record['preparationSpeed']}',
          'status': 'pending',
        });
        return {
          'success': true,
          'message': 'Speed incentive queued · $staffName',
        };
      case 'apply_quality_reward':
        _incentives.add({
          'id': 'INC-${_incentives.length + 1}'.padLeft(7, '0'),
          'staffId': staffId,
          'staffName': staffName,
          'section': record['section'],
          'incentiveType': 'quality_reward',
          'amountLabel': '₹750',
          'reason': 'Quality score ${record['qualityScore']} · zero complaints',
          'status': 'pending',
        });
        return {
          'success': true,
          'message': 'Quality reward queued · $staffName',
        };
      case 'apply_performance_bonus':
        _incentives.add({
          'id': 'INC-${_incentives.length + 1}'.padLeft(7, '0'),
          'staffId': staffId,
          'staffName': staffName,
          'section': record['section'],
          'incentiveType': 'performance_bonus',
          'amountLabel': '₹1,200',
          'reason':
              'Top performer · productivity ${record['productivityScore']}',
          'status': 'pending',
        });
        return {
          'success': true,
          'message': 'Performance bonus queued · $staffName',
        };
      case 'flag_coaching':
        record['trend'] = 'coaching';
        return {
          'success': true,
          'message': 'Coaching flag raised · $staffName',
        };
      case 'acknowledge_review':
        record['trend'] = 'stable';
        return {
          'success': true,
          'message': 'Performance review acknowledged · $staffName',
        };
      default:
        throw ArgumentError('Unknown staff performance action: $action');
    }
  }

  static Map<String, dynamic> performIncentiveAction({
    required String incentiveId,
    required String action,
  }) {
    final incentive = _findIncentive(incentiveId);
    if (incentive == null) {
      throw ArgumentError('Incentive not found');
    }

    final staffName = incentive['staffName'] as String;

    switch (action) {
      case 'approve_incentive':
        incentive['status'] = 'approved';
        return {
          'success': true,
          'message': 'Incentive approved · $staffName',
        };
      case 'pay_incentive':
        incentive['status'] = 'paid';
        _bonusesThisMonth++;
        return {
          'success': true,
          'message': 'Incentive paid · $staffName',
        };
      case 'reject_incentive':
        incentive['status'] = 'rejected';
        return {
          'success': true,
          'message': 'Incentive rejected · $staffName',
        };
      default:
        throw ArgumentError('Unknown incentive action: $action');
    }
  }

  static Map<String, dynamic> recalculate() {
    for (final record in _records) {
      record['ordersCompleted'] = (record['ordersCompleted'] as int) + 1;
      if ((record['delayRatio'] as int) > 0) {
        record['delayRatio'] = (record['delayRatio'] as int) - 1;
      }
      record['productivityScore'] =
          ((record['productivityScore'] as int) + 1).clamp(0, 100);
    }
    _recomputeRanks();
    return {
      'success': true,
      'message':
          'Performance metrics recalculated · ${_records.length} staff',
    };
  }

  static void _recomputeRanks() {
    final sorted = List<Map<String, dynamic>>.from(_records)
      ..sort(
        (a, b) =>
            (b['productivityScore'] as int).compareTo(a['productivityScore']),
      );
    for (var i = 0; i < sorted.length; i++) {
      sorted[i]['rankLabel'] = '#${i + 1}';
    }
  }

  static Map<String, dynamic>? _findRecord(String staffId) {
    for (final record in _records) {
      if (record['staffId'] == staffId) {
        return record;
      }
    }
    return null;
  }

  static Map<String, dynamic>? _findIncentive(String incentiveId) {
    for (final incentive in _incentives) {
      if (incentive['id'] == incentiveId) {
        return incentive;
      }
    }
    return null;
  }

  static Map<String, dynamic> _serializeRecord(Map<String, dynamic> record) {
    return {
      'id': record['id'],
      'staffId': record['staffId'],
      'staffName': record['staffName'],
      'section': record['section'],
      'role': record['role'],
      'ordersCompleted': record['ordersCompleted'],
      'preparationSpeed': record['preparationSpeed'],
      'delayRatio': record['delayRatio'],
      'complaintRatio': record['complaintRatio'],
      'qualityScore': record['qualityScore'],
      'productivityScore': record['productivityScore'],
      'rankLabel': record['rankLabel'],
      'trend': record['trend'],
      'availableActions': _actionsForRecord(record),
    };
  }

  static List<String> _actionsForRecord(Map<String, dynamic> record) {
    final actions = <String>['refresh_metrics', 'acknowledge_review'];
    if ((record['preparationSpeed'] as String).contains('min') &&
        (record['delayRatio'] as int) <= 5) {
      actions.add('apply_speed_incentive');
    }
    if ((record['qualityScore'] as int) >= 90 &&
        (record['complaintRatio'] as int) <= 2) {
      actions.add('apply_quality_reward');
    }
    if ((record['productivityScore'] as int) >= 85) {
      actions.add('apply_performance_bonus');
    }
    if ((record['delayRatio'] as int) >= 10 ||
        (record['complaintRatio'] as int) >= 5) {
      actions.add('flag_coaching');
    }
    return actions;
  }

  static Map<String, dynamic> _serializeIncentive(
    Map<String, dynamic> incentive,
  ) {
    return {
      'id': incentive['id'],
      'staffId': incentive['staffId'],
      'staffName': incentive['staffName'],
      'section': incentive['section'],
      'incentiveType': incentive['incentiveType'],
      'amountLabel': incentive['amountLabel'],
      'reason': incentive['reason'],
      'status': incentive['status'],
      'availableActions': _actionsForIncentive(incentive),
    };
  }

  static List<String> _actionsForIncentive(Map<String, dynamic> incentive) {
    return switch (incentive['status']) {
      'pending' => ['approve_incentive', 'reject_incentive'],
      'approved' => ['pay_incentive', 'reject_incentive'],
      _ => <String>[],
    };
  }

  static List<Map<String, dynamic>> _seedRecords() {
    final staff = MockStaffDirectory.all;
    final records = [
      {
        'id': 'PERF-001',
        'staffId': staff[0]['id'],
        'staffName': staff[0]['name'],
        'section': staff[0]['section'],
        'role': 'Head Chef',
        'ordersCompleted': 42,
        'preparationSpeed': '7.8 min avg',
        'delayRatio': 4,
        'complaintRatio': 1,
        'qualityScore': 94,
        'productivityScore': 91,
        'rankLabel': '#1',
        'trend': 'up',
      },
      {
        'id': 'PERF-002',
        'staffId': staff[1]['id'],
        'staffName': staff[1]['name'],
        'section': staff[1]['section'],
        'role': 'Sous Chef',
        'ordersCompleted': 38,
        'preparationSpeed': '8.4 min avg',
        'delayRatio': 6,
        'complaintRatio': 2,
        'qualityScore': 89,
        'productivityScore': 86,
        'rankLabel': '#2',
        'trend': 'stable',
      },
      {
        'id': 'PERF-003',
        'staffId': staff[2]['id'],
        'staffName': staff[2]['name'],
        'section': staff[2]['section'],
        'role': 'Tandoor Chef',
        'ordersCompleted': 56,
        'preparationSpeed': '6.2 min avg',
        'delayRatio': 3,
        'complaintRatio': 0,
        'qualityScore': 96,
        'productivityScore': 93,
        'rankLabel': '#3',
        'trend': 'up',
      },
      {
        'id': 'PERF-004',
        'staffId': staff[3]['id'],
        'staffName': staff[3]['name'],
        'section': staff[3]['section'],
        'role': 'Wok Chef',
        'ordersCompleted': 31,
        'preparationSpeed': '9.1 min avg',
        'delayRatio': 11,
        'complaintRatio': 4,
        'qualityScore': 82,
        'productivityScore': 74,
        'rankLabel': '#4',
        'trend': 'down',
      },
      {
        'id': 'PERF-005',
        'staffId': staff[4]['id'],
        'staffName': staff[4]['name'],
        'section': staff[4]['section'],
        'role': 'Kitchen Manager',
        'ordersCompleted': 12,
        'preparationSpeed': 'N/A',
        'delayRatio': 2,
        'complaintRatio': 0,
        'qualityScore': 90,
        'productivityScore': 88,
        'rankLabel': '#5',
        'trend': 'stable',
      },
    ];
    return records;
  }

  static List<Map<String, dynamic>> _seedIncentives() {
    return [
      {
        'id': 'INC-001',
        'staffId': 'STF-003',
        'staffName': 'Ravi Tandoor',
        'section': 'Tandoor',
        'incentiveType': 'speed_incentive',
        'amountLabel': '₹500',
        'reason': 'Fastest tandoor prep · 6.2 min avg',
        'status': 'pending',
      },
      {
        'id': 'INC-002',
        'staffId': 'STF-001',
        'staffName': 'Chef Arjun Mehta',
        'section': 'Main',
        'incentiveType': 'quality_reward',
        'amountLabel': '₹750',
        'reason': 'Quality score 94 · zero rework tickets',
        'status': 'approved',
      },
      {
        'id': 'INC-003',
        'staffId': 'STF-003',
        'staffName': 'Ravi Tandoor',
        'section': 'Tandoor',
        'incentiveType': 'performance_bonus',
        'amountLabel': '₹1,200',
        'reason': 'Top section productivity · 93 score',
        'status': 'paid',
      },
    ];
  }

  static int get bonusesThisMonth => _bonusesThisMonth;
}

class MockStaffPerformanceEngine {
  const MockStaffPerformanceEngine._();

  static Map<String, dynamic> buildSnapshot({String section = 'All'}) {
    final staffRecords = MockStaffPerformanceRegistry.recordsFor(section);
    final incentives = MockStaffPerformanceRegistry.incentivesFor(section);

    final avgQuality = staffRecords.isEmpty
        ? 0
        : (staffRecords
                    .map((item) => item['qualityScore'] as int)
                    .reduce((a, b) => a + b) /
                staffRecords.length)
            .round();

    final avgProductivity = staffRecords.isEmpty
        ? 0
        : (staffRecords
                    .map((item) => item['productivityScore'] as int)
                    .reduce((a, b) => a + b) /
                staffRecords.length)
            .round();

    final avgDelay = staffRecords.isEmpty
        ? 0
        : (staffRecords
                    .map((item) => item['delayRatio'] as int)
                    .reduce((a, b) => a + b) /
                staffRecords.length)
            .round();

    return {
      'section': section,
      'lastSyncedAt': DateTime.now().toIso8601String(),
      'staffRecords': staffRecords,
      'incentives': incentives,
      'stats': {
        'staffTracked': staffRecords.length,
        'avgQualityScore': avgQuality,
        'avgProductivity': avgProductivity,
        'avgDelayRatio': avgDelay,
        'incentivesPending': incentives
            .where((item) => item['status'] == 'pending')
            .length,
        'bonusesThisMonth': MockStaffPerformanceRegistry.bonusesThisMonth,
      },
      'performanceFeatures': {
        'ordersCompleted': staffRecords.isNotEmpty,
        'preparationSpeed': staffRecords.any(
          (item) => item['preparationSpeed'] != 'N/A',
        ),
        'delayRatio': staffRecords.isNotEmpty,
        'complaintRatio': staffRecords.isNotEmpty,
        'qualityScore': staffRecords.isNotEmpty,
        'productivityScore': staffRecords.isNotEmpty,
        'speedIncentives': incentives.any(
          (item) => item['incentiveType'] == 'speed_incentive',
        ),
        'qualityRewards': incentives.any(
          (item) => item['incentiveType'] == 'quality_reward',
        ),
        'performanceBonuses': incentives.any(
          (item) => item['incentiveType'] == 'performance_bonus',
        ),
      },
      'sections': MockSectionRegistry.filterSections,
    };
  }
}
