import 'mock_order_store.dart';

import 'mock_section_registry.dart';



class MockBakeryDessertRegistry {

  MockBakeryDessertRegistry._();



  static final Map<String, Map<String, dynamic>> _jobs = _seedJobs();

  static final List<Map<String, dynamic>> _batches = _seedBatches();

  static final List<Map<String, dynamic>> _eventPlans = _seedEventPlans();

  static int _completedToday = 9;



  static List<Map<String, dynamic>> jobsFor(String section) {

    _syncFromOrderStore();

    final items = section == 'All'

        ? _jobs.values

        : _jobs.values.where((job) => job['section'] == section);

    return items

        .where((job) => job['status'] != 'completed')

        .map(_serializeJob)

        .toList();

  }



  static List<Map<String, dynamic>> batchesFor(String section) {

    if (section == 'All') {

      return _batches.map(Map<String, dynamic>.from).toList();

    }

    return _batches

        .where((batch) => batch['section'] == section)

        .map(Map<String, dynamic>.from)

        .toList();

  }



  static List<Map<String, dynamic>> eventPlansFor(String section) {

    if (section == 'All') {

      return _eventPlans.map(Map<String, dynamic>.from).toList();

    }

    return _eventPlans

        .where((plan) => plan['section'] == section)

        .map(Map<String, dynamic>.from)

        .toList();

  }



  static Map<String, dynamic> performAction({

    required String jobId,

    required String action,

    String? customization,

  }) {

    final job = _jobs[jobId];

    if (job == null) {

      throw ArgumentError('Bakery job not found');

    }



    final order = MockOrderStore.findById(job['orderId'] as String);

    final kotNumber = job['kotNumber'] as String;



    switch (action) {

      case 'start_prep':

        job['status'] = 'preparing';

        job['timerSeconds'] = 420;

        order?['status'] = 'preparing';

        return {

          'success': true,

          'message': 'Dessert prep started · ${job['itemName']}',

        };

      case 'track_production':

        job['status'] = 'in_production';

        _batches.insert(0, {

          'id': 'BAT-${DateTime.now().millisecondsSinceEpoch}',

          'itemName': job['itemName'],

          'quantity': job['batchSize'],

          'status': 'baking',

          'expiryMinutes': 45,

          'section': job['section'],

        });

        return {

          'success': true,

          'message': 'Production tracked · ${job['itemName']}',

        };

      case 'apply_cake_customization':

        job['customization'] = customization ?? 'Custom cake design';

        job['jobType'] = 'cake';

        job['status'] = 'customizing';

        return {

          'success': true,

          'message': 'Cake customization applied · ${job['itemName']}',

        };

      case 'plan_event_batch':

        _eventPlans.insert(0, {

          'id': 'EVT-${DateTime.now().millisecondsSinceEpoch}',

          'eventName': job['location'],

          'location': job['location'],

          'section': job['section'],

          'items': [job['itemName']],

          'totalServings': job['batchSize'],

          'status': 'planned',

        });

        job['status'] = 'event_planned';

        return {

          'success': true,

          'message': 'Event dessert planned · ${job['location']}',

        };

      case 'complete_item':

        job['status'] = 'completed';

        job['timerSeconds'] = 0;

        order?['status'] = 'ready';

        order?['progress'] = 1.0;

        _completedToday++;

        return {

          'success': true,

          'message': 'Item completed · $kotNumber',

        };

      case 'hold_item':

        job['status'] = 'on_hold';

        return {

          'success': true,

          'message': 'Item held · $kotNumber',

        };

      default:

        throw ArgumentError('Unknown bakery action: $action');

    }

  }



  static Map<String, dynamic> startProduction({String? itemName}) {

    final name = itemName ?? 'Fresh croissant batch';

    _batches.insert(0, {

      'id': 'BAT-${DateTime.now().millisecondsSinceEpoch}',

      'itemName': name,

      'quantity': 24,

      'status': 'baking',

      'expiryMinutes': 60,

      'section': 'Bakery',

    });

    return {

      'success': true,

      'message': 'Production started · $name',

    };

  }



  static void _syncFromOrderStore() {

    for (final order in MockOrderStore.activeOrders('All')) {

      final section = order['section'] as String;

      if (section != 'Dessert' && section != 'Bakery') {

        continue;

      }



      final orderId = order['id'] as String;

      final jobId = 'DSR-$orderId';

      if (_jobs.containsKey(jobId)) {

        final existing = _jobs[jobId]!;

        if (existing['status'] == 'preparing') {

          existing['timerSeconds'] = order['timerSeconds'];

        }

        continue;

      }



      _jobs[jobId] = _buildJob(order);

    }

  }



  static Map<String, dynamic> _buildJob(Map<String, dynamic> order) {

    final items = order['items'] as List<dynamic>;

    final itemName = items.isEmpty ? 'Dessert item' : items.first.toString();

    final batchSize = _extractBatchSize(items);

    final isEvent = order['deliveryType'] == 'Banquet' ||

        order['deliveryType'] == 'Event';



    return {

      'id': 'DSR-${order['id']}',

      'orderId': order['id'],

      'kotNumber': order['kotNumber'],

      'section': order['section'],

      'location': order['location'],

      'itemName': itemName,

      'jobType': isEvent ? 'event' : (order['section'] == 'Bakery' ? 'bakery' : 'dessert'),

      'customization': 'Standard',

      'status': 'queued',

      'batchSize': batchSize,

      'timerSeconds': order['timerSeconds'] as int,

    };

  }



  static int _extractBatchSize(List<dynamic> items) {

    for (final item in items) {

      final text = item.toString();

      final match = RegExp(r'(\d+)x').firstMatch(text);

      if (match != null) {

        return int.parse(match.group(1)!);

      }

    }

    return 1;

  }



  static String _formatTimer(int seconds) {

    final minutes = seconds ~/ 60;

    final remainder = seconds % 60;

    return '${minutes.toString().padLeft(2, '0')}:${remainder.toString().padLeft(2, '0')}';

  }



  static Map<String, dynamic> _serializeJob(Map<String, dynamic> job) {

    return {

      'id': job['id'],

      'orderId': job['orderId'],

      'kotNumber': job['kotNumber'],

      'section': job['section'],

      'location': job['location'],

      'itemName': job['itemName'],

      'jobType': job['jobType'],

      'customization': job['customization'],

      'status': job['status'],

      'batchSize': job['batchSize'],

      'timerSeconds': job['timerSeconds'],

      'timerLabel': _formatTimer(job['timerSeconds'] as int),

      'availableActions': _availableActions(job),

    };

  }



  static List<String> _availableActions(Map<String, dynamic> job) {

    if (job['status'] == 'completed') {

      return const [];

    }



    final actions = <String>[

      'start_prep',

      'track_production',

      'apply_cake_customization',

    ];

    if (job['jobType'] == 'event' || (job['batchSize'] as int) >= 20) {

      actions.add('plan_event_batch');

    }

    if (job['status'] == 'preparing' ||

        job['status'] == 'in_production' ||

        job['status'] == 'customizing') {

      actions.add('complete_item');

    }

    actions.add('hold_item');

    return actions;

  }



  static Map<String, Map<String, dynamic>> _seedJobs() {

    return {

      'DSR-ORD-1845': {

        'id': 'DSR-ORD-1845',

        'orderId': 'ORD-1845',

        'kotNumber': 'KOT #1845',

        'section': 'Dessert',

        'location': 'Banquet A',

        'itemName': '40x Gulab jamun',

        'jobType': 'event',

        'customization': 'Silver service',

        'status': 'preparing',

        'batchSize': 40,

        'timerSeconds': 690,

      },

      'DSR-ORD-1850': {

        'id': 'DSR-ORD-1850',

        'orderId': 'ORD-1850',

        'kotNumber': 'KOT #1850',

        'section': 'Bakery',

        'location': 'Room 512',

        'itemName': '1x Croissant basket',

        'jobType': 'bakery',

        'customization': 'VIP warm service',

        'status': 'queued',

        'batchSize': 1,

        'timerSeconds': 0,

      },

      'DSR-ORD-DSR-001': {

        'id': 'DSR-ORD-DSR-001',

        'orderId': 'ORD-DSR-001',

        'kotNumber': 'KOT #DSR-001',

        'section': 'Dessert',

        'location': 'Table 15',

        'itemName': '1x Chocolate truffle cake',

        'jobType': 'cake',

        'customization': 'Happy birthday · gold leaf',

        'status': 'customizing',

        'batchSize': 1,

        'timerSeconds': 240,

      },

    };

  }



  static List<Map<String, dynamic>> _seedBatches() {

    return [

      {

        'id': 'BAT-001',

        'itemName': 'Gulab jamun batch',

        'quantity': 40,

        'status': 'baking',

        'expiryMinutes': 28,

        'section': 'Dessert',

      },

      {

        'id': 'BAT-002',

        'itemName': 'Croissant batch',

        'quantity': 12,

        'status': 'cooling',

        'expiryMinutes': 55,

        'section': 'Bakery',

      },

    ];

  }



  static List<Map<String, dynamic>> _seedEventPlans() {

    return [

      {

        'id': 'EVT-001',

        'eventName': 'Banquet A dessert service',

        'location': 'Banquet A',

        'section': 'Dessert',

        'items': ['40x Gulab jamun', '40x Ice cream scoop'],

        'totalServings': 80,

        'status': 'in_progress',

      },

    ];

  }



  static int get completedToday => _completedToday;

}



class MockBakeryDessertEngine {

  const MockBakeryDessertEngine._();



  static Map<String, dynamic> buildSnapshot({String section = 'All'}) {

    final dessertQueue = MockBakeryDessertRegistry.jobsFor(section);

    final productionBatches = MockBakeryDessertRegistry.batchesFor(section);

    final eventPlans = MockBakeryDessertRegistry.eventPlansFor(section);



    return {

      'section': section,

      'lastSyncedAt': DateTime.now().toIso8601String(),

      'dessertQueue': dessertQueue,

      'productionBatches': productionBatches,

      'eventPlans': eventPlans,

      'stats': {

        'queuedJobs':

            dessertQueue.where((job) => job['status'] == 'queued').length,

        'inProduction': dessertQueue

            .where(

              (job) =>

                  job['status'] == 'preparing' ||

                  job['status'] == 'in_production',

            )

            .length,

        'customCakes': dessertQueue

            .where((job) => job['jobType'] == 'cake')

            .length,

        'eventPlans': eventPlans.length,

        'completedToday': MockBakeryDessertRegistry.completedToday,

        'activeBatches': productionBatches.length,

      },

      'bakeryFeatures': {

        'dessertPreparationQueue': dessertQueue.isNotEmpty,

        'bakeryProductionTracking': productionBatches.isNotEmpty,

        'cakeCustomization': dessertQueue.any(

          (job) => job['jobType'] == 'cake' || job['customization'] != 'Standard',

        ),

        'eventDessertPlanning': eventPlans.isNotEmpty,

      },

      'sections': MockSectionRegistry.filterSections,

    };

  }

}

