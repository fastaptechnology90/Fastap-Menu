import 'package:flutter_test/flutter_test.dart';

import 'package:kitchenapp/models/staff_wellness/staff_wellness_snapshot.dart';

void main() {
  test('staff wellness snapshot parses API payload', () {
    final snapshot = StaffWellnessSnapshot.fromJson({
      'section': 'All',
      'lastSyncedAt': '2026-06-06T12:00:00.000',
      'sections': ['All', 'Tandoor'],
      'burnoutPredictions': [
        {
          'id': 'WLN-BRN-001',
          'staffId': 'STF-003',
          'staffName': 'Ravi Tandoor',
          'section': 'Tandoor',
          'riskLevel': 'high',
          'riskScore': 78,
          'predictionSummary': 'Extended tandoor shift',
          'availableActions': ['schedule_break'],
        },
      ],
      'slowPerformanceAlerts': [
        {
          'id': 'WLN-SLW-001',
          'staffId': 'STF-003',
          'staffName': 'Ravi Tandoor',
          'section': 'Tandoor',
          'slowdownPercent': 18,
          'detectedAt': '12 min ago',
          'status': 'active',
          'availableActions': ['acknowledge_alert'],
        },
      ],
      'overworkAlerts': [
        {
          'id': 'WLN-OVR-001',
          'staffId': 'STF-003',
          'staffName': 'Ravi Tandoor',
          'section': 'Tandoor',
          'hoursOnShift': 10.5,
          'thresholdHours': 8,
          'status': 'active',
          'availableActions': ['escalate_supervisor'],
        },
      ],
      'breakRecommendations': [
        {
          'id': 'BRK-001',
          'staffId': 'STF-002',
          'staffName': 'Sous Chef Priya Nair',
          'section': 'Main',
          'recommendedBreakIn': '8 min',
          'reason': 'No break logged',
          'status': 'pending',
          'availableActions': ['apply_break'],
        },
      ],
      'stats': {
        'highBurnoutRisk': 1,
        'activeSlowAlerts': 1,
        'overworkAlerts': 1,
        'pendingBreaks': 1,
        'aiScansToday': 6,
        'avgRiskScore': 78,
      },
      'wellnessFeatures': {
        'burnoutPrediction': true,
        'slowPerformanceDetection': true,
        'overworkAlerts': true,
        'breakRecommendations': true,
      },
    });

    expect(snapshot.burnoutPredictions.length, 1);
    expect(snapshot.burnoutPredictions.first.riskScore, 78);
    expect(snapshot.wellnessFeatures.breakRecommendations, isTrue);
    expect(snapshot.stats.aiScansToday, 6);
  });
}
