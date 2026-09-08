import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kitchenapp/models/kds/kds_order.dart';
import 'package:kitchenapp/models/kds/kds_snapshot.dart';
import 'package:kitchenapp/models/kds/kds_view_mode.dart';
import 'package:kitchenapp/services/kitchen_alarm_service.dart';

class _RecordingTone implements KitchenAlarmTone {
  int bursts = 0;
  int lastPulses = 0;

  @override
  Future<void> play({required int pulses, required bool haptics}) async {
    bursts++;
    lastPulses = pulses;
  }
}

KdsOrder _order(String id, {KdsStatus status = KdsStatus.newOrder}) {
  return KdsOrder(
    id: id,
    orderId: id,
    kotNumber: 'KOT $id',
    section: 'Main',
    category: 'Main',
    assignedChef: 'Chef',
    guestType: 'Regular',
    deliveryType: 'Dine-in',
    items: const ['Soup'],
    addOns: const [],
    modifiers: const [],
    cookingNotes: const [],
    status: status,
    priority: 'normal',
    timerSeconds: 30,
    progress: 0.1,
    sortOrder: 0,
    vip: false,
    allergy: false,
    reFireRequested: false,
  );
}

KdsSnapshot _snapshot(List<KdsOrder> orders) {
  return KdsSnapshot(
    section: 'Main',
    view: KdsViewMode.queue.name,
    filter: KdsFilter.all.name,
    lastSyncedAt: DateTime.now(),
    orders: orders,
    groups: const [],
    stats: KdsStats(
      total: orders.length,
      delayed: 0,
      vip: 0,
      priority: 0,
    ),
    isGrouped: false,
  );
}

void main() {
  test('a normal, non-priority order rings', () {
    final tone = _RecordingTone();
    final alarm = KitchenAlarmService(tone: tone);

    alarm.evaluate(_snapshot([_order('ORD-1')]));

    expect(tone.bursts, 1);
    expect(alarm.isRinging, isTrue);
    expect(alarm.pendingCount, 1);
    alarm.dispose();
  });

  test('keeps ringing across polls until acknowledged', () {
    final tone = _RecordingTone();
    final alarm = KitchenAlarmService(tone: tone);
    final snapshot = _snapshot([_order('ORD-1')]);

    alarm.evaluate(snapshot);
    alarm.evaluate(snapshot);
    expect(alarm.isRinging, isTrue);

    alarm.acknowledge();
    expect(alarm.isRinging, isFalse);

    // The same still-new order must not start it again.
    alarm.evaluate(snapshot);
    expect(alarm.isRinging, isFalse);
    alarm.dispose();
  });

  testWidgets('escalates the burst length while it is ignored', (tester) async {
    await tester.pumpWidget(const SizedBox.shrink());
    final tone = _RecordingTone();
    final alarm = KitchenAlarmService(tone: tone);

    alarm.evaluate(_snapshot([_order('ORD-1')]));
    final firstPulses = tone.lastPulses;

    await tester.pump(const Duration(seconds: 30));

    expect(tone.bursts, greaterThan(3));
    expect(tone.lastPulses, greaterThan(firstPulses));
    alarm.dispose();
  });

  test('accepting an order silences it without an explicit acknowledge', () {
    final tone = _RecordingTone();
    final alarm = KitchenAlarmService(tone: tone);

    alarm.evaluate(_snapshot([_order('ORD-1')]));
    expect(alarm.isRinging, isTrue);

    alarm.evaluate(_snapshot([_order('ORD-1', status: KdsStatus.accepted)]));
    expect(alarm.isRinging, isFalse);
    alarm.dispose();
  });

  testWidgets('backgrounding stops the repeat, returning resumes it',
      (tester) async {
    await tester.pumpWidget(const SizedBox.shrink());
    final tone = _RecordingTone();
    final alarm = KitchenAlarmService(tone: tone);

    alarm.evaluate(_snapshot([_order('ORD-1')]));
    alarm.setPaused(true);
    final burstsWhenPaused = tone.bursts;

    await tester.pump(const Duration(seconds: 30));
    expect(tone.bursts, burstsWhenPaused);

    alarm.setPaused(false);
    expect(tone.bursts, greaterThan(burstsWhenPaused));
    alarm.dispose();
  });
}
