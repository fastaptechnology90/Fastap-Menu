import 'package:flutter_test/flutter_test.dart';

import 'package:kitchenapp/models/aggregator/delivery_aggregator_snapshot.dart';

void main() {
  test('delivery aggregator snapshot parses API payload', () {
    final snapshot = DeliveryAggregatorSnapshot.fromJson({
      'section': 'All',
      'lastSyncedAt': '2026-06-06T12:00:00.000',
      'sections': ['All', 'Chinese'],
      'orders': [
        {
          'id': 'AGG-ORD-1844',
          'orderId': 'ORD-1844',
          'kotNumber': 'KOT #1844',
          'platform': 'Zomato',
          'section': 'Chinese',
          'location': 'Zomato',
          'itemsSummary': '2x Hakka noodles',
          'syncStatus': 'synced',
          'pickupCountdownSeconds': 165,
          'countdownLabel': '02:45',
          'prepTimerSeconds': 965,
          'prepTimerLabel': '16:05',
          'dispatchStatus': 'preparing',
          'riderWaiting': true,
          'availableActions': ['sync_order', 'acknowledge_rider', 'ready_for_pickup'],
        },
      ],
      'riderAlerts': [
        {
          'id': 'RDR-001',
          'orderId': 'ORD-1844',
          'kotNumber': 'KOT #1844',
          'platform': 'Zomato',
          'message': 'Rider waiting',
          'severity': 'high',
          'triggeredAt': '2026-06-06T11:56:00.000',
        },
      ],
      'dispatchTracking': [
        {
          'orderId': 'ORD-1840',
          'kotNumber': 'KOT #1840',
          'platform': 'Zomato',
          'status': 'dispatched',
          'updatedAt': '2026-06-06T11:00:00.000',
        },
      ],
      'stats': {
        'activeOrders': 1,
        'swiggyOrders': 0,
        'zomatoOrders': 1,
        'ondcOrders': 0,
        'riderAlerts': 1,
        'awaitingPickup': 0,
        'dispatchedToday': 6,
      },
      'aggregatorFeatures': {
        'aggregatorOrderSync': true,
        'pickupCountdown': true,
        'riderWaitingAlerts': true,
        'dispatchTracking': true,
        'deliveryPrepTimers': true,
        'swiggy': false,
        'zomato': true,
        'ondc': false,
      },
    });

    expect(snapshot.orders.length, 1);
    expect(snapshot.orders.first.platform, 'Zomato');
    expect(snapshot.aggregatorFeatures.riderWaitingAlerts, isTrue);
    expect(snapshot.stats.dispatchedToday, 6);
  });
}
