import 'package:flutter/services.dart';

import '../models/kds/kds_snapshot.dart';

typedef PriorityAlertSound = void Function();

class KdsPrioritySoundService {
  KdsPrioritySoundService({PriorityAlertSound? playAlert})
      : _playAlert = playAlert ?? _defaultPlayAlert;

  static void _defaultPlayAlert() {
    SystemSound.play(SystemSoundType.alert);
  }

  final PriorityAlertSound _playAlert;
  final Set<String> _alertedOrderIds = <String>{};

  void evaluate(KdsSnapshot? snapshot) {
    if (snapshot == null) {
      return;
    }

    final activeIds = snapshot.orders.map((order) => order.id).toSet();
    _alertedOrderIds.removeWhere((id) => !activeIds.contains(id));

    for (final order in snapshot.orders) {
      if (!order.isPriority || _alertedOrderIds.contains(order.id)) {
        continue;
      }
      _alertedOrderIds.add(order.id);
      _playAlert();
    }
  }

  void reset() {
    _alertedOrderIds.clear();
  }
}
