import 'mock_section_registry.dart';

class MockHardwareIntegrationRegistry {
  MockHardwareIntegrationRegistry._();

  static final List<Map<String, dynamic>> _displays = _seedDisplays();
  static final List<Map<String, dynamic>> _tablets = _seedTablets();
  static final List<Map<String, dynamic>> _printers = _seedPrinters();
  static final List<Map<String, dynamic>> _smartwatches = _seedSmartwatches();
  static final List<Map<String, dynamic>> _nfc = _seedNfc();
  static final List<Map<String, dynamic>> _scanners = _seedScanners();
  static int _syncedToday = 18;

  static List<Map<String, dynamic>> displaysFor(String section) {
    return _filterSection(_displays, section).map(_serializeDisplay).toList();
  }

  static List<Map<String, dynamic>> tabletsFor(String section) {
    return _filterSection(_tablets, section).map(_serializeTablet).toList();
  }

  static List<Map<String, dynamic>> printersFor(String section) {
    return _filterSection(_printers, section).map(_serializePrinter).toList();
  }

  static List<Map<String, dynamic>> smartwatchesFor(String section) {
    return _filterSection(_smartwatches, section)
        .map(_serializeSmartwatch)
        .toList();
  }

  static List<Map<String, dynamic>> nfcFor(String section) {
    return _filterSection(_nfc, section).map(_serializeNfc).toList();
  }

  static List<Map<String, dynamic>> scannersFor(String section) {
    return _filterSection(_scanners, section).map(_serializeScanner).toList();
  }

  static Map<String, dynamic> performDisplayAction({
    required String displayId,
    required String action,
  }) {
    final display = _find(_displays, displayId);
    if (display == null) {
      throw ArgumentError('Display screen not found');
    }

    final name = display['deviceName'] as String;

    switch (action) {
      case 'restart_display':
        display['connectionStatus'] = 'connected';
        display['status'] = 'active';
        _syncedToday++;
        return {'success': true, 'message': 'Display restarted · $name'};
      case 'sync_content':
        display['ordersShown'] = (display['ordersShown'] as int) + 3;
        display['status'] = 'syncing';
        _syncedToday++;
        return {'success': true, 'message': 'KDS content synced · $name'};
      case 'test_signal':
        display['status'] = 'test_ok';
        return {'success': true, 'message': 'Signal test passed · $name'};
      default:
        throw ArgumentError('Unknown display action: $action');
    }
  }

  static Map<String, dynamic> performTabletAction({
    required String tabletId,
    required String action,
  }) {
    final tablet = _find(_tablets, tabletId);
    if (tablet == null) {
      throw ArgumentError('Tablet not found');
    }

    final name = tablet['deviceName'] as String;

    switch (action) {
      case 'pair_tablet':
        tablet['connectionStatus'] = 'connected';
        tablet['status'] = 'paired';
        _syncedToday++;
        return {'success': true, 'message': 'Tablet paired · $name'};
      case 'restart_tablet':
        tablet['connectionStatus'] = 'connected';
        tablet['batteryPercent'] = 100;
        tablet['status'] = 'active';
        _syncedToday++;
        return {'success': true, 'message': 'Tablet restarted · $name'};
      case 'lock_tablet':
        tablet['status'] = 'locked';
        return {'success': true, 'message': 'Tablet locked · $name'};
      default:
        throw ArgumentError('Unknown tablet action: $action');
    }
  }

  static Map<String, dynamic> performPrinterAction({
    required String printerId,
    required String action,
  }) {
    final printer = _find(_printers, printerId);
    if (printer == null) {
      throw ArgumentError('Thermal printer not found');
    }

    final name = printer['deviceName'] as String;

    switch (action) {
      case 'test_print':
        printer['connectionStatus'] = 'connected';
        printer['status'] = 'printing';
        _syncedToday++;
        return {'success': true, 'message': 'Test ticket printed · $name'};
      case 'clear_queue':
        printer['queueCount'] = 0;
        printer['status'] = 'idle';
        return {'success': true, 'message': 'Print queue cleared · $name'};
      case 'replace_paper':
        printer['paperLevel'] = 'ok';
        printer['status'] = 'ready';
        return {'success': true, 'message': 'Paper roll replaced · $name'};
      default:
        throw ArgumentError('Unknown printer action: $action');
    }
  }

  static Map<String, dynamic> performSmartwatchAction({
    required String watchId,
    required String action,
  }) {
    final watch = _find(_smartwatches, watchId);
    if (watch == null) {
      throw ArgumentError('Smartwatch not found');
    }

    final name = watch['deviceName'] as String;

    switch (action) {
      case 'pair_watch':
        watch['connectionStatus'] = 'connected';
        watch['lastPing'] = 'Just now';
        watch['status'] = 'paired';
        _syncedToday++;
        return {'success': true, 'message': 'Smartwatch paired · $name'};
      case 'push_alert_test':
        watch['lastPing'] = 'Just now';
        watch['status'] = 'alert_sent';
        return {'success': true, 'message': 'Test alert pushed · $name'};
      case 'disconnect_watch':
        watch['connectionStatus'] = 'offline';
        watch['status'] = 'disconnected';
        return {'success': true, 'message': 'Smartwatch disconnected · $name'};
      default:
        throw ArgumentError('Unknown smartwatch action: $action');
    }
  }

  static Map<String, dynamic> performNfcAction({
    required String nfcId,
    required String action,
  }) {
    final nfc = _find(_nfc, nfcId);
    if (nfc == null) {
      throw ArgumentError('NFC device not found');
    }

    final name = nfc['deviceName'] as String;

    switch (action) {
      case 'test_tap':
        nfc['tapCountToday'] = (nfc['tapCountToday'] as int) + 1;
        nfc['lastTap'] = 'Just now';
        nfc['status'] = 'test_ok';
        return {'success': true, 'message': 'NFC tap test passed · $name'};
      case 'sync_credentials':
        nfc['connectionStatus'] = 'connected';
        nfc['status'] = 'synced';
        _syncedToday++;
        return {'success': true, 'message': 'Credentials synced · $name'};
      case 'disable_nfc':
        nfc['status'] = 'disabled';
        return {'success': true, 'message': 'NFC reader disabled · $name'};
      default:
        throw ArgumentError('Unknown NFC action: $action');
    }
  }

  static Map<String, dynamic> performScannerAction({
    required String scannerId,
    required String action,
  }) {
    final scanner = _find(_scanners, scannerId);
    if (scanner == null) {
      throw ArgumentError('Barcode scanner not found');
    }

    final name = scanner['deviceName'] as String;

    switch (action) {
      case 'calibrate_scanner':
        scanner['calibrationStatus'] = 'ok';
        scanner['status'] = 'calibrated';
        return {'success': true, 'message': 'Scanner calibrated · $name'};
      case 'test_scan':
        scanner['scansToday'] = (scanner['scansToday'] as int) + 1;
        scanner['status'] = 'test_ok';
        return {'success': true, 'message': 'Test scan completed · $name'};
      case 'restart_scanner':
        scanner['connectionStatus'] = 'connected';
        scanner['status'] = 'active';
        _syncedToday++;
        return {'success': true, 'message': 'Scanner restarted · $name'};
      default:
        throw ArgumentError('Unknown scanner action: $action');
    }
  }

  static Map<String, dynamic> syncAll() {
    for (final list in [
      _displays,
      _tablets,
      _printers,
      _smartwatches,
      _nfc,
      _scanners,
    ]) {
      for (final device in list) {
        if (device['status'] != 'disabled' &&
            device['status'] != 'locked' &&
            device['status'] != 'disconnected') {
          device['connectionStatus'] = 'connected';
        }
      }
    }
    _syncedToday += 6;
    return {
      'success': true,
      'message': 'All hardware devices synced · 6 device types',
    };
  }

  static int get syncedToday => _syncedToday;

  static List<Map<String, dynamic>> _filterSection(
    List<Map<String, dynamic>> items,
    String section,
  ) {
    if (section == 'All') {
      return items;
    }
    return items.where((item) => item['section'] == section).toList();
  }

  static Map<String, dynamic>? _find(
    List<Map<String, dynamic>> items,
    String id,
  ) {
    for (final item in items) {
      if (item['id'] == id) {
        return item;
      }
    }
    return null;
  }

  static Map<String, dynamic> _serializeDisplay(Map<String, dynamic> item) {
    return {
      'id': item['id'],
      'deviceName': item['deviceName'],
      'section': item['section'],
      'connectionStatus': item['connectionStatus'],
      'resolution': item['resolution'],
      'ordersShown': item['ordersShown'],
      'status': item['status'],
      'availableActions': const [
        'restart_display',
        'sync_content',
        'test_signal',
      ],
    };
  }

  static Map<String, dynamic> _serializeTablet(Map<String, dynamic> item) {
    return {
      'id': item['id'],
      'deviceName': item['deviceName'],
      'section': item['section'],
      'connectionStatus': item['connectionStatus'],
      'assignedRole': item['assignedRole'],
      'batteryPercent': item['batteryPercent'],
      'status': item['status'],
      'availableActions': const ['pair_tablet', 'restart_tablet', 'lock_tablet'],
    };
  }

  static Map<String, dynamic> _serializePrinter(Map<String, dynamic> item) {
    return {
      'id': item['id'],
      'deviceName': item['deviceName'],
      'section': item['section'],
      'connectionStatus': item['connectionStatus'],
      'paperLevel': item['paperLevel'],
      'queueCount': item['queueCount'],
      'status': item['status'],
      'availableActions': const [
        'test_print',
        'clear_queue',
        'replace_paper',
      ],
    };
  }

  static Map<String, dynamic> _serializeSmartwatch(Map<String, dynamic> item) {
    return {
      'id': item['id'],
      'deviceName': item['deviceName'],
      'section': item['section'],
      'connectionStatus': item['connectionStatus'],
      'wearerName': item['wearerName'],
      'lastPing': item['lastPing'],
      'status': item['status'],
      'availableActions': const [
        'pair_watch',
        'push_alert_test',
        'disconnect_watch',
      ],
    };
  }

  static Map<String, dynamic> _serializeNfc(Map<String, dynamic> item) {
    return {
      'id': item['id'],
      'deviceName': item['deviceName'],
      'section': item['section'],
      'connectionStatus': item['connectionStatus'],
      'tapCountToday': item['tapCountToday'],
      'lastTap': item['lastTap'],
      'status': item['status'],
      'availableActions': const ['test_tap', 'sync_credentials', 'disable_nfc'],
    };
  }

  static Map<String, dynamic> _serializeScanner(Map<String, dynamic> item) {
    return {
      'id': item['id'],
      'deviceName': item['deviceName'],
      'section': item['section'],
      'connectionStatus': item['connectionStatus'],
      'scansToday': item['scansToday'],
      'calibrationStatus': item['calibrationStatus'],
      'status': item['status'],
      'availableActions': const [
        'calibrate_scanner',
        'test_scan',
        'restart_scanner',
      ],
    };
  }

  static List<Map<String, dynamic>> _seedDisplays() {
    return [
      {
        'id': 'HW-DSP-001',
        'deviceName': 'Main line KDS display',
        'section': 'Main',
        'connectionStatus': 'connected',
        'resolution': '3840×2160',
        'ordersShown': 14,
        'status': 'active',
      },
      {
        'id': 'HW-DSP-002',
        'deviceName': 'Banquet expo display',
        'section': 'Continental',
        'connectionStatus': 'offline',
        'resolution': '1920×1080',
        'ordersShown': 0,
        'status': 'offline',
      },
    ];
  }

  static List<Map<String, dynamic>> _seedTablets() {
    return [
      {
        'id': 'HW-TBL-001',
        'deviceName': 'Expeditor tablet',
        'section': 'Main',
        'connectionStatus': 'connected',
        'assignedRole': 'Expeditor',
        'batteryPercent': 78,
        'status': 'active',
      },
      {
        'id': 'HW-TBL-002',
        'deviceName': 'Prep station tablet',
        'section': 'Main',
        'connectionStatus': 'connected',
        'assignedRole': 'Prep lead',
        'batteryPercent': 22,
        'status': 'low_battery',
      },
    ];
  }

  static List<Map<String, dynamic>> _seedPrinters() {
    return [
      {
        'id': 'HW-PRT-001',
        'deviceName': 'Pass thermal printer',
        'section': 'Main',
        'connectionStatus': 'connected',
        'paperLevel': 'low',
        'queueCount': 5,
        'status': 'printing',
      },
      {
        'id': 'HW-PRT-002',
        'deviceName': 'Continental label printer',
        'section': 'Continental',
        'connectionStatus': 'offline',
        'paperLevel': 'ok',
        'queueCount': 0,
        'status': 'offline',
      },
    ];
  }

  static List<Map<String, dynamic>> _seedSmartwatches() {
    return [
      {
        'id': 'HW-WCH-001',
        'deviceName': 'Chef de cuisine watch',
        'section': 'Main',
        'connectionStatus': 'connected',
        'wearerName': 'Chef Rahul',
        'lastPing': '2 min ago',
        'status': 'active',
      },
      {
        'id': 'HW-WCH-002',
        'deviceName': 'Runner smartwatch',
        'section': 'Main',
        'connectionStatus': 'offline',
        'wearerName': 'Unassigned',
        'lastPing': '45 min ago',
        'status': 'disconnected',
      },
    ];
  }

  static List<Map<String, dynamic>> _seedNfc() {
    return [
      {
        'id': 'HW-NFC-001',
        'deviceName': 'Main entrance badge reader',
        'section': 'Main',
        'connectionStatus': 'connected',
        'tapCountToday': 42,
        'lastTap': '5 min ago',
        'status': 'active',
      },
      {
        'id': 'HW-NFC-002',
        'deviceName': 'Pass station tap pad',
        'section': 'Main',
        'connectionStatus': 'connected',
        'tapCountToday': 18,
        'lastTap': '12 min ago',
        'status': 'active',
      },
    ];
  }

  static List<Map<String, dynamic>> _seedScanners() {
    return [
      {
        'id': 'HW-SCN-001',
        'deviceName': 'Prep inventory scanner',
        'section': 'Main',
        'connectionStatus': 'connected',
        'scansToday': 126,
        'calibrationStatus': 'ok',
        'status': 'active',
      },
      {
        'id': 'HW-SCN-002',
        'deviceName': 'Receiving dock scanner',
        'section': 'Continental',
        'connectionStatus': 'connected',
        'scansToday': 34,
        'calibrationStatus': 'needs_calibration',
        'status': 'warning',
      },
    ];
  }
}

class MockHardwareIntegrationEngine {
  const MockHardwareIntegrationEngine._();

  static Map<String, dynamic> buildSnapshot({String section = 'All'}) {
    final displayScreens =
        MockHardwareIntegrationRegistry.displaysFor(section);
    final tablets = MockHardwareIntegrationRegistry.tabletsFor(section);
    final thermalPrinters =
        MockHardwareIntegrationRegistry.printersFor(section);
    final smartwatches =
        MockHardwareIntegrationRegistry.smartwatchesFor(section);
    final nfcDevices = MockHardwareIntegrationRegistry.nfcFor(section);
    final barcodeScanners =
        MockHardwareIntegrationRegistry.scannersFor(section);

    final allDevices = [
      ...displayScreens,
      ...tablets,
      ...thermalPrinters,
      ...smartwatches,
      ...nfcDevices,
      ...barcodeScanners,
    ];

    return {
      'section': section,
      'lastSyncedAt': DateTime.now().toIso8601String(),
      'displayScreens': displayScreens,
      'tablets': tablets,
      'thermalPrinters': thermalPrinters,
      'smartwatches': smartwatches,
      'nfcDevices': nfcDevices,
      'barcodeScanners': barcodeScanners,
      'stats': {
        'connectedDevices': allDevices
            .where((item) => item['connectionStatus'] == 'connected')
            .length,
        'offlineDevices': allDevices
            .where((item) => item['connectionStatus'] == 'offline')
            .length,
        'lowBatteryTablets': tablets
            .where((item) => (item['batteryPercent'] as int) < 30)
            .length,
        'printersNeedingPaper': thermalPrinters
            .where((item) => item['paperLevel'] == 'low')
            .length,
        'uncalibratedScanners': barcodeScanners
            .where((item) => item['calibrationStatus'] != 'ok')
            .length,
        'syncedToday': MockHardwareIntegrationRegistry.syncedToday,
      },
      'supportedDevices': {
        'kitchenDisplayScreens': displayScreens.isNotEmpty,
        'tablets': tablets.isNotEmpty,
        'thermalPrinters': thermalPrinters.isNotEmpty,
        'smartwatches': smartwatches.isNotEmpty,
        'nfcDevices': nfcDevices.isNotEmpty,
        'barcodeScanners': barcodeScanners.isNotEmpty,
      },
      'sections': MockSectionRegistry.filterSections,
    };
  }
}
