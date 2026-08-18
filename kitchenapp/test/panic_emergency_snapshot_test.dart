import 'package:flutter_test/flutter_test.dart';

import 'package:kitchenapp/models/panic_emergency/panic_emergency_snapshot.dart';

void main() {
  test('panic emergency snapshot parses API payload', () {
    final snapshot = PanicEmergencySnapshot.fromJson({
      'section': 'All',
      'lastSyncedAt': '2026-06-06T12:00:00.000',
      'sections': ['All', 'Main'],
      'incidents': [
        {
          'id': 'EMG-001',
          'emergencyType': 'gas',
          'title': 'Gas leakage · Main range',
          'section': 'Main',
          'severity': 'critical',
          'reportedAt': '4 min ago',
          'reportedBy': 'Smart gas sensor',
          'message': 'Gas PPM spike detected',
          'status': 'active',
          'availableActions': ['escalate_incident'],
        },
      ],
      'evacuationAlerts': [
        {
          'id': 'EVC-001',
          'zone': 'Tandoor section',
          'section': 'Tandoor',
          'message': 'Standby evacuation',
          'status': 'standby',
          'availableActions': [],
        },
      ],
      'broadcastLog': [
        {
          'id': 'BCST-001',
          'broadcastType': 'gas',
          'message': 'Gas alert · Main range',
          'sentAt': '4 min ago',
          'status': 'sent',
        },
      ],
      'stats': {
        'activeIncidents': 1,
        'criticalIncidents': 1,
        'evacuationsActive': 0,
        'broadcastsToday': 3,
        'panicTriggersToday': 1,
        'resolvedToday': 2,
      },
      'emergencyFeatures': {
        'fireEmergency': false,
        'gasLeakage': true,
        'equipmentBlast': false,
        'staffInjury': false,
        'foodContamination': false,
        'panicButton': true,
        'emergencyBroadcasts': true,
        'evacuationAlerts': true,
        'incidentEscalation': false,
      },
    });

    expect(snapshot.incidents.length, 1);
    expect(snapshot.incidents.first.emergencyType, 'gas');
    expect(snapshot.emergencyFeatures.panicButton, isTrue);
    expect(snapshot.stats.panicTriggersToday, 1);
  });
}
