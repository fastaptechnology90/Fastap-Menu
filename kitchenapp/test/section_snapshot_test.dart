import 'package:flutter_test/flutter_test.dart';

import 'package:kitchenapp/models/sections/section_overview_snapshot.dart';

void main() {
  test('section management snapshot parses API payload', () {
    final snapshot = SectionManagementSnapshot.fromJson({
      'overview': {
        'filterSection': 'All',
        'lastSyncedAt': '2026-06-06T12:00:00.000',
        'sections': [
          {
            'id': 'main',
            'name': 'Main',
            'label': 'Main kitchen',
            'headChef': 'Chef Arjun Mehta',
            'capacity': 12,
            'activeOrders': 4,
            'queueDepth': 4,
            'load': 0.33,
            'staffAssigned': 3,
            'delayedOrders': 0,
            'status': 'normal',
            'isOnline': true,
            'iconKey': 'main',
            'parallelPrep': true,
          },
        ],
        'stats': {
          'totalSections': 1,
          'onlineSections': 1,
          'busiestSection': 'Main',
          'avgLoad': 0.33,
        },
      },
      'routing': {
        'splitOrders': [
          {
            'orderId': 'ORD-1845',
            'kotNumber': 'KOT #1845',
            'primarySection': 'Dessert',
            'sections': ['Dessert', 'Bakery'],
            'reason': 'Multi-section splitting',
            'mode': 'parallel',
          },
        ],
        'recommendations': [
          {
            'id': 'REC-1',
            'title': 'Balance Tandoor load',
            'message': 'Move 2 orders to Main backup',
            'action': 'rebalance',
            'targetSection': 'Main',
            'severity': 'high',
          },
        ],
        'routingLog': [
          {
            'time': '2026-06-06T12:00:00.000',
            'message': 'Auto-routed ORD-1848 to Fry',
            'type': 'auto_route',
          },
        ],
        'smartRouting': {
          'autoSectionAssignment': true,
          'multiSectionSplitting': true,
          'parallelPreparation': true,
          'aiLoadBalancing': true,
          'smartChefAllocation': true,
          'queueOptimization': true,
        },
      },
    });

    expect(snapshot.overview.sections.first.label, 'Main kitchen');
    expect(snapshot.routing.splitOrders.first.sections.length, 2);
    expect(snapshot.routing.smartRouting.queueOptimization, isTrue);
  });
}
