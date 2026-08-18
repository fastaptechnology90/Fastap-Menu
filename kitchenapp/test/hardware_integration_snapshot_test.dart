import 'package:flutter_test/flutter_test.dart';

import 'package:kitchenapp/models/hardware_integration/hardware_integration_snapshot.dart';

void main() {
  test('hardware integration snapshot parses API payload', () {
    final snapshot = HardwareIntegrationSnapshot.fromJson({
      'section': 'All',
      'lastSyncedAt': '2026-06-06T12:00:00.000',
      'sections': ['All', 'Main'],
      'displayScreens': [
        {
          'id': 'HW-DSP-001',
          'deviceName': 'Main line KDS display',
          'section': 'Main',
          'connectionStatus': 'connected',
          'resolution': '3840×2160',
          'ordersShown': 14,
          'status': 'active',
          'availableActions': ['sync_content'],
        },
      ],
      'tablets': [
        {
          'id': 'HW-TBL-001',
          'deviceName': 'Expeditor tablet',
          'section': 'Main',
          'connectionStatus': 'connected',
          'assignedRole': 'Expeditor',
          'batteryPercent': 78,
          'status': 'active',
          'availableActions': ['pair_tablet'],
        },
      ],
      'thermalPrinters': [
        {
          'id': 'HW-PRT-001',
          'deviceName': 'Pass thermal printer',
          'section': 'Main',
          'connectionStatus': 'connected',
          'paperLevel': 'low',
          'queueCount': 5,
          'status': 'printing',
          'availableActions': ['test_print'],
        },
      ],
      'smartwatches': [
        {
          'id': 'HW-WCH-001',
          'deviceName': 'Chef de cuisine watch',
          'section': 'Main',
          'connectionStatus': 'connected',
          'wearerName': 'Chef Rahul',
          'lastPing': '2 min ago',
          'status': 'active',
          'availableActions': ['pair_watch'],
        },
      ],
      'nfcDevices': [
        {
          'id': 'HW-NFC-001',
          'deviceName': 'Main entrance badge reader',
          'section': 'Main',
          'connectionStatus': 'connected',
          'tapCountToday': 42,
          'lastTap': '5 min ago',
          'status': 'active',
          'availableActions': ['sync_credentials'],
        },
      ],
      'barcodeScanners': [
        {
          'id': 'HW-SCN-001',
          'deviceName': 'Prep inventory scanner',
          'section': 'Main',
          'connectionStatus': 'connected',
          'scansToday': 126,
          'calibrationStatus': 'ok',
          'status': 'active',
          'availableActions': ['calibrate_scanner'],
        },
      ],
      'stats': {
        'connectedDevices': 6,
        'offlineDevices': 0,
        'lowBatteryTablets': 0,
        'printersNeedingPaper': 1,
        'uncalibratedScanners': 0,
        'syncedToday': 18,
      },
      'supportedDevices': {
        'kitchenDisplayScreens': true,
        'tablets': true,
        'thermalPrinters': true,
        'smartwatches': true,
        'nfcDevices': true,
        'barcodeScanners': true,
      },
    });

    expect(snapshot.displayScreens.first.deviceName, 'Main line KDS display');
    expect(snapshot.thermalPrinters.first.paperLevel, 'low');
    expect(snapshot.supportedDevices.barcodeScanners, isTrue);
    expect(snapshot.stats.syncedToday, 18);
  });
}
