import 'package:flutter_test/flutter_test.dart';

import 'package:kitchenapp/models/live_alerts/live_alert_snapshot.dart';

void main() {
  test('live alert snapshot parses API payload', () {
    final snapshot = LiveAlertSnapshot.fromJson({
      'section': 'All',
      'lastSyncedAt': '2026-06-06T12:00:00.000',
      'sections': ['All', 'Main'],
      'alerts': [
        {
          'id': 'ALT-DLY-001',
          'alertType': 'delay',
          'title': 'KOT delay · Table 12',
          'section': 'Main',
          'severity': 'high',
          'message': 'Order delayed 18 min',
          'triggeredAt': '2 min ago',
          'status': 'active',
          'availableActions': ['acknowledge_alert', 'resolve_alert'],
        },
      ],
      'stats': {
        'activeAlerts': 1,
        'criticalAlerts': 0,
        'delayAlerts': 1,
        'vipAlerts': 0,
        'emergencyAlerts': 0,
        'resolvedToday': 8,
      },
      'alertFeatures': {
        'delayAlerts': true,
        'vipAlerts': false,
        'emergencyAlerts': false,
        'lowStockAlerts': false,
        'equipmentAlerts': false,
        'hygieneAlerts': false,
      },
    });

    expect(snapshot.alerts.length, 1);
    expect(snapshot.alerts.first.alertType, 'delay');
    expect(snapshot.alertFeatures.delayAlerts, isTrue);
    expect(snapshot.stats.resolvedToday, 8);
  });
}
