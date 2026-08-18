import 'mock_section_registry.dart';

class MockSmartEnergyRegistry {
  MockSmartEnergyRegistry._();

  static final List<Map<String, dynamic>> _gasAlerts = _seedGasAlerts();
  static final List<Map<String, dynamic>> _energyUsage = _seedEnergyUsage();
  static final List<Map<String, dynamic>> _shutdowns = _seedShutdowns();
  static final List<Map<String, dynamic>> _tempAlerts = _seedTempAlerts();
  static int _resolvedToday = 7;

  static List<Map<String, dynamic>> gasAlertsFor(String section) {
    if (section == 'All') {
      return _gasAlerts.map(_serializeGasAlert).toList();
    }
    return _gasAlerts
        .where((item) => item['section'] == section)
        .map(_serializeGasAlert)
        .toList();
  }

  static List<Map<String, dynamic>> energyUsageFor(String section) {
    if (section == 'All') {
      return _energyUsage.map(Map<String, dynamic>.from).toList();
    }
    return _energyUsage
        .where((item) => item['section'] == section)
        .map(Map<String, dynamic>.from)
        .toList();
  }

  static List<Map<String, dynamic>> shutdownsFor(String section) {
    if (section == 'All') {
      return _shutdowns.map(_serializeShutdown).toList();
    }
    return _shutdowns
        .where((item) => item['section'] == section)
        .map(_serializeShutdown)
        .toList();
  }

  static List<Map<String, dynamic>> tempAlertsFor(String section) {
    if (section == 'All') {
      return _tempAlerts.map(_serializeTempAlert).toList();
    }
    return _tempAlerts
        .where((item) => item['section'] == section)
        .map(_serializeTempAlert)
        .toList();
  }

  static Map<String, dynamic> performAction({
    required String alertId,
    required String action,
  }) {
    final gas = _findInList(_gasAlerts, alertId);
    final shutdown = _findInList(_shutdowns, alertId);
    final temp = _findInList(_tempAlerts, alertId);
    final target = gas ?? shutdown ?? temp;

    if (target == null) {
      throw ArgumentError('Energy alert not found');
    }

    final label = target['location'] ??
        target['equipmentName'] ??
        target['meterName'] ??
        'Alert';

    switch (action) {
      case 'acknowledge_alert':
        target['status'] = 'acknowledged';
        return {
          'success': true,
          'message': 'Alert acknowledged · $label',
        };
      case 'resolve_gas_leak':
        target['status'] = 'resolved';
        target['sensorLevel'] = '12 ppm';
        target['severity'] = 'normal';
        _resolvedToday++;
        return {
          'success': true,
          'message': 'Gas alert resolved · $label',
        };
      case 'trigger_shutdown':
        target['status'] = 'executed';
        _resolvedToday++;
        return {
          'success': true,
          'message': 'Smart shutdown executed · $label',
        };
      case 'cancel_shutdown':
        target['status'] = 'cancelled';
        return {
          'success': true,
          'message': 'Shutdown cancelled · $label',
        };
      case 'reset_temperature':
        target['status'] = 'resolved';
        target['currentTemp'] = '420°C';
        _resolvedToday++;
        return {
          'success': true,
          'message': 'Temperature normalized · $label',
        };
      case 'log_energy_reading':
        final meter = _energyUsage.cast<Map<String, dynamic>?>().firstWhere(
              (item) => item?['section'] == target['section'],
              orElse: () => null,
            );
        if (meter != null) {
          meter['dailyKwh'] = (meter['dailyKwh'] as num) + 0.8;
        }
        return {
          'success': true,
          'message': 'Energy reading logged · ${target['section']}',
        };
      case 'hold_alert':
        target['status'] = 'on_hold';
        return {
          'success': true,
          'message': 'Alert held · $label',
        };
      default:
        throw ArgumentError('Unknown energy action: $action');
    }
  }

  static Map<String, dynamic> triggerShutdown({String? equipmentName}) {
    final name = equipmentName ?? 'Deep fryer #2';
    _shutdowns.insert(0, {
      'id': 'SDN-${DateTime.now().millisecondsSinceEpoch}',
      'equipmentName': name,
      'section': 'Main',
      'reason': 'Manual safety shutdown',
      'scheduledTime': 'Immediate',
      'status': 'pending',
    });
    return {
      'success': true,
      'message': 'Smart shutdown triggered · $name',
    };
  }

  static Map<String, dynamic>? _findInList(
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

  static Map<String, dynamic> _serializeGasAlert(Map<String, dynamic> item) {
    return {
      'id': item['id'],
      'location': item['location'],
      'section': item['section'],
      'sensorLevel': item['sensorLevel'],
      'threshold': item['threshold'],
      'severity': item['severity'],
      'status': item['status'],
      'availableActions': _gasActions(item),
    };
  }

  static Map<String, dynamic> _serializeShutdown(Map<String, dynamic> item) {
    return {
      'id': item['id'],
      'equipmentName': item['equipmentName'],
      'section': item['section'],
      'reason': item['reason'],
      'scheduledTime': item['scheduledTime'],
      'status': item['status'],
      'availableActions': _shutdownActions(item),
    };
  }

  static Map<String, dynamic> _serializeTempAlert(Map<String, dynamic> item) {
    return {
      'id': item['id'],
      'equipmentName': item['equipmentName'],
      'section': item['section'],
      'currentTemp': item['currentTemp'],
      'threshold': item['threshold'],
      'status': item['status'],
      'availableActions': _tempActions(item),
    };
  }

  static List<String> _gasActions(Map<String, dynamic> item) {
    if (item['status'] == 'resolved') {
      return const [];
    }
    return [
      'acknowledge_alert',
      'resolve_gas_leak',
      'trigger_shutdown',
      'hold_alert',
    ];
  }

  static List<String> _shutdownActions(Map<String, dynamic> item) {
    if (item['status'] == 'executed' || item['status'] == 'cancelled') {
      return const [];
    }
    return ['trigger_shutdown', 'cancel_shutdown', 'hold_alert'];
  }

  static List<String> _tempActions(Map<String, dynamic> item) {
    if (item['status'] == 'resolved') {
      return const [];
    }
    return [
      'acknowledge_alert',
      'reset_temperature',
      'trigger_shutdown',
      'hold_alert',
    ];
  }

  static List<Map<String, dynamic>> _seedGasAlerts() {
    return [
      {
        'id': 'GAS-001',
        'location': 'Tandoor gas line',
        'section': 'Tandoor',
        'sensorLevel': '18 ppm',
        'threshold': '50 ppm',
        'severity': 'normal',
        'status': 'monitoring',
      },
      {
        'id': 'GAS-002',
        'location': 'Main kitchen gas manifold',
        'section': 'Main',
        'sensorLevel': '68 ppm',
        'threshold': '50 ppm',
        'severity': 'warning',
        'status': 'active',
      },
    ];
  }

  static List<Map<String, dynamic>> _seedEnergyUsage() {
    return [
      {
        'id': 'ENR-001',
        'meterName': 'Main kitchen meter',
        'section': 'Main',
        'currentKwh': 4.2,
        'dailyKwh': 48.2,
        'peakWindow': '19:00-22:00',
        'trend': 'rising',
      },
      {
        'id': 'ENR-002',
        'meterName': 'Tandoor gas/electric meter',
        'section': 'Tandoor',
        'currentKwh': 2.8,
        'dailyKwh': 31.6,
        'peakWindow': '18:00-21:00',
        'trend': 'stable',
      },
      {
        'id': 'ENR-003',
        'meterName': 'Cold kitchen meter',
        'section': 'Continental',
        'currentKwh': 1.4,
        'dailyKwh': 19.5,
        'peakWindow': '12:00-15:00',
        'trend': 'stable',
      },
    ];
  }

  static List<Map<String, dynamic>> _seedShutdowns() {
    return [
      {
        'id': 'SDN-001',
        'equipmentName': 'Deep fryer #2',
        'section': 'Main',
        'reason': 'Overheat protection',
        'scheduledTime': '22:45',
        'status': 'pending',
      },
      {
        'id': 'SDN-002',
        'equipmentName': 'Tandoor oven chamber',
        'section': 'Tandoor',
        'reason': 'End-of-service auto shutdown',
        'scheduledTime': '23:30',
        'status': 'scheduled',
      },
    ];
  }

  static List<Map<String, dynamic>> _seedTempAlerts() {
    return [
      {
        'id': 'TMP-001',
        'equipmentName': 'Tandoor oven chamber',
        'section': 'Tandoor',
        'currentTemp': '485°C',
        'threshold': '450°C',
        'status': 'active',
      },
      {
        'id': 'TMP-002',
        'equipmentName': 'Walk-in chiller compressor',
        'section': 'Continental',
        'currentTemp': '42°C',
        'threshold': '55°C',
        'status': 'monitoring',
      },
    ];
  }

  static int get resolvedToday => _resolvedToday;
}

class MockSmartEnergyEngine {
  const MockSmartEnergyEngine._();

  static Map<String, dynamic> buildSnapshot({String section = 'All'}) {
    final gasLeakAlerts = MockSmartEnergyRegistry.gasAlertsFor(section);
    final energyUsage = MockSmartEnergyRegistry.energyUsageFor(section);
    final shutdownAlerts = MockSmartEnergyRegistry.shutdownsFor(section);
    final temperatureAlerts = MockSmartEnergyRegistry.tempAlertsFor(section);

    return {
      'section': section,
      'lastSyncedAt': DateTime.now().toIso8601String(),
      'gasLeakAlerts': gasLeakAlerts,
      'energyUsage': energyUsage,
      'shutdownAlerts': shutdownAlerts,
      'temperatureAlerts': temperatureAlerts,
      'stats': {
        'totalDailyKwh': energyUsage.fold<double>(
          0,
          (sum, item) => sum + (item['dailyKwh'] as num).toDouble(),
        ),
        'activeGasAlerts': gasLeakAlerts
            .where((item) => item['status'] == 'active')
            .length,
        'pendingShutdowns': shutdownAlerts
            .where(
              (item) =>
                  item['status'] == 'pending' || item['status'] == 'scheduled',
            )
            .length,
        'temperatureAlerts': temperatureAlerts
            .where((item) => item['status'] == 'active')
            .length,
        'sectionsMonitored': energyUsage.length,
        'resolvedToday': MockSmartEnergyRegistry.resolvedToday,
      },
      'energyFeatures': {
        'gasLeakAlerts': gasLeakAlerts.isNotEmpty,
        'energyUsageTracking': energyUsage.isNotEmpty,
        'smartShutdownAlerts': shutdownAlerts.isNotEmpty,
        'highTemperatureAlerts': temperatureAlerts.isNotEmpty,
      },
      'sections': MockSectionRegistry.filterSections,
    };
  }
}
