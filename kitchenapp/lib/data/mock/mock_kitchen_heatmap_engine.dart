import 'mock_section_registry.dart';

class MockKitchenHeatmapRegistry {
  MockKitchenHeatmapRegistry._();

  static final List<Map<String, dynamic>> _stations = _seedStations();
  static final List<Map<String, dynamic>> _hotspots = _seedHotspots();
  static final List<Map<String, dynamic>> _density = _seedDensity();
  static final List<Map<String, dynamic>> _rush = _seedRush();

  static List<Map<String, dynamic>> stationsFor(String section) {
    if (section == 'All') {
      return _stations.map(_serializeStation).toList();
    }
    return _stations
        .where((item) => item['section'] == section)
        .map(_serializeStation)
        .toList();
  }

  static List<Map<String, dynamic>> hotspotsFor(String section) {
    if (section == 'All') {
      return _hotspots.map(_serializeHotspot).toList();
    }
    return _hotspots
        .where((item) => item['section'] == section)
        .map(_serializeHotspot)
        .toList();
  }

  static List<Map<String, dynamic>> densityFor(String section) {
    if (section == 'All') {
      return _density.map(_serializeDensity).toList();
    }
    return _density
        .where((item) => item['section'] == section)
        .map(_serializeDensity)
        .toList();
  }

  static List<Map<String, dynamic>> rushFor(String section) {
    if (section == 'All') {
      return _rush.map(_serializeRush).toList();
    }
    return _rush
        .where((item) => item['section'] == section)
        .map(_serializeRush)
        .toList();
  }

  static Map<String, dynamic> performStationAction({
    required String stationId,
    required String action,
  }) {
    final station = _findStation(stationId);
    if (station == null) {
      throw ArgumentError('Station heat cell not found');
    }

    final stationName = station['stationName'] as String;

    switch (action) {
      case 'rebalance_station':
        station['loadPercent'] = (station['loadPercent'] as int) - 15;
        station['heatLevel'] = 'medium';
        return {
          'success': true,
          'message': 'Station rebalanced · $stationName',
        };
      case 'pause_station':
        station['status'] = 'paused';
        station['heatLevel'] = 'low';
        return {
          'success': true,
          'message': 'Station paused · $stationName',
        };
      case 'escalate_station':
        station['heatLevel'] = 'critical';
        station['status'] = 'escalated';
        return {
          'success': true,
          'message': 'Station escalated · $stationName',
        };
      default:
        throw ArgumentError('Unknown station action: $action');
    }
  }

  static Map<String, dynamic> performHotspotAction({
    required String hotspotId,
    required String action,
  }) {
    final hotspot = _findHotspot(hotspotId);
    if (hotspot == null) {
      throw ArgumentError('Delay hotspot not found');
    }

    final zoneName = hotspot['zoneName'] as String;

    switch (action) {
      case 'acknowledge_hotspot':
        hotspot['status'] = 'acknowledged';
        return {
          'success': true,
          'message': 'Hotspot acknowledged · $zoneName',
        };
      case 'reroute_orders':
        hotspot['delayMinutes'] = (hotspot['delayMinutes'] as int) - 5;
        hotspot['severity'] = 'medium';
        return {
          'success': true,
          'message': 'Orders rerouted · $zoneName',
        };
      case 'clear_hotspot':
        hotspot['status'] = 'cleared';
        hotspot['delayMinutes'] = 0;
        return {
          'success': true,
          'message': 'Hotspot cleared · $zoneName',
        };
      default:
        throw ArgumentError('Unknown hotspot action: $action');
    }
  }

  static Map<String, dynamic> performDensityAction({
    required String densityId,
    required String action,
  }) {
    final zone = _findDensity(densityId);
    if (zone == null) {
      throw ArgumentError('Staff density zone not found');
    }

    final zoneName = zone['zoneName'] as String;

    switch (action) {
      case 'rebalance_staff':
        zone['densityLevel'] = 'balanced';
        zone['staffCount'] = zone['capacity'];
        return {
          'success': true,
          'message': 'Staff rebalanced · $zoneName',
        };
      case 'request_backup':
        zone['staffCount'] = (zone['staffCount'] as int) + 1;
        zone['densityLevel'] = 'balanced';
        return {
          'success': true,
          'message': 'Backup requested · $zoneName',
        };
      default:
        throw ArgumentError('Unknown density action: $action');
    }
  }

  static Map<String, dynamic> performRushAction({
    required String rushId,
    required String action,
  }) {
    final rush = _findRush(rushId);
    if (rush == null) {
      throw ArgumentError('Rush zone not found');
    }

    final zoneName = rush['zoneName'] as String;

    switch (action) {
      case 'activate_rush_mode':
        rush['status'] = 'rush_active';
        rush['rushLevel'] = 'high';
        return {
          'success': true,
          'message': 'Rush mode activated · $zoneName',
        };
      case 'extend_rush_window':
        rush['windowLabel'] = 'Extended +30 min';
        return {
          'success': true,
          'message': 'Rush window extended · $zoneName',
        };
      case 'dismiss_rush':
        rush['status'] = 'dismissed';
        rush['rushLevel'] = 'low';
        return {
          'success': true,
          'message': 'Rush dismissed · $zoneName',
        };
      default:
        throw ArgumentError('Unknown rush action: $action');
    }
  }

  static Map<String, dynamic> refreshAll() {
    for (final station in _stations) {
      if ((station['loadPercent'] as int) > 80) {
        station['heatLevel'] = 'high';
      }
    }
    return {
      'success': true,
      'message': 'Heatmap refreshed · ${_stations.length} stations mapped',
    };
  }

  static Map<String, dynamic>? _findStation(String stationId) {
    for (final station in _stations) {
      if (station['id'] == stationId) {
        return station;
      }
    }
    return null;
  }

  static Map<String, dynamic>? _findHotspot(String hotspotId) {
    for (final hotspot in _hotspots) {
      if (hotspot['id'] == hotspotId) {
        return hotspot;
      }
    }
    return null;
  }

  static Map<String, dynamic>? _findDensity(String densityId) {
    for (final zone in _density) {
      if (zone['id'] == densityId) {
        return zone;
      }
    }
    return null;
  }

  static Map<String, dynamic>? _findRush(String rushId) {
    for (final rush in _rush) {
      if (rush['id'] == rushId) {
        return rush;
      }
    }
    return null;
  }

  static Map<String, dynamic> _serializeStation(Map<String, dynamic> station) {
    return {
      'id': station['id'],
      'stationName': station['stationName'],
      'section': station['section'],
      'heatLevel': station['heatLevel'],
      'loadPercent': station['loadPercent'],
      'ordersQueued': station['ordersQueued'],
      'status': station['status'],
      'availableActions': _stationActions(station),
    };
  }

  static List<String> _stationActions(Map<String, dynamic> station) {
    if (station['status'] == 'paused') {
      return ['rebalance_station'];
    }
    return ['rebalance_station', 'pause_station', 'escalate_station'];
  }

  static Map<String, dynamic> _serializeHotspot(Map<String, dynamic> hotspot) {
    return {
      'id': hotspot['id'],
      'zoneName': hotspot['zoneName'],
      'section': hotspot['section'],
      'delayMinutes': hotspot['delayMinutes'],
      'severity': hotspot['severity'],
      'status': hotspot['status'],
      'availableActions': hotspot['status'] == 'cleared'
          ? <String>[]
          : ['acknowledge_hotspot', 'reroute_orders', 'clear_hotspot'],
    };
  }

  static Map<String, dynamic> _serializeDensity(Map<String, dynamic> zone) {
    return {
      'id': zone['id'],
      'zoneName': zone['zoneName'],
      'section': zone['section'],
      'staffCount': zone['staffCount'],
      'capacity': zone['capacity'],
      'densityLevel': zone['densityLevel'],
      'availableActions': ['rebalance_staff', 'request_backup'],
    };
  }

  static Map<String, dynamic> _serializeRush(Map<String, dynamic> rush) {
    return {
      'id': rush['id'],
      'zoneName': rush['zoneName'],
      'section': rush['section'],
      'rushLevel': rush['rushLevel'],
      'coversExpected': rush['coversExpected'],
      'windowLabel': rush['windowLabel'],
      'status': rush['status'],
      'availableActions': rush['status'] == 'dismissed'
          ? <String>[]
          : ['activate_rush_mode', 'extend_rush_window', 'dismiss_rush'],
    };
  }

  static List<Map<String, dynamic>> _seedStations() {
    return [
      {
        'id': 'HT-ST-001',
        'stationName': 'Main grill',
        'section': 'Main',
        'heatLevel': 'critical',
        'loadPercent': 94,
        'ordersQueued': 8,
        'status': 'active',
      },
      {
        'id': 'HT-ST-002',
        'stationName': 'Tandoor pit',
        'section': 'Tandoor',
        'heatLevel': 'high',
        'loadPercent': 82,
        'ordersQueued': 6,
        'status': 'active',
      },
      {
        'id': 'HT-ST-003',
        'stationName': 'Wok line #1',
        'section': 'Chinese',
        'heatLevel': 'medium',
        'loadPercent': 68,
        'ordersQueued': 4,
        'status': 'active',
      },
      {
        'id': 'HT-ST-004',
        'stationName': 'Continental pass',
        'section': 'Continental',
        'heatLevel': 'low',
        'loadPercent': 42,
        'ordersQueued': 2,
        'status': 'active',
      },
    ];
  }

  static List<Map<String, dynamic>> _seedHotspots() {
    return [
      {
        'id': 'HT-DLY-001',
        'zoneName': 'Main grill delay zone',
        'section': 'Main',
        'delayMinutes': 18,
        'severity': 'high',
        'status': 'active',
      },
      {
        'id': 'HT-DLY-002',
        'zoneName': 'Tandoor pickup lane',
        'section': 'Tandoor',
        'delayMinutes': 11,
        'severity': 'medium',
        'status': 'active',
      },
    ];
  }

  static List<Map<String, dynamic>> _seedDensity() {
    return [
      {
        'id': 'HT-DEN-001',
        'zoneName': 'Main hot line',
        'section': 'Main',
        'staffCount': 2,
        'capacity': 4,
        'densityLevel': 'understaffed',
      },
      {
        'id': 'HT-DEN-002',
        'zoneName': 'Tandoor section',
        'section': 'Tandoor',
        'staffCount': 3,
        'capacity': 3,
        'densityLevel': 'balanced',
      },
      {
        'id': 'HT-DEN-003',
        'zoneName': 'Expeditor pass',
        'section': 'Main',
        'staffCount': 4,
        'capacity': 3,
        'densityLevel': 'overstaffed',
      },
    ];
  }

  static List<Map<String, dynamic>> _seedRush() {
    return [
      {
        'id': 'HT-RSH-001',
        'zoneName': 'Lunch rush · Main floor',
        'section': 'Main',
        'rushLevel': 'high',
        'coversExpected': 148,
        'windowLabel': '13:00–14:30',
        'status': 'active',
      },
      {
        'id': 'HT-RSH-002',
        'zoneName': 'Banquet prep surge',
        'section': 'Continental',
        'rushLevel': 'moderate',
        'coversExpected': 86,
        'windowLabel': '18:00–19:00',
        'status': 'active',
      },
    ];
  }
}

class MockKitchenHeatmapEngine {
  const MockKitchenHeatmapEngine._();

  static Map<String, dynamic> buildSnapshot({String section = 'All'}) {
    final stationHeatmap = MockKitchenHeatmapRegistry.stationsFor(section);
    final delayHotspots = MockKitchenHeatmapRegistry.hotspotsFor(section);
    final staffDensity = MockKitchenHeatmapRegistry.densityFor(section);
    final rushZones = MockKitchenHeatmapRegistry.rushFor(section);

    final avgLoad = stationHeatmap.isEmpty
        ? 0
        : (stationHeatmap
                    .map((item) => item['loadPercent'] as int)
                    .reduce((a, b) => a + b) /
                stationHeatmap.length)
            .round();

    return {
      'section': section,
      'lastSyncedAt': DateTime.now().toIso8601String(),
      'stationHeatmap': stationHeatmap,
      'delayHotspots': delayHotspots,
      'staffDensity': staffDensity,
      'rushZones': rushZones,
      'stats': {
        'hotStations': stationHeatmap
            .where((item) =>
                item['heatLevel'] == 'high' ||
                item['heatLevel'] == 'critical')
            .length,
        'delayHotspots': delayHotspots
            .where((item) => item['status'] == 'active')
            .length,
        'overstaffedZones': staffDensity
            .where((item) => item['densityLevel'] == 'overstaffed')
            .length,
        'understaffedZones': staffDensity
            .where((item) => item['densityLevel'] == 'understaffed')
            .length,
        'activeRushZones':
            rushZones.where((item) => item['status'] == 'active').length,
        'avgLoadPercent': avgLoad,
      },
      'heatmapFeatures': {
        'busyStationMapping': stationHeatmap.isNotEmpty,
        'delayHotspots': delayHotspots.isNotEmpty,
        'staffDensityTracking': staffDensity.isNotEmpty,
        'rushVisualization': rushZones.isNotEmpty,
      },
      'sections': MockSectionRegistry.filterSections,
    };
  }
}
