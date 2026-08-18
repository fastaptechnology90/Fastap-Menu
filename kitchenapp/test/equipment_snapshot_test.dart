import 'package:flutter_test/flutter_test.dart';

import 'package:kitchenapp/models/equipment/equipment_snapshot.dart';

void main() {
  test('equipment snapshot parses API payload', () {
    final snapshot = EquipmentSnapshot.fromJson({
      'section': 'All',
      'lastSyncedAt': '2026-06-06T12:00:00.000',
      'sections': ['All', 'Main'],
      'equipmentAssets': [
        {
          'id': 'EQ-003',
          'assetName': 'Deep fryer #2',
          'equipmentType': 'Fryer',
          'section': 'Main',
          'healthPercent': 38,
          'status': 'breakdown',
          'lastService': '45 days ago',
          'availableActions': ['resolve_ticket', 'raise_maintenance'],
        },
      ],
      'amcReminders': [
        {
          'id': 'AMC-001',
          'assetName': 'Tandoor oven chamber',
          'section': 'Tandoor',
          'provider': 'KitchenCare AMC',
          'dueInDays': 14,
          'status': 'upcoming',
        },
      ],
      'maintenanceTickets': [
        {
          'id': 'MT-001',
          'assetId': 'EQ-004',
          'assetName': 'Espresso machine',
          'section': 'Beverage',
          'issueSummary': 'Steam pressure fluctuation',
          'priority': 'high',
          'status': 'open',
          'availableActions': ['resolve_ticket'],
        },
      ],
      'breakdownAlerts': [
        {
          'id': 'BRK-001',
          'assetId': 'EQ-003',
          'assetName': 'Deep fryer #2',
          'section': 'Main',
          'alertType': 'Heating element failure',
          'severity': 'critical',
          'status': 'active',
          'availableActions': ['acknowledge_breakdown'],
        },
      ],
      'usageAnalytics': [
        {
          'id': 'USG-002',
          'assetName': 'Tandoor oven chamber',
          'section': 'Tandoor',
          'usageHours': 11.2,
          'peakWindow': '18:00-21:00',
          'utilizationPercent': 92,
        },
      ],
      'stats': {
        'totalAssets': 1,
        'operationalAssets': 0,
        'openTickets': 1,
        'activeBreakdowns': 1,
        'amcDueSoon': 1,
        'highUtilization': 1,
        'resolvedToday': 5,
      },
      'equipmentFeatures': {
        'equipmentHealthTracking': true,
        'amcReminders': true,
        'maintenanceTickets': true,
        'breakdownAlerts': true,
        'usageAnalytics': true,
      },
    });

    expect(snapshot.equipmentAssets.length, 1);
    expect(snapshot.equipmentAssets.first.healthPercent, 38);
    expect(snapshot.equipmentFeatures.breakdownAlerts, isTrue);
    expect(snapshot.stats.activeBreakdowns, 1);
  });
}
