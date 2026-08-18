import 'mock_order_store.dart';

import 'mock_section_registry.dart';



class MockPackingRegistry {

  MockPackingRegistry._();



  static final Map<String, Map<String, dynamic>> _jobs = _seedJobs();

  static int _completedToday = 4;



  static List<Map<String, dynamic>> jobsFor(String section) {

    _syncJobsFromOrders();

    final items = section == 'All'

        ? _jobs.values

        : _jobs.values.where((job) => job['section'] == section);

    return items

        .where((job) => job['status'] != 'completed')

        .map(_serializeJob)

        .toList();

  }



  static Map<String, dynamic> performAction({

    required String jobId,

    required String action,

  }) {

    final job = _jobs[jobId];

    if (job == null) {

      throw ArgumentError('Packing job not found');

    }



    final kotNumber = job['kotNumber'] as String;



    switch (action) {

      case 'start_packing':

        job['status'] = 'in_progress';

        return {

          'success': true,

          'message': 'Packing started · $kotNumber',

        };

      case 'delivery_pack':

        job['packingType'] = 'delivery';

        job['status'] = 'in_progress';

        return {

          'success': true,

          'message': 'Delivery packing · $kotNumber',

        };

      case 'room_service_pack':

        job['packingType'] = 'room_service';

        job['status'] = 'in_progress';

        return {

          'success': true,

          'message': 'Room service packing · $kotNumber',

        };

      case 'takeaway_pack':

        job['packingType'] = 'takeaway';

        job['status'] = 'in_progress';

        return {

          'success': true,

          'message': 'Takeaway packing · $kotNumber',

        };

      case 'event_pack':

        job['packingType'] = 'event';

        job['status'] = 'in_progress';

        return {

          'success': true,

          'message': 'Event packing · $kotNumber',

        };

      case 'spill_proof_check':

        job['spillProofChecked'] = true;

        return {

          'success': true,

          'message': 'Spill-proof check passed · $kotNumber',

        };

      case 'print_labels':

        job['labelsPrinted'] = true;

        return {

          'success': true,

          'message': 'Labels printed · $kotNumber',

        };

      case 'complete_packing':

        if (job['spillProofChecked'] != true &&

            _requiresSpillProof(job['packingType'] as String)) {

          throw ArgumentError('Complete spill-proof check first');

        }

        job['status'] = 'completed';

        _completedToday++;

        return {

          'success': true,

          'message': 'Packing complete · $kotNumber ready for dispatch',

        };

      case 'hold_packing':

        job['status'] = 'on_hold';

        return {

          'success': true,

          'message': 'Packing held · $kotNumber',

        };

      default:

        throw ArgumentError('Unknown packing action: $action');

    }

  }



  static Map<String, dynamic> printAllLabels({String? jobId}) {

    if (jobId != null) {

      final job = _jobs[jobId];

      if (job == null) {

        throw ArgumentError('Packing job not found');

      }

      job['labelsPrinted'] = true;

      return {

        'success': true,

        'message': 'Labels printed · ${job['kotNumber']}',

      };

    }



    var count = 0;

    for (final job in _jobs.values) {

      if (job['status'] != 'completed') {

        job['labelsPrinted'] = true;

        count++;

      }

    }



    return {

      'success': true,

      'message': count == 0

          ? 'No labels queued for print'

          : 'Batch labels printed · $count jobs',

    };

  }



  static void _syncJobsFromOrders() {

    for (final order in MockOrderStore.activeOrders('All')) {

      if (order['status'] != 'ready') {

        continue;

      }

      final packingType = _packingTypeFor(order['deliveryType'] as String);

      if (packingType == null) {

        continue;

      }



      final jobId = 'PKG-${order['id']}';

      if (_jobs.containsKey(jobId)) {

        continue;

      }



      _jobs[jobId] = _buildJob(order, packingType);

    }

  }



  static Map<String, dynamic> _buildJob(

    Map<String, dynamic> order,

    String packingType,

  ) {

    final items = order['items'] as List<dynamic>;

    return {

      'id': 'PKG-${order['id']}',

      'orderId': order['id'],

      'kotNumber': order['kotNumber'],

      'section': order['section'],

      'location': order['location'],

      'deliveryType': order['deliveryType'],

      'packingType': packingType,

      'customerName': _customerName(order),

      'itemsSummary': items.isEmpty ? 'Kitchen order' : items.join(', '),

      'status': 'queued',

      'spillProofChecked': false,

      'labelsPrinted': false,

      'label': _buildLabel(order),

    };

  }



  static Map<String, dynamic> _buildLabel(Map<String, dynamic> order) {

    final allergy = order['allergy'] == true ? 'Allergy protocol active' : 'None';

    final notes = (order['cookingNotes'] as List<dynamic>? ?? const [])

        .map((item) => item.toString())

        .join(' · ');



    return {

      'customerName': _customerName(order),

      'orderId': order['orderId'] ?? order['id'],

      'deliveryType': order['deliveryType'],

      'allergyNotes': allergy,

      'specialInstructions': notes.isEmpty ? 'Standard packing' : notes,

    };

  }



  static String _customerName(Map<String, dynamic> order) {

    if (order['roomNumber'] != null) {

      return 'Room ${order['roomNumber']}';

    }

    if (order['tableNumber'] != null) {

      return 'Table ${order['tableNumber']}';

    }

    return order['location'] as String;

  }



  static String? _packingTypeFor(String deliveryType) {

    return switch (deliveryType) {

      'Zomato' || 'Swiggy' || 'Delivery' => 'delivery',

      'Room service' => 'room_service',

      'Takeaway' => 'takeaway',

      'Banquet' || 'Event' => 'event',

      _ => null,

    };

  }



  static bool _requiresSpillProof(String packingType) {

    return {'delivery', 'takeaway', 'room_service'}.contains(packingType);

  }



  static Map<String, dynamic> _serializeJob(Map<String, dynamic> job) {

    return {

      'id': job['id'],

      'orderId': job['orderId'],

      'kotNumber': job['kotNumber'],

      'section': job['section'],

      'location': job['location'],

      'deliveryType': job['deliveryType'],

      'packingType': job['packingType'],

      'customerName': job['customerName'],

      'itemsSummary': job['itemsSummary'],

      'status': job['status'],

      'spillProofChecked': job['spillProofChecked'] == true,

      'labelsPrinted': job['labelsPrinted'] == true,

      'label': Map<String, dynamic>.from(job['label'] as Map<String, dynamic>),

      'availableActions': _availableActions(job),

    };

  }



  static List<String> _availableActions(Map<String, dynamic> job) {

    if (job['status'] == 'completed') {

      return const [];

    }



    final packingType = job['packingType'] as String;

    final actions = <String>[

      'start_packing',

      switch (packingType) {

        'delivery' => 'delivery_pack',

        'room_service' => 'room_service_pack',

        'takeaway' => 'takeaway_pack',

        'event' => 'event_pack',

        _ => 'delivery_pack',

      },

      'spill_proof_check',

      'print_labels',

      'hold_packing',

    ];



    if (job['status'] == 'in_progress' || job['spillProofChecked'] == true) {

      actions.add('complete_packing');

    }



    return actions;

  }



  static Map<String, Map<String, dynamic>> _seedJobs() {

    return {

      'PKG-ORD-1846': {

        'id': 'PKG-ORD-1846',

        'orderId': 'ORD-1846',

        'kotNumber': 'KOT #1846',

        'section': 'Beverage',

        'location': 'Takeaway',

        'deliveryType': 'Takeaway',

        'packingType': 'takeaway',

        'customerName': 'Takeaway',

        'itemsSummary': '2x Cold coffee, 1x Mango lassi',

        'status': 'queued',

        'spillProofChecked': false,

        'labelsPrinted': false,

        'label': {

          'customerName': 'Takeaway',

          'orderId': 'ORD-2026-1846',

          'deliveryType': 'Takeaway',

          'allergyNotes': 'None',

          'specialInstructions': 'Pack separately · Spill-proof lid',

        },

      },

      'PKG-ORD-1844': {

        'id': 'PKG-ORD-1844',

        'orderId': 'ORD-1844',

        'kotNumber': 'KOT #1844',

        'section': 'Chinese',

        'location': 'Zomato',

        'deliveryType': 'Zomato',

        'packingType': 'delivery',

        'customerName': 'Zomato',

        'itemsSummary': '2x Hakka noodles, 1x Manchurian gravy',

        'status': 'in_progress',

        'spillProofChecked': true,

        'labelsPrinted': false,

        'label': {

          'customerName': 'Zomato',

          'orderId': 'ORD-2026-1844',

          'deliveryType': 'Zomato',

          'allergyNotes': 'None',

          'specialInstructions': 'Rider waiting · Extra spicy',

        },

      },

      'PKG-ORD-1845': {

        'id': 'PKG-ORD-1845',

        'orderId': 'ORD-1845',

        'kotNumber': 'KOT #1845',

        'section': 'Dessert',

        'location': 'Banquet A',

        'deliveryType': 'Banquet',

        'packingType': 'event',

        'customerName': 'Banquet A',

        'itemsSummary': '40x Gulab jamun, 40x Ice cream scoop',

        'status': 'queued',

        'spillProofChecked': false,

        'labelsPrinted': true,

        'label': {

          'customerName': 'Banquet A',

          'orderId': 'ORD-2026-1845',

          'deliveryType': 'Banquet',

          'allergyNotes': 'None',

          'specialInstructions': 'Batch service · Silver service',

        },

      },

      'PKG-ORD-1850': {

        'id': 'PKG-ORD-1850',

        'orderId': 'ORD-1850',

        'kotNumber': 'KOT #1850',

        'section': 'Bakery',

        'location': 'Room 512',

        'deliveryType': 'Room service',

        'packingType': 'room_service',

        'customerName': 'Room 512',

        'itemsSummary': '1x Croissant basket',

        'status': 'in_progress',

        'spillProofChecked': false,

        'labelsPrinted': false,

        'label': {

          'customerName': 'Room 512',

          'orderId': 'ORD-2026-1850',

          'deliveryType': 'Room service',

          'allergyNotes': 'None',

          'specialInstructions': 'VIP tray · Warm service',

        },

      },

    };

  }



  static int get completedToday => _completedToday;

}



class MockPackingEngine {

  const MockPackingEngine._();



  static Map<String, dynamic> buildSnapshot({String section = 'All'}) {

    final packingJobs = MockPackingRegistry.jobsFor(section);



    return {

      'section': section,

      'lastSyncedAt': DateTime.now().toIso8601String(),

      'packingJobs': packingJobs,

      'stats': {

        'queuedJobs':

            packingJobs.where((job) => job['status'] == 'queued').length,

        'inProgress':

            packingJobs.where((job) => job['status'] == 'in_progress').length,

        'completedToday': MockPackingRegistry.completedToday,

        'deliveryPacks':

            packingJobs.where((job) => job['packingType'] == 'delivery').length,

        'roomServicePacks': packingJobs

            .where((job) => job['packingType'] == 'room_service')

            .length,

        'takeawayPacks':

            packingJobs.where((job) => job['packingType'] == 'takeaway').length,

        'eventPacks':

            packingJobs.where((job) => job['packingType'] == 'event').length,

        'spillProofChecks':

            packingJobs.where((job) => job['spillProofChecked'] == true).length,

      },

      'packingFeatures': {

        'deliveryPacking': packingJobs.any(

          (job) => job['packingType'] == 'delivery',

        ),

        'roomServicePacking': packingJobs.any(

          (job) => job['packingType'] == 'room_service',

        ),

        'takeawayPacking': packingJobs.any(

          (job) => job['packingType'] == 'takeaway',

        ),

        'eventPacking':

            packingJobs.any((job) => job['packingType'] == 'event'),

        'spillProofChecks': packingJobs.any(

          (job) => job['spillProofChecked'] == true,

        ),

        'packingLabels': packingJobs.isNotEmpty,

      },

      'sections': MockSectionRegistry.filterSections,

    };

  }

}

