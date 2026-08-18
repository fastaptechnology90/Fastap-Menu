import 'mock_order_store.dart';
import 'mock_section_registry.dart';

class MockBanquetRegistry {
  MockBanquetRegistry._();

  static final Map<String, Map<String, dynamic>> _events = _seedEvents();
  static final Map<String, Map<String, dynamic>> _bulkJobs = _seedBulkJobs();
  static final List<Map<String, dynamic>> _buffetStations =
      _seedBuffetStations();
  static final List<Map<String, dynamic>> _guestPlans = _seedGuestPlans();
  static final List<Map<String, dynamic>> _counters = _seedCounters();
  static int _completedToday = 3;

  static List<Map<String, dynamic>> bulkJobsFor(String section) {
    _syncFromOrderStore();
    final items = section == 'All'
        ? _bulkJobs.values
        : _bulkJobs.values.where((job) => job['section'] == section);
    return items
        .where((job) => job['status'] != 'completed')
        .map(_serializeBulkJob)
        .toList();
  }

  static List<Map<String, dynamic>> buffetStationsFor(String section) {
    if (section == 'All') {
      return _buffetStations.map(Map<String, dynamic>.from).toList();
    }
    return _buffetStations
        .where((station) => station['section'] == section)
        .map(Map<String, dynamic>.from)
        .toList();
  }

  static List<Map<String, dynamic>> eventSchedulesFor(String section) {
    _syncFromOrderStore();
    final items = section == 'All'
        ? _events.values
        : _events.values.where((event) => event['section'] == section);
    return items
        .where((event) => event['status'] != 'completed')
        .map(_serializeEvent)
        .toList();
  }

  static List<Map<String, dynamic>> guestPlansFor(String section) {
    if (section == 'All') {
      return _guestPlans.map(Map<String, dynamic>.from).toList();
    }
    return _guestPlans
        .where((plan) => plan['section'] == section)
        .map(Map<String, dynamic>.from)
        .toList();
  }

  static List<Map<String, dynamic>> countersFor(String section) {
    if (section == 'All') {
      return _counters.map(Map<String, dynamic>.from).toList();
    }
    return _counters
        .where((counter) => counter['section'] == section)
        .map(Map<String, dynamic>.from)
        .toList();
  }

  static Map<String, dynamic> performAction({
    required String eventId,
    required String action,
    int? guestCount,
    String? counterName,
  }) {
    final event = _events[eventId];
    if (event == null) {
      throw ArgumentError('Banquet event not found');
    }

    final bulkJob = _bulkJobs.values.cast<Map<String, dynamic>?>().firstWhere(
          (job) => job?['eventId'] == eventId,
          orElse: () => null,
        );
    final eventName = event['eventName'] as String;

    switch (action) {
      case 'start_bulk_prep':
        event['status'] = 'preparing';
        bulkJob?['status'] = 'preparing';
        bulkJob?['timerSeconds'] = 900;
        return {
          'success': true,
          'message': 'Bulk prep started · $eventName',
        };
      case 'coordinate_buffet':
        event['status'] = 'buffet_live';
        for (final station in _buffetStations) {
          if (station['linkedEventId'] == eventId) {
            station['status'] = 'serving';
            station['servingPercent'] = 35;
          }
        }
        return {
          'success': true,
          'message': 'Buffet coordinated · $eventName',
        };
      case 'schedule_meal':
        event['status'] = 'scheduled';
        return {
          'success': true,
          'message': 'Meal scheduled · $eventName',
        };
      case 'adjust_guest_count':
        final count = guestCount ?? (event['guestCount'] as int);
        event['guestCount'] = count;
        final plan = _guestPlans.cast<Map<String, dynamic>?>().firstWhere(
              (item) => item?['eventId'] == eventId,
              orElse: () => null,
            );
        if (plan != null) {
          plan['confirmedGuests'] = count;
          plan['preparedServings'] = count + (plan['bufferGuests'] as int);
          plan['status'] = 'updated';
        }
        bulkJob?['guestCount'] = count;
        return {
          'success': true,
          'message': 'Guest count updated · $count guests',
        };
      case 'assign_counter':
        final counter = counterName ?? 'Main buffet counter';
        final slot = _counters.cast<Map<String, dynamic>?>().firstWhere(
              (item) => item?['linkedEventId'] == eventId,
              orElse: () => null,
            );
        if (slot != null) {
          slot['counterName'] = counter;
          slot['status'] = 'active';
          slot['assignedChef'] = event['leadChef'];
        }
        return {
          'success': true,
          'message': 'Counter assigned · $counter',
        };
      case 'complete_event':
        event['status'] = 'completed';
        bulkJob?['status'] = 'completed';
        bulkJob?['timerSeconds'] = 0;
        _completedToday++;
        return {
          'success': true,
          'message': 'Event completed · $eventName',
        };
      case 'hold_event':
        event['status'] = 'on_hold';
        bulkJob?['status'] = 'on_hold';
        return {
          'success': true,
          'message': 'Event held · $eventName',
        };
      default:
        throw ArgumentError('Unknown banquet action: $action');
    }
  }

  static Map<String, dynamic> startSchedule({String? eventName}) {
    final name = eventName ?? 'New banquet service';
    final id = 'EVT-BNQ-${DateTime.now().millisecondsSinceEpoch}';
    _events[id] = {
      'id': id,
      'eventName': name,
      'location': 'Banquet Hall C',
      'section': 'Indian',
      'startTime': '19:30',
      'mealType': 'Dinner',
      'guestCount': 60,
      'status': 'scheduled',
      'leadChef': 'Banquet Team',
    };
    _bulkJobs['BLK-$id'] = {
      'id': 'BLK-$id',
      'eventId': id,
      'eventName': name,
      'section': 'Indian',
      'location': 'Banquet Hall C',
      'menuItems': ['Paneer tikka', 'Dal makhani', 'Jeera rice'],
      'guestCount': 60,
      'status': 'queued',
      'timerSeconds': 0,
    };
    _guestPlans.add({
      'id': 'GST-$id',
      'eventId': id,
      'eventName': name,
      'section': 'Indian',
      'confirmedGuests': 60,
      'bufferGuests': 6,
      'preparedServings': 66,
      'status': 'planning',
    });
    return {
      'success': true,
      'message': 'Event scheduled · $name',
    };
  }

  static void _syncFromOrderStore() {
    for (final order in MockOrderStore.activeOrders('All')) {
      final deliveryType = order['deliveryType'] as String? ?? '';
      if (deliveryType != 'Banquet' && deliveryType != 'Event') {
        continue;
      }

      final orderId = order['id'] as String;
      final eventId = 'EVT-$orderId';
      if (_events.containsKey(eventId)) {
        final existing = _bulkJobs['BLK-$orderId'];
        if (existing != null && existing['status'] == 'preparing') {
          existing['timerSeconds'] = order['timerSeconds'];
        }
        continue;
      }

      final built = _buildFromOrder(order, eventId);
      _events[eventId] = built.event;
      _bulkJobs['BLK-$orderId'] = built.bulkJob;
    }
  }

  static ({Map<String, dynamic> event, Map<String, dynamic> bulkJob})
      _buildFromOrder(
    Map<String, dynamic> order,
    String eventId,
  ) {
    final items = (order['items'] as List<dynamic>)
        .map((item) => item.toString())
        .toList();
    final guestCount = _extractGuestCount(items);

    return (
      event: {
        'id': eventId,
        'eventName': '${order['location']} service',
        'location': order['location'],
        'section': order['section'],
        'startTime': '18:00',
        'mealType': 'Banquet',
        'guestCount': guestCount,
        'status': 'queued',
        'leadChef': order['assignedChef'],
      },
      bulkJob: {
        'id': 'BLK-${order['id']}',
        'eventId': eventId,
        'eventName': '${order['location']} service',
        'section': order['section'],
        'location': order['location'],
        'menuItems': items,
        'guestCount': guestCount,
        'status': 'queued',
        'timerSeconds': order['timerSeconds'] as int,
      },
    );
  }

  static int _extractGuestCount(List<String> items) {
    for (final item in items) {
      final match = RegExp(r'(\d+)x').firstMatch(item);
      if (match != null) {
        return int.parse(match.group(1)!);
      }
    }
    return 40;
  }

  static String _formatTimer(int seconds) {
    final minutes = seconds ~/ 60;
    final remainder = seconds % 60;
    return '${minutes.toString().padLeft(2, '0')}:${remainder.toString().padLeft(2, '0')}';
  }

  static Map<String, dynamic> _serializeBulkJob(Map<String, dynamic> job) {
    return {
      'id': job['id'],
      'eventId': job['eventId'],
      'eventName': job['eventName'],
      'section': job['section'],
      'location': job['location'],
      'menuItems': job['menuItems'],
      'guestCount': job['guestCount'],
      'status': job['status'],
      'timerSeconds': job['timerSeconds'],
      'timerLabel': _formatTimer(job['timerSeconds'] as int),
      'availableActions': _availableBulkActions(job),
    };
  }

  static Map<String, dynamic> _serializeEvent(Map<String, dynamic> event) {
    return {
      'id': event['id'],
      'eventName': event['eventName'],
      'location': event['location'],
      'startTime': event['startTime'],
      'mealType': event['mealType'],
      'guestCount': event['guestCount'],
      'status': event['status'],
      'availableActions': _availableEventActions(event),
    };
  }

  static List<String> _availableBulkActions(Map<String, dynamic> job) {
    if (job['status'] == 'completed') {
      return const [];
    }
    final actions = <String>['start_bulk_prep', 'coordinate_buffet'];
    if (job['status'] == 'preparing' || job['status'] == 'buffet_live') {
      actions.add('complete_event');
    }
    actions.add('hold_event');
    return actions;
  }

  static List<String> _availableEventActions(Map<String, dynamic> event) {
    if (event['status'] == 'completed') {
      return const [];
    }
    return [
      'schedule_meal',
      'adjust_guest_count',
      'assign_counter',
      'start_bulk_prep',
      'coordinate_buffet',
      'complete_event',
      'hold_event',
    ];
  }

  static Map<String, Map<String, dynamic>> _seedEvents() {
    return {
      'EVT-BNQ-001': {
        'id': 'EVT-BNQ-001',
        'eventName': 'Wedding reception dinner',
        'location': 'Banquet Hall A',
        'section': 'Indian',
        'startTime': '19:00',
        'mealType': 'Dinner',
        'guestCount': 200,
        'status': 'preparing',
        'leadChef': 'Head Chef Raj',
      },
      'EVT-BNQ-002': {
        'id': 'EVT-BNQ-002',
        'eventName': 'Corporate lunch buffet',
        'location': 'Banquet B',
        'section': 'Continental',
        'startTime': '13:00',
        'mealType': 'Lunch',
        'guestCount': 80,
        'status': 'scheduled',
        'leadChef': 'Sous Chef Meera',
      },
      'EVT-BNQ-003': {
        'id': 'EVT-BNQ-003',
        'eventName': 'Birthday celebration',
        'location': 'Lawn Pavilion',
        'section': 'Dessert',
        'startTime': '17:30',
        'mealType': 'High tea',
        'guestCount': 45,
        'status': 'buffet_live',
        'leadChef': 'Dessert Team',
      },
    };
  }

  static Map<String, Map<String, dynamic>> _seedBulkJobs() {
    return {
      'BLK-001': {
        'id': 'BLK-001',
        'eventId': 'EVT-BNQ-001',
        'eventName': 'Wedding reception dinner',
        'section': 'Indian',
        'location': 'Banquet Hall A',
        'menuItems': ['200x Paneer tikka', '200x Dal makhani', '200x Naan'],
        'guestCount': 200,
        'status': 'preparing',
        'timerSeconds': 840,
      },
      'BLK-002': {
        'id': 'BLK-002',
        'eventId': 'EVT-BNQ-002',
        'eventName': 'Corporate lunch buffet',
        'section': 'Continental',
        'location': 'Banquet B',
        'menuItems': ['80x Pasta primavera', '80x Caesar salad'],
        'guestCount': 80,
        'status': 'queued',
        'timerSeconds': 0,
      },
      'BLK-003': {
        'id': 'BLK-003',
        'eventId': 'EVT-BNQ-003',
        'eventName': 'Birthday celebration',
        'section': 'Dessert',
        'location': 'Lawn Pavilion',
        'menuItems': ['45x Cupcakes', '45x Pastries'],
        'guestCount': 45,
        'status': 'buffet_live',
        'timerSeconds': 210,
      },
    };
  }

  static List<Map<String, dynamic>> _seedBuffetStations() {
    return [
      {
        'id': 'BF-001',
        'stationName': 'Main buffet counter',
        'location': 'Banquet Hall A',
        'section': 'Indian',
        'courses': ['Starters', 'Main course', 'Bread station'],
        'status': 'prepping',
        'servingPercent': 0,
        'linkedEventId': 'EVT-BNQ-001',
      },
      {
        'id': 'BF-002',
        'stationName': 'Live counter',
        'location': 'Banquet Hall A',
        'section': 'Indian',
        'courses': ['Tandoor live', 'Chaat live'],
        'status': 'standby',
        'servingPercent': 0,
        'linkedEventId': 'EVT-BNQ-001',
      },
      {
        'id': 'BF-003',
        'stationName': 'Dessert pavilion',
        'location': 'Lawn Pavilion',
        'section': 'Dessert',
        'courses': ['Cupcakes', 'Pastries', 'Ice cream'],
        'status': 'serving',
        'servingPercent': 62,
        'linkedEventId': 'EVT-BNQ-003',
      },
    ];
  }

  static List<Map<String, dynamic>> _seedGuestPlans() {
    return [
      {
        'id': 'GST-001',
        'eventId': 'EVT-BNQ-001',
        'eventName': 'Wedding reception dinner',
        'section': 'Indian',
        'confirmedGuests': 200,
        'bufferGuests': 20,
        'preparedServings': 220,
        'status': 'in_progress',
      },
      {
        'id': 'GST-002',
        'eventId': 'EVT-BNQ-002',
        'eventName': 'Corporate lunch buffet',
        'section': 'Continental',
        'confirmedGuests': 80,
        'bufferGuests': 8,
        'preparedServings': 88,
        'status': 'planning',
      },
    ];
  }

  static List<Map<String, dynamic>> _seedCounters() {
    return [
      {
        'id': 'CTR-001',
        'counterName': 'Main buffet counter',
        'assignedChef': 'Head Chef Raj',
        'linkedEvent': 'Wedding reception dinner',
        'linkedEventId': 'EVT-BNQ-001',
        'section': 'Indian',
        'queueDepth': 4,
        'status': 'active',
      },
      {
        'id': 'CTR-002',
        'counterName': 'Live tandoor counter',
        'assignedChef': 'Tandoor Team',
        'linkedEvent': 'Wedding reception dinner',
        'linkedEventId': 'EVT-BNQ-001',
        'section': 'Tandoor',
        'queueDepth': 2,
        'status': 'active',
      },
      {
        'id': 'CTR-003',
        'counterName': 'Dessert pavilion',
        'assignedChef': 'Dessert Team',
        'linkedEvent': 'Birthday celebration',
        'linkedEventId': 'EVT-BNQ-003',
        'section': 'Dessert',
        'queueDepth': 1,
        'status': 'serving',
      },
    ];
  }

  static int get completedToday => _completedToday;
}

class MockBanquetEngine {
  const MockBanquetEngine._();

  static Map<String, dynamic> buildSnapshot({String section = 'All'}) {
    final bulkPrepJobs = MockBanquetRegistry.bulkJobsFor(section);
    final buffetStations = MockBanquetRegistry.buffetStationsFor(section);
    final eventSchedules = MockBanquetRegistry.eventSchedulesFor(section);
    final guestCountPlans = MockBanquetRegistry.guestPlansFor(section);
    final counterCoordination = MockBanquetRegistry.countersFor(section);

    return {
      'section': section,
      'lastSyncedAt': DateTime.now().toIso8601String(),
      'bulkPrepJobs': bulkPrepJobs,
      'buffetStations': buffetStations,
      'eventSchedules': eventSchedules,
      'guestCountPlans': guestCountPlans,
      'counterCoordination': counterCoordination,
      'stats': {
        'activeEvents': eventSchedules.length,
        'bulkPrepJobs': bulkPrepJobs.length,
        'buffetLive': buffetStations
            .where((station) => station['status'] == 'serving')
            .length,
        'scheduledMeals': eventSchedules
            .where((event) => event['status'] == 'scheduled')
            .length,
        'totalGuests': guestCountPlans.fold<int>(
          0,
          (sum, plan) => sum + (plan['confirmedGuests'] as int),
        ),
        'completedToday': MockBanquetRegistry.completedToday,
      },
      'banquetFeatures': {
        'bulkMealPreparation': bulkPrepJobs.isNotEmpty,
        'buffetCoordination': buffetStations.isNotEmpty,
        'eventMealScheduling': eventSchedules.isNotEmpty,
        'guestCountPreparation': guestCountPlans.isNotEmpty,
        'multiCounterCoordination': counterCoordination.isNotEmpty,
      },
      'sections': MockSectionRegistry.filterSections,
    };
  }
}
