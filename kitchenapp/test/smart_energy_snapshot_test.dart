import 'package:flutter_test/flutter_test.dart';

import 'package:kitchenapp/models/energy/smart_energy_snapshot.dart';

void main() {
  test('smart energy snapshot parses API payload', () {
    final snapshot = SmartEnergySnapshot.fromJson({
      'section': 'All',
      'lastSyncedAt': '2026-06-06T12:00:00.000',
      'sections': ['All', 'Main'],
      'gasLeakAlerts': [
        {
          'id': 'GAS-002',
          'location': 'Main kitchen gas manifold',
          'section': 'Main',
          'sensorLevel': '68 ppm',
          'threshold': '50 ppm',
          'severity': 'warning',
          'status': 'active',
          'availableActions': ['resolve_gas_leak', 'trigger_shutdown'],
        },
      ],
      'energyUsage': [
        {
          'id': 'ENR-001',
          'meterName': 'Main kitchen meter',
          'section': 'Main',
          'currentKwh': 4.2,
          'dailyKwh': 48.2,
          'peakWindow': '19:00-22:00',
          'trend': 'rising',
        },
      ],
      'shutdownAlerts': [
        {
          'id': 'SDN-001',
          'equipmentName': 'Deep fryer #2',
          'section': 'Main',
          'reason': 'Overheat protection',
          'scheduledTime': '22:45',
          'status': 'pending',
          'availableActions': ['trigger_shutdown'],
        },
      ],
      'temperatureAlerts': [
        {
          'id': 'TMP-001',
          'equipmentName': 'Tandoor oven chamber',
          'section': 'Tandoor',
          'currentTemp': '485°C',
          'threshold': '450°C',
          'status': 'active',
          'availableActions': ['reset_temperature'],
        },
      ],
      'stats': {
        'totalDailyKwh': 48.2,
        'activeGasAlerts': 1,
        'pendingShutdowns': 1,
        'temperatureAlerts': 1,
        'sectionsMonitored': 1,
        'resolvedToday': 7,
      },
      'energyFeatures': {
        'gasLeakAlerts': true,
        'energyUsageTracking': true,
        'smartShutdownAlerts': true,
        'highTemperatureAlerts': true,
      },
    });

    expect(snapshot.gasLeakAlerts.length, 1);
    expect(snapshot.energyUsage.first.dailyKwh, 48.2);
    expect(snapshot.energyFeatures.smartShutdownAlerts, isTrue);
    expect(snapshot.stats.temperatureAlerts, 1);
  });
}
