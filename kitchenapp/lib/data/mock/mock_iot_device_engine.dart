import 'mock_section_registry.dart';

class MockIotDeviceRegistry {
  MockIotDeviceRegistry._();

  static final List<Map<String, dynamic>> _devices = _seedDevices();
  static final List<Map<String, dynamic>> _temperatures = _seedTemperatures();
  static final List<Map<String, dynamic>> _maintenance = _seedMaintenance();
  static final List<Map<String, dynamic>> _usage = _seedUsage();
  static int _syncedToday = 12;

  static List<Map<String, dynamic>> devicesFor(String section) {
    if (section == 'All') {
      return _devices.map(_serializeDevice).toList();
    }
    return _devices
        .where((item) => item['section'] == section)
        .map(_serializeDevice)
        .toList();
  }

  static List<Map<String, dynamic>> temperaturesFor(String section) {
    if (section == 'All') {
      return _temperatures.map(Map<String, dynamic>.from).toList();
    }
    return _temperatures
        .where((item) => item['section'] == section)
        .map(Map<String, dynamic>.from)
        .toList();
  }

  static List<Map<String, dynamic>> maintenanceFor(String section) {
    if (section == 'All') {
      return _maintenance.map(_serializeMaintenance).toList();
    }
    return _maintenance
        .where((item) => item['section'] == section)
        .map(_serializeMaintenance)
        .toList();
  }

  static List<Map<String, dynamic>> usageFor(String section) {
    if (section == 'All') {
      return _usage.map(Map<String, dynamic>.from).toList();
    }
    return _usage
        .where((item) => item['section'] == section)
        .map(Map<String, dynamic>.from)
        .toList();
  }

  static Map<String, dynamic> performAction({
    required String deviceId,
    required String action,
  }) {
    final device = _findDevice(deviceId);
    if (device == null) {
      throw ArgumentError('IoT device not found');
    }

    final deviceName = device['deviceName'] as String;
    final maintenance = _maintenance.cast<Map<String, dynamic>?>().firstWhere(
          (item) => item?['deviceId'] == deviceId,
          orElse: () => null,
        );
    final temp = _temperatures.cast<Map<String, dynamic>?>().firstWhere(
          (item) => item?['deviceName'] == deviceName,
          orElse: () => null,
        );

    switch (action) {
      case 'connect_device':
        device['connectionStatus'] = 'connected';
        device['lastSyncedAt'] = 'Just now';
        _syncedToday++;
        return {
          'success': true,
          'message': 'Device connected · $deviceName',
        };
      case 'sync_temperature':
        if (temp != null) {
          temp['status'] = 'stable';
        }
        device['lastSyncedAt'] = 'Just now';
        _syncedToday++;
        return {
          'success': true,
          'message': 'Temperature synced · $deviceName',
        };
      case 'acknowledge_maintenance':
        maintenance?['status'] = 'acknowledged';
        return {
          'success': true,
          'message': 'Maintenance acknowledged · $deviceName',
        };
      case 'schedule_maintenance':
        maintenance?['status'] = 'scheduled';
        maintenance?['dueInDays'] = 7;
        return {
          'success': true,
          'message': 'Maintenance scheduled · $deviceName',
        };
      case 'log_usage':
        final usage = _usage.cast<Map<String, dynamic>?>().firstWhere(
              (item) => item?['deviceName'] == deviceName,
              orElse: () => null,
            );
        if (usage != null) {
          usage['cyclesToday'] = (usage['cyclesToday'] as int) + 1;
        }
        return {
          'success': true,
          'message': 'Usage logged · $deviceName',
        };
      case 'restart_device':
        device['connectionStatus'] = 'connected';
        device['lastSyncedAt'] = 'Just now';
        _syncedToday++;
        return {
          'success': true,
          'message': 'Device restarted · $deviceName',
        };
      case 'hold_device':
        device['connectionStatus'] = 'on_hold';
        return {
          'success': true,
          'message': 'Device held · $deviceName',
        };
      default:
        throw ArgumentError('Unknown IoT action: $action');
    }
  }

  static Map<String, dynamic> syncAll() {
    for (final device in _devices) {
      if (device['connectionStatus'] != 'on_hold') {
        device['connectionStatus'] = 'connected';
        device['lastSyncedAt'] = 'Just now';
      }
    }
    _syncedToday += _devices.length;
    return {
      'success': true,
      'message': 'All IoT devices synced · ${_devices.length} devices',
    };
  }

  static Map<String, dynamic>? _findDevice(String deviceId) {
    for (final device in _devices) {
      if (device['id'] == deviceId) {
        return device;
      }
    }
    return null;
  }

  static Map<String, dynamic> _serializeDevice(Map<String, dynamic> device) {
    return {
      'id': device['id'],
      'deviceName': device['deviceName'],
      'deviceType': device['deviceType'],
      'section': device['section'],
      'connectionStatus': device['connectionStatus'],
      'firmwareVersion': device['firmwareVersion'],
      'lastSyncedAt': device['lastSyncedAt'],
      'availableActions': _deviceActions(device),
    };
  }

  static Map<String, dynamic> _serializeMaintenance(
    Map<String, dynamic> item,
  ) {
    return {
      'id': item['id'],
      'deviceId': item['deviceId'],
      'deviceName': item['deviceName'],
      'section': item['section'],
      'alertType': item['alertType'],
      'dueInDays': item['dueInDays'],
      'status': item['status'],
      'availableActions': _maintenanceActions(item),
    };
  }

  static List<String> _deviceActions(Map<String, dynamic> device) {
    final actions = <String>[
      'connect_device',
      'sync_temperature',
      'log_usage',
      'restart_device',
    ];
    if (device['connectionStatus'] == 'offline') {
      actions.insert(0, 'restart_device');
    }
    actions.add('hold_device');
    return actions;
  }

  static List<String> _maintenanceActions(Map<String, dynamic> item) {
    if (item['status'] == 'resolved') {
      return const [];
    }
    return [
      'acknowledge_maintenance',
      'schedule_maintenance',
      'hold_device',
    ];
  }

  static List<Map<String, dynamic>> _seedDevices() {
    return [
      {
        'id': 'IOT-001',
        'deviceName': 'Smart tandoor oven',
        'deviceType': 'Smart oven',
        'section': 'Tandoor',
        'connectionStatus': 'connected',
        'firmwareVersion': 'v2.4.1',
        'lastSyncedAt': '2m ago',
      },
      {
        'id': 'IOT-002',
        'deviceName': 'Smart fryer #2',
        'deviceType': 'Smart fryer',
        'section': 'Main',
        'connectionStatus': 'offline',
        'firmwareVersion': 'v1.8.0',
        'lastSyncedAt': '18m ago',
      },
      {
        'id': 'IOT-003',
        'deviceName': 'Walk-in smart refrigerator',
        'deviceType': 'Smart refrigerator',
        'section': 'Continental',
        'connectionStatus': 'connected',
        'firmwareVersion': 'v3.1.2',
        'lastSyncedAt': '1m ago',
      },
      {
        'id': 'IOT-004',
        'deviceName': 'Smart espresso machine',
        'deviceType': 'Smart coffee machine',
        'section': 'Beverage',
        'connectionStatus': 'connected',
        'firmwareVersion': 'v2.0.5',
        'lastSyncedAt': '4m ago',
      },
    ];
  }

  static List<Map<String, dynamic>> _seedTemperatures() {
    return [
      {
        'id': 'TMP-IOT-001',
        'deviceName': 'Smart tandoor oven',
        'section': 'Tandoor',
        'currentTemp': '420°C',
        'targetTemp': '400°C',
        'status': 'stable',
      },
      {
        'id': 'TMP-IOT-002',
        'deviceName': 'Walk-in smart refrigerator',
        'section': 'Continental',
        'currentTemp': '3.2°C',
        'targetTemp': '4°C',
        'status': 'stable',
      },
      {
        'id': 'TMP-IOT-003',
        'deviceName': 'Smart espresso machine',
        'section': 'Beverage',
        'currentTemp': '92°C',
        'targetTemp': '93°C',
        'status': 'alert',
      },
    ];
  }

  static List<Map<String, dynamic>> _seedMaintenance() {
    return [
      {
        'id': 'MNT-IOT-001',
        'deviceId': 'IOT-002',
        'deviceName': 'Smart fryer #2',
        'section': 'Main',
        'alertType': 'Filter replacement due',
        'dueInDays': 3,
        'status': 'pending',
      },
      {
        'id': 'MNT-IOT-002',
        'deviceId': 'IOT-004',
        'deviceName': 'Smart espresso machine',
        'section': 'Beverage',
        'alertType': 'Descale cycle due',
        'dueInDays': 5,
        'status': 'pending',
      },
    ];
  }

  static List<Map<String, dynamic>> _seedUsage() {
    return [
      {
        'id': 'USG-IOT-001',
        'deviceName': 'Smart tandoor oven',
        'section': 'Tandoor',
        'cyclesToday': 48,
        'uptimeHours': 10.5,
        'efficiencyPercent': 91,
      },
      {
        'id': 'USG-IOT-002',
        'deviceName': 'Smart fryer #2',
        'section': 'Main',
        'cyclesToday': 22,
        'uptimeHours': 6.2,
        'efficiencyPercent': 68,
      },
      {
        'id': 'USG-IOT-003',
        'deviceName': 'Walk-in smart refrigerator',
        'section': 'Continental',
        'cyclesToday': 0,
        'uptimeHours': 24,
        'efficiencyPercent': 95,
      },
      {
        'id': 'USG-IOT-004',
        'deviceName': 'Smart espresso machine',
        'section': 'Beverage',
        'cyclesToday': 86,
        'uptimeHours': 9.1,
        'efficiencyPercent': 88,
      },
    ];
  }

  static int get syncedToday => _syncedToday;
}

class MockIotDeviceEngine {
  const MockIotDeviceEngine._();

  static Map<String, dynamic> buildSnapshot({String section = 'All'}) {
    final smartDevices = MockIotDeviceRegistry.devicesFor(section);
    final temperatureReadings = MockIotDeviceRegistry.temperaturesFor(section);
    final maintenanceAlerts = MockIotDeviceRegistry.maintenanceFor(section);
    final usageAnalytics = MockIotDeviceRegistry.usageFor(section);

    return {
      'section': section,
      'lastSyncedAt': DateTime.now().toIso8601String(),
      'smartDevices': smartDevices,
      'temperatureReadings': temperatureReadings,
      'maintenanceAlerts': maintenanceAlerts,
      'usageAnalytics': usageAnalytics,
      'stats': {
        'connectedDevices': smartDevices
            .where((item) => item['connectionStatus'] == 'connected')
            .length,
        'offlineDevices': smartDevices
            .where((item) => item['connectionStatus'] == 'offline')
            .length,
        'tempAlerts': temperatureReadings
            .where((item) => item['status'] == 'alert')
            .length,
        'maintenanceDue': maintenanceAlerts
            .where((item) => item['status'] == 'pending')
            .length,
        'avgEfficiency': usageAnalytics.isEmpty
            ? 0
            : (usageAnalytics
                        .map((item) => item['efficiencyPercent'] as int)
                        .reduce((a, b) => a + b) /
                    usageAnalytics.length)
                .round(),
        'syncedToday': MockIotDeviceRegistry.syncedToday,
      },
      'iotFeatures': {
        'smartOvens': smartDevices.any(
          (item) => item['deviceType'] == 'Smart oven',
        ),
        'smartFryers': smartDevices.any(
          (item) => item['deviceType'] == 'Smart fryer',
        ),
        'smartRefrigerators': smartDevices.any(
          (item) => item['deviceType'] == 'Smart refrigerator',
        ),
        'smartCoffeeMachines': smartDevices.any(
          (item) => item['deviceType'] == 'Smart coffee machine',
        ),
        'temperatureMonitoring': temperatureReadings.isNotEmpty,
        'autoMaintenanceAlerts': maintenanceAlerts.isNotEmpty,
        'smartUsageAnalytics': usageAnalytics.isNotEmpty,
      },
      'sections': MockSectionRegistry.filterSections,
    };
  }
}
