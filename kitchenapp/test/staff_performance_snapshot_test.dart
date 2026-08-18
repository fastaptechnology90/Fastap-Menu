import 'package:flutter_test/flutter_test.dart';

import 'package:kitchenapp/models/staff_performance/staff_performance_snapshot.dart';

void main() {
  test('staff performance snapshot parses API payload', () {
    final snapshot = StaffPerformanceSnapshot.fromJson({
      'section': 'All',
      'lastSyncedAt': '2026-06-06T12:00:00.000',
      'sections': ['All', 'Tandoor'],
      'staffRecords': [
        {
          'id': 'PERF-001',
          'staffId': 'STF-001',
          'staffName': 'Chef Arjun Mehta',
          'section': 'Main',
          'role': 'Head Chef',
          'ordersCompleted': 42,
          'preparationSpeed': '7.8 min avg',
          'delayRatio': 4,
          'complaintRatio': 1,
          'qualityScore': 94,
          'productivityScore': 91,
          'rankLabel': '#1',
          'trend': 'up',
          'availableActions': ['refresh_metrics', 'apply_quality_reward'],
        },
      ],
      'incentives': [
        {
          'id': 'INC-001',
          'staffId': 'STF-003',
          'staffName': 'Ravi Tandoor',
          'section': 'Tandoor',
          'incentiveType': 'speed_incentive',
          'amountLabel': '₹500',
          'reason': 'Fastest tandoor prep',
          'status': 'pending',
          'availableActions': ['approve_incentive'],
        },
      ],
      'stats': {
        'staffTracked': 1,
        'avgQualityScore': 94,
        'avgProductivity': 91,
        'avgDelayRatio': 4,
        'incentivesPending': 1,
        'bonusesThisMonth': 4,
      },
      'performanceFeatures': {
        'ordersCompleted': true,
        'preparationSpeed': true,
        'delayRatio': true,
        'complaintRatio': true,
        'qualityScore': true,
        'productivityScore': true,
        'speedIncentives': true,
        'qualityRewards': false,
        'performanceBonuses': false,
      },
    });

    expect(snapshot.staffRecords.length, 1);
    expect(snapshot.staffRecords.first.qualityScore, 94);
    expect(snapshot.performanceFeatures.speedIncentives, isTrue);
    expect(snapshot.stats.bonusesThisMonth, 4);
  });
}
