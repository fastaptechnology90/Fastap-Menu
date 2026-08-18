import 'package:flutter_test/flutter_test.dart';

import 'package:kitchenapp/models/safety/allergy_safety_snapshot.dart';

void main() {
  test('allergy safety snapshot parses API payload', () {
    final snapshot = AllergySafetySnapshot.fromJson({
      'section': 'All',
      'lastSyncedAt': '2026-06-06T12:00:00.000',
      'sections': ['All', 'Main'],
      'allergyTypes': ['Nut allergy', 'Seafood allergy'],
      'stats': {
        'totalCases': 2,
        'activeCases': 2,
        'pendingChefConfirm': 1,
        'pendingSopAck': 2,
        'crossContaminationAlerts': 2,
        'criticalCases': 1,
      },
      'safetyFeatures': {
        'allergyColorCoding': true,
        'mandatoryChefConfirmation': true,
        'crossContaminationWarnings': true,
        'dedicatedPrepWarnings': true,
        'safetySopReminders': true,
      },
      'cases': [
        {
          'id': 'SAFE-ORD-1843',
          'orderId': 'ORD-1843',
          'kotNumber': 'KOT #1843',
          'location': 'Room 804',
          'section': 'Main',
          'assignedChef': 'Chef Arjun Mehta',
          'status': 'active',
          'statusLabel': 'Active alert',
          'allergyTypes': ['Nut allergy'],
          'severity': 'critical',
          'colorCode': 'danger',
          'crossContaminationRisk': true,
          'dedicatedPrepRequired': true,
          'chefConfirmed': false,
          'sopAcknowledged': false,
          'escalated': false,
          'vip': true,
          'items': ['1x Dal makhani'],
          'warnings': ['Cross contamination warning · Main shared equipment'],
          'availableActions': ['confirm_chef', 'acknowledge_sop', 'escalate'],
        },
      ],
    });

    expect(snapshot.cases.length, 1);
    expect(snapshot.stats.criticalCases, 1);
    expect(snapshot.safetyFeatures.allergyColorCoding, isTrue);
    expect(snapshot.cases.first.colorCode, 'danger');
  });
}
