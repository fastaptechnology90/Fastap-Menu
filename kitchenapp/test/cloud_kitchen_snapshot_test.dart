import 'package:flutter_test/flutter_test.dart';

import 'package:kitchenapp/models/cloud_kitchen/cloud_kitchen_snapshot.dart';

void main() {
  test('cloud kitchen snapshot parses API payload', () {
    final snapshot = CloudKitchenSnapshot.fromJson({
      'section': 'All',
      'lastSyncedAt': '2026-06-06T12:00:00.000',
      'sections': ['All', 'Tandoor'],
      'brandLanes': [
        {
          'id': 'BRD-FASTAP',
          'brandName': 'Fastap Kitchen',
          'cuisine': 'North Indian',
          'activeOrders': 5,
          'loadPercent': 72,
          'status': 'active',
          'colorTag': 'primary',
        },
      ],
      'brandOrders': [
        {
          'id': 'CK-ORD-1901',
          'orderId': 'ORD-1901',
          'kotNumber': 'KOT #1901',
          'brandName': 'Fastap Kitchen',
          'brandId': 'BRD-FASTAP',
          'section': 'Tandoor',
          'channel': 'Swiggy',
          'itemSummary': 'Butter chicken · Garlic naan',
          'deliveryType': 'Delivery',
          'status': 'preparing',
          'timerSeconds': 540,
          'timerLabel': '09:00',
          'availableActions': ['complete_order', 'hold_order'],
        },
      ],
      'deliveryQueue': [
        {
          'id': 'DLV-ORD-1901',
          'orderId': 'ORD-1901',
          'kotNumber': 'KOT #1901',
          'brandName': 'Fastap Kitchen',
          'platform': 'Swiggy',
          'riderEtaMinutes': 8,
          'status': 'preparing',
          'priority': 'normal',
        },
      ],
      'loadBalance': [
        {
          'section': 'Tandoor',
          'brandName': 'Fastap Kitchen',
          'queueDepth': 5,
          'capacity': 8,
          'recommendation': 'stable',
        },
      ],
      'sharedInventory': [
        {
          'id': 'INV-CK-001',
          'itemName': 'Basmati rice',
          'quantity': 12,
          'unit': 'kg',
          'sharedByBrands': ['Fastap Kitchen', 'Biryani House'],
          'stockLevel': 'ok',
        },
      ],
      'stats': {
        'activeBrands': 1,
        'totalOrders': 1,
        'deliveryPending': 1,
        'overloadedLanes': 0,
        'sharedItems': 1,
        'completedToday': 14,
      },
      'cloudKitchenFeatures': {
        'multiBrandOrderManagement': true,
        'brandWiseSegregation': true,
        'deliveryOrderHandling': true,
        'kitchenLoadBalancing': true,
        'sharedInventoryVisibility': true,
      },
    });

    expect(snapshot.brandLanes.length, 1);
    expect(snapshot.brandOrders.first.brandName, 'Fastap Kitchen');
    expect(snapshot.cloudKitchenFeatures.kitchenLoadBalancing, isTrue);
    expect(snapshot.stats.completedToday, 14);
  });
}
