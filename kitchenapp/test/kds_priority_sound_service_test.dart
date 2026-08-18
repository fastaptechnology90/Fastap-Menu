import 'package:flutter_test/flutter_test.dart';

import 'package:kitchenapp/models/kds/kds_order.dart';
import 'package:kitchenapp/models/kds/kds_snapshot.dart';
import 'package:kitchenapp/models/kds/kds_view_mode.dart';
import 'package:kitchenapp/services/kds_priority_sound_service.dart';

void main() {
  test('priority sound service alerts once per priority order', () {
    var alertCount = 0;
    final service = KdsPrioritySoundService(playAlert: () => alertCount++);

    final snapshot = KdsSnapshot(
      section: 'Main',
      view: KdsViewMode.queue.name,
      filter: KdsFilter.all.name,
      lastSyncedAt: DateTime.now(),
      orders: [
        KdsOrder(
          id: 'ORD-1',
          orderId: 'ORD-1',
          kotNumber: 'KOT #1',
          section: 'Main',
          category: 'Main',
          assignedChef: 'Chef',
          guestType: 'VIP',
          deliveryType: 'Dine-in',
          items: const ['Soup'],
          addOns: const [],
          modifiers: const [],
          cookingNotes: const [],
          status: KdsStatus.preparing,
          priority: 'vip',
          timerSeconds: 120,
          progress: 0.5,
          sortOrder: 0,
          vip: true,
          allergy: false,
          reFireRequested: false,
        ),
      ],
      groups: const [],
      stats: const KdsStats(total: 1, delayed: 0, vip: 1, priority: 1),
      isGrouped: false,
    );

    service.evaluate(snapshot);
    service.evaluate(snapshot);

    expect(alertCount, 1);
  });
}
