import 'package:flutter_test/flutter_test.dart';

import 'package:kitchenapp/models/delays/delay_escalation_snapshot.dart';

void main() {
  test('delay escalation snapshot parses API payload', () {
    final snapshot = DelayEscalationSnapshot.fromJson({
      'section': 'All',
      'lastSyncedAt': '2026-06-06T12:00:00.000',
      'sections': ['All', 'Chinese'],
      'delayedOrders': [
        {
          'orderId': 'ORD-1844',
          'kotNumber': 'KOT #1844',
          'section': 'Chinese',
          'location': 'Zomato',
          'status': 'delayed',
          'delayMinutes': 16,
          'timerLabel': '16:05',
          'delayReason': null,
          'escalated': true,
          'escalationLevel': 'kitchen_manager',
          'availableActions': ['log_reason', 'escalate_operations', 'resolve'],
        },
      ],
      'history': [
        {
          'id': 'HIS-001',
          'orderId': 'ORD-1844',
          'kotNumber': 'KOT #1844',
          'section': 'Chinese',
          'reason': 'Rider waiting · wok station backlog',
          'loggedAt': '2026-06-06T11:42:00.000',
        },
      ],
      'escalations': [
        {
          'id': 'ESC-ORD-1844',
          'orderId': 'ORD-1844',
          'kotNumber': 'KOT #1844',
          'section': 'Chinese',
          'level': 'kitchen_manager',
          'levelLabel': 'Kitchen manager alert',
          'reason': 'Express delivery delay',
          'updatedAt': '2026-06-06T11:52:00.000',
        },
      ],
      'bottlenecks': [
        {
          'section': 'Chinese',
          'delayedOrders': 1,
          'severity': 'high',
          'bottleneck': 'Recovery needed',
        },
      ],
      'stats': {
        'delayedOrders': 1,
        'openEscalations': 1,
        'historyEvents': 1,
        'bottlenecks': 1,
        'chefAlerts': 0,
        'managerAlerts': 1,
        'operationsAlerts': 0,
      },
      'delayFeatures': {
        'delayTimer': true,
        'delayReasonLogging': true,
        'autoEscalation': true,
        'delayHistory': true,
        'bottleneckDetection': true,
        'chefAlert': false,
        'kitchenManagerAlert': true,
        'operationsAlert': false,
      },
    });

    expect(snapshot.delayedOrders.length, 1);
    expect(snapshot.escalations.first.levelLabel, 'Kitchen manager alert');
    expect(snapshot.delayFeatures.bottleneckDetection, isTrue);
    expect(snapshot.stats.managerAlerts, 1);
  });
}
