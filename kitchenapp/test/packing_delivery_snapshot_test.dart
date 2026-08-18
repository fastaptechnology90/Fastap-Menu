import 'package:flutter_test/flutter_test.dart';

import 'package:kitchenapp/models/packing/packing_delivery_snapshot.dart';

void main() {
  test('packing delivery snapshot parses API payload', () {
    final snapshot = PackingDeliverySnapshot.fromJson({
      'section': 'All',
      'lastSyncedAt': '2026-06-06T12:00:00.000',
      'sections': ['All', 'Beverage'],
      'packingJobs': [
        {
          'id': 'PKG-ORD-1846',
          'orderId': 'ORD-1846',
          'kotNumber': 'KOT #1846',
          'section': 'Beverage',
          'location': 'Takeaway',
          'deliveryType': 'Takeaway',
          'packingType': 'takeaway',
          'customerName': 'Takeaway',
          'itemsSummary': '2x Cold coffee',
          'status': 'queued',
          'spillProofChecked': false,
          'labelsPrinted': false,
          'label': {
            'customerName': 'Takeaway',
            'orderId': 'ORD-2026-1846',
            'deliveryType': 'Takeaway',
            'allergyNotes': 'None',
            'specialInstructions': 'Pack separately',
          },
          'availableActions': ['start_packing', 'takeaway_pack', 'spill_proof_check'],
        },
      ],
      'stats': {
        'queuedJobs': 1,
        'inProgress': 0,
        'completedToday': 4,
        'deliveryPacks': 0,
        'roomServicePacks': 0,
        'takeawayPacks': 1,
        'eventPacks': 0,
        'spillProofChecks': 0,
      },
      'packingFeatures': {
        'deliveryPacking': false,
        'roomServicePacking': false,
        'takeawayPacking': true,
        'eventPacking': false,
        'spillProofChecks': false,
        'packingLabels': true,
      },
    });

    expect(snapshot.packingJobs.length, 1);
    expect(snapshot.packingJobs.first.packingType, 'takeaway');
    expect(snapshot.packingFeatures.packingLabels, isTrue);
    expect(snapshot.stats.completedToday, 4);
  });
}
