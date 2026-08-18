import 'package:flutter_test/flutter_test.dart';

import 'package:kitchenapp/models/iot/iot_device_snapshot.dart';

void main() {
  test('iot device snapshot parses API payload', () {
    final snapshot = IotDeviceSnapshot.fromJson({
      'section': 'All',
      'lastSyncedAt': '2026-06-06T12:00:00.000',
      'sections': ['All', 'Tandoor'],
      'smartDevices': [
        {
          'id': 'IOT-001',
          'deviceName': 'Smart tandoor oven',
          'deviceType': 'Smart oven',
          'section': 'Tandoor',
          'connectionStatus': 'connected',
          'firmwareVersion': 'v2.4.1',
          'lastSyncedAt': '2m ago',
          'availableActions': ['sync_temperature', 'log_usage'],
        },
      ],
      'temperatureReadings': [
        {
          'id': 'TMP-IOT-001',
          'deviceName': 'Smart tandoor oven',
          'section': 'Tandoor',
          'currentTemp': '420°C',
          'targetTemp': '400°C',
          'status': 'stable',
        },
      ],
      'maintenanceAlerts': [
        {
          'id': 'MNT-IOT-001',
          'deviceId': 'IOT-002',
          'deviceName': 'Smart fryer #2',
          'section': 'Main',
          'alertType': 'Filter replacement due',
          'dueInDays': 3,
          'status': 'pending',
          'availableActions': ['schedule_maintenance'],
        },
      ],
      'usageAnalytics': [
        {
          'id': 'USG-IOT-001',
          'deviceName': 'Smart tandoor oven',
          'section': 'Tandoor',
          'cyclesToday': 48,
          'uptimeHours': 10.5,
          'efficiencyPercent': 91,
        },
      ],
      'stats': {
        'connectedDevices': 1,
        'offlineDevices': 0,
        'tempAlerts': 0,
        'maintenanceDue': 1,
        'avgEfficiency': 91,
        'syncedToday': 12,
      },
      'iotFeatures': {
        'smartOvens': true,
        'smartFryers': false,
        'smartRefrigerators': false,
        'smartCoffeeMachines': false,
        'temperatureMonitoring': true,
        'autoMaintenanceAlerts': true,
        'smartUsageAnalytics': true,
      },
    });

    expect(snapshot.smartDevices.length, 1);
    expect(snapshot.smartDevices.first.deviceType, 'Smart oven');
    expect(snapshot.iotFeatures.temperatureMonitoring, isTrue);
    expect(snapshot.stats.avgEfficiency, 91);
  });
}
