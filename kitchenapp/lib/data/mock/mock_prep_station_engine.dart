import 'mock_section_registry.dart';

class MockPrepStationRegistry {
  MockPrepStationRegistry._();

  static final List<Map<String, dynamic>> _stations = _seedStations();

  static List<Map<String, dynamic>> stationsFor(String section) {
    if (section == 'All') {
      return _stations.map(Map<String, dynamic>.from).toList();
    }
    return _stations
        .where((station) => station['kitchenSection'] == section)
        .map(Map<String, dynamic>.from)
        .toList();
  }

  static Map<String, dynamic>? findById(String stationId) {
    for (final station in _stations) {
      if (station['id'] == stationId) {
        return station;
      }
    }
    return null;
  }

  static List<String> availableActions(Map<String, dynamic> station) {
    final actions = <String>['start_timer', 'pause_timer', 'reset_timer'];
    if ((station['queueCount'] as int) > 2) {
      actions.add('clear_queue');
    }
    if ((station['workload'] as num) > 0.75) {
      actions.add('reduce_load');
    }
    return actions;
  }

  static Map<String, dynamic> balanceQueues() {
    final sorted = [..._stations]
      ..sort((a, b) => (a['queueCount'] as int).compareTo(b['queueCount'] as int));

    final busiest = sorted.last;
    final lightest = sorted.first;
    if (busiest['id'] == lightest['id']) {
      return {'success': true, 'message': 'Prep station queues already balanced'};
    }

    busiest['queueCount'] = (busiest['queueCount'] as int) - 1;
    lightest['queueCount'] = (lightest['queueCount'] as int) + 1;
    _recalculateWorkload(busiest);
    _recalculateWorkload(lightest);

    return {
      'success': true,
      'message':
          'Queue balancing applied · moved 1 task from ${busiest['name']} to ${lightest['name']}',
    };
  }

  static Map<String, dynamic> assignStaff({
    required String stationId,
    required String staffName,
  }) {
    final station = findById(stationId);
    if (station == null) {
      throw ArgumentError('Prep station not found');
    }

    station['assignedStaff'] = staffName;
    station['productivityScore'] =
        ((station['productivityScore'] as num).toDouble() + 0.04).clamp(0.0, 0.99);

    return {
      'success': true,
      'message': 'Assigned $staffName to ${station['name']}',
    };
  }

  static Map<String, dynamic> performAction({
    required String stationId,
    required String action,
  }) {
    final station = findById(stationId);
    if (station == null) {
      throw ArgumentError('Prep station not found');
    }

    switch (action) {
      case 'start_timer':
        station['timerRunning'] = true;
        station['status'] = 'active';
        return {
          'success': true,
          'message': 'Prep timer started · ${station['name']}',
        };
      case 'pause_timer':
        station['timerRunning'] = false;
        station['status'] = 'paused';
        return {
          'success': true,
          'message': 'Prep timer paused · ${station['name']}',
        };
      case 'reset_timer':
        station['timerSeconds'] = 0;
        station['timerRunning'] = false;
        return {
          'success': true,
          'message': 'Prep timer reset · ${station['name']}',
        };
      case 'clear_queue':
        station['queueCount'] = (station['queueCount'] as int) - 1;
        _recalculateWorkload(station);
        return {
          'success': true,
          'message': 'Queue cleared on ${station['name']}',
        };
      case 'reduce_load':
        station['workload'] =
            ((station['workload'] as num).toDouble() - 0.12).clamp(0.2, 0.99);
        return {
          'success': true,
          'message': 'Load reduced on ${station['name']}',
        };
      default:
        throw ArgumentError('Unknown prep station action: $action');
    }
  }

  static void tickTimers() {
    for (final station in _stations) {
      if (station['timerRunning'] == true) {
        station['timerSeconds'] = (station['timerSeconds'] as int) + 1;
      }
    }
  }

  static void _recalculateWorkload(Map<String, dynamic> station) {
    final queue = station['queueCount'] as int;
    final load = (0.35 + queue * 0.12).clamp(0.2, 0.98);
    station['workload'] = load;
  }

  static List<Map<String, dynamic>> _seedStations() {
    return [
      _station(
        id: 'STN-CUT',
        name: 'Cutting station',
        type: 'cutting',
        kitchenSection: 'Salad',
        assignedStaff: 'Cold Prep',
        queueCount: 3,
        timerSeconds: 420,
        productivityScore: 0.82,
      ),
      _station(
        id: 'STN-SAUCE',
        name: 'Sauce station',
        type: 'sauce',
        kitchenSection: 'Main',
        assignedStaff: 'Line Cook',
        queueCount: 2,
        timerSeconds: 265,
        productivityScore: 0.88,
      ),
      _station(
        id: 'STN-GRILL',
        name: 'Grill station',
        type: 'grill',
        kitchenSection: 'Grill',
        assignedStaff: 'Grill Station',
        queueCount: 4,
        timerSeconds: 510,
        productivityScore: 0.76,
      ),
      _station(
        id: 'STN-FRY',
        name: 'Fry station',
        type: 'fry',
        kitchenSection: 'Fry',
        assignedStaff: 'Fry Station',
        queueCount: 2,
        timerSeconds: 180,
        productivityScore: 0.91,
      ),
      _station(
        id: 'STN-BEV',
        name: 'Beverage station',
        type: 'beverage',
        kitchenSection: 'Beverage',
        assignedStaff: 'Bar Team',
        queueCount: 1,
        timerSeconds: 95,
        productivityScore: 0.94,
      ),
      _station(
        id: 'STN-DESSERT',
        name: 'Dessert prep station',
        type: 'dessert',
        kitchenSection: 'Dessert',
        assignedStaff: 'Dessert Team',
        queueCount: 3,
        timerSeconds: 340,
        productivityScore: 0.79,
      ),
    ];
  }

  static Map<String, dynamic> _station({
    required String id,
    required String name,
    required String type,
    required String kitchenSection,
    required String assignedStaff,
    required int queueCount,
    required int timerSeconds,
    required double productivityScore,
  }) {
    final workload = (0.35 + queueCount * 0.12).clamp(0.2, 0.98);
    return {
      'id': id,
      'name': name,
      'type': type,
      'kitchenSection': kitchenSection,
      'assignedStaff': assignedStaff,
      'queueCount': queueCount,
      'timerSeconds': timerSeconds,
      'timerRunning': timerSeconds > 0,
      'workload': workload,
      'productivityScore': productivityScore,
      'status': timerSeconds > 0 ? 'active' : 'idle',
    };
  }
}

class MockPrepStationEngine {
  const MockPrepStationEngine._();

  static Map<String, dynamic> buildSnapshot({String section = 'All'}) {
    MockPrepStationRegistry.tickTimers();
    final stations = MockPrepStationRegistry.stationsFor(section);
    final avgWorkload = stations.isEmpty
        ? 0.0
        : stations
                .map((s) => (s['workload'] as num).toDouble())
                .reduce((a, b) => a + b) /
            stations.length;

    return {
      'section': section,
      'lastSyncedAt': DateTime.now().toIso8601String(),
      'stations': stations
          .map(
            (station) => {
              ...station,
              'availableActions':
                  MockPrepStationRegistry.availableActions(station),
              'timerLabel': _formatTimer(station['timerSeconds'] as int),
            },
          )
          .toList(),
      'stats': {
        'stations': stations.length,
        'activeTimers': stations.where((s) => s['timerRunning'] == true).length,
        'avgWorkload': avgWorkload,
        'totalQueue': stations.fold<int>(
          0,
          (sum, station) => sum + (station['queueCount'] as int),
        ),
        'avgProductivity': stations.isEmpty
            ? 0.0
            : stations
                    .map((s) => (s['productivityScore'] as num).toDouble())
                    .reduce((a, b) => a + b) /
                stations.length,
      },
      'stationFeatures': {
        'cuttingStation': stations.any((s) => s['type'] == 'cutting'),
        'sauceStation': stations.any((s) => s['type'] == 'sauce'),
        'grillStation': stations.any((s) => s['type'] == 'grill'),
        'fryStation': stations.any((s) => s['type'] == 'fry'),
        'beverageStation': stations.any((s) => s['type'] == 'beverage'),
        'dessertPrepStation': stations.any((s) => s['type'] == 'dessert'),
        'stationWorkloadTracking': true,
        'prepTimers': stations.any((s) => s['timerRunning'] == true),
        'queueBalancing': true,
        'staffAssignment': stations.every((s) => s['assignedStaff'] != null),
        'productivityTracking': true,
      },
      'sections': MockSectionRegistry.filterSections,
    };
  }

  static String _formatTimer(int seconds) {
    final minutes = seconds ~/ 60;
    final remainder = seconds % 60;
    return '${minutes.toString().padLeft(2, '0')}:${remainder.toString().padLeft(2, '0')}';
  }
}
