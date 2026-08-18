import 'mock_section_registry.dart';

class MockDashboardCalculator {
  const MockDashboardCalculator._();

  static Map<String, dynamic> buildDashboard({
    required String section,
    required List<Map<String, dynamic>> orders,
  }) {
    final active = orders.where((o) => _isActive(o['status'] as String)).length;
    final delayed = orders.where((o) => o['status'] == 'delayed').length;
    final vip = orders.where((o) => o['vip'] == true).length;
    final priority = orders
        .where((o) => (o['priority'] as String) != 'normal')
        .length;
    final pending = orders
        .where((o) => {'new', 'accepted'}.contains(o['status']))
        .length;
    final completed = orders
        .where((o) => {'ready', 'served'}.contains(o['status']))
        .length;
    final rejected = orders.where((o) => o['status'] == 'rejected').length;
    final rushCount = orders
        .where(
          (o) =>
              o['status'] == 'delayed' ||
              (o['priority'] as String) == 'express' ||
              (o['timerSeconds'] as int) > 600,
        )
        .length;

    final avgSeconds = _averagePrepSeconds(orders);
    final delayRatio = orders.isEmpty
        ? 0
        : ((delayed / orders.length) * 100).round();
    final efficiency = (100 - delayRatio).clamp(60, 99);
    final backlog = pending + active;
    final peakLoad = ((active / 12) * 100).clamp(0, 100).round();
    final productivity = (efficiency * 0.92).round();
    final prepSpeed = (3600 / (avgSeconds == 0 ? 780 : avgSeconds)).round();

    return {
      'section': section,
      'lastSyncedAt': DateTime.now().toIso8601String(),
      'sections': MockSectionRegistry.filterSections,
      'widgets': [
        _widget('activeOrders', 'Active orders', '$active', _rushDetail(active), 'danger'),
        _widget('delayedOrders', 'Delayed orders', '$delayed', _criticalDetail(delayed), 'warning'),
        _widget('vipOrders', 'VIP orders', '$vip', vip > 0 ? 'Priority lane' : 'Clear', 'premium'),
        _widget('priorityOrders', 'Priority orders', '$priority', 'Express + event', 'info'),
        _widget('sectionWorkload', 'Section workload', _busiestSection(orders), 'Highest queue', 'warning'),
        _widget('staffAvailability', 'Staff availability', '18/22', '4 on break', 'primary'),
        _widget('pendingKots', 'Pending KOTs', '$pending', 'Awaiting prep', 'info'),
        _widget('completedOrders', 'Completed orders', '$completed', 'Shift total', 'primary'),
        _widget('rejectedOrders', 'Rejected orders', '$rejected', rejected > 0 ? 'Review QC' : 'None', 'danger'),
        _widget('rushAlerts', 'Rush alerts', '$rushCount', rushCount > 0 ? 'Action needed' : 'Stable', 'danger'),
      ],
      'metrics': [
        _metric('kitchenEfficiency', 'Kitchen efficiency', '$efficiency%', '+6% vs yesterday', 'primary'),
        _metric('avgPrepTime', 'Average preparation time', _formatDuration(avgSeconds), '-2m today', 'info'),
        _metric('delayRatio', 'Delay ratio', '$delayRatio%', delayed > 2 ? 'Above target' : 'On target', 'warning'),
        _metric('orderBacklog', 'Order backlog', '$backlog', 'Queue depth', 'danger'),
        _metric('peakKitchenLoad', 'Peak kitchen load', '$peakLoad%', 'Live capacity', 'premium'),
        _metric('staffProductivity', 'Staff productivity', '$productivity%', 'Shift average', 'primary'),
        _metric('livePrepSpeed', 'Live preparation speed', '$prepSpeed/hr', 'Plates per hour', 'info'),
      ],
      'sectionWorkload': _sectionWorkload(orders),
      'rushAlerts': _rushAlerts(orders),
      'orders': orders
          .where(
            (order) => {
              'new',
              'accepted',
              'preparing',
              'delayed',
              'ready',
            }.contains(order['status']),
          )
          .map(_serializeOrder)
          .toList(),
    };
  }

  static bool _isActive(String status) {
    return {'new', 'accepted', 'preparing', 'delayed', 'ready'}.contains(status);
  }

  static int _averagePrepSeconds(List<Map<String, dynamic>> orders) {
    final activeOrders = orders.where((o) => _isActive(o['status'] as String));
    if (activeOrders.isEmpty) {
      return 780;
    }
    final total = activeOrders.fold<int>(
      0,
      (sum, order) => sum + (order['timerSeconds'] as int),
    );
    return (total / activeOrders.length).round();
  }

  static String _busiestSection(List<Map<String, dynamic>> orders) {
    final counts = <String, int>{};
    for (final order in orders.where((o) => _isActive(o['status'] as String))) {
      final key = order['section'] as String;
      counts[key] = (counts[key] ?? 0) + 1;
    }
    if (counts.isEmpty) {
      return 'Main';
    }
    return counts.entries.reduce((a, b) => a.value >= b.value ? a : b).key;
  }

  static List<Map<String, dynamic>> _sectionWorkload(
    List<Map<String, dynamic>> orders,
  ) {
    final counts = <String, int>{};
    for (final order in orders.where((o) => _isActive(o['status'] as String))) {
      final key = order['section'] as String;
      counts[key] = (counts[key] ?? 0) + 1;
    }

    return MockSectionRegistry.sectionNames.map((section) {
          final count = counts[section] ?? 0;
          return {
            'section': section,
            'activeOrders': count,
            'load': (count / 6).clamp(0.0, 1.0),
            'staffAssigned': count > 3 ? 3 : count > 0 ? 2 : 1,
          };
        })
        .toList();
  }

  static List<Map<String, dynamic>> _rushAlerts(
    List<Map<String, dynamic>> orders,
  ) {
    final alerts = <Map<String, dynamic>>[];

    for (final order in orders) {
      if (order['status'] == 'delayed') {
        alerts.add({
          'id': 'ALERT-${order['id']}',
          'title': '${order['kotNumber']} delayed',
          'message': '${order['section']} section · ${order['location']}',
          'severity': 'critical',
          'timestamp': DateTime.now().toIso8601String(),
        });
      } else if (order['priority'] == 'express' && order['status'] != 'ready') {
        alerts.add({
          'id': 'ALERT-${order['id']}-EXP',
          'title': 'Express order ${order['kotNumber']}',
          'message': 'Rider/customer waiting · ${order['section']}',
          'severity': 'high',
          'timestamp': DateTime.now().toIso8601String(),
        });
      } else if (order['vip'] == true && order['status'] == 'preparing') {
        alerts.add({
          'id': 'ALERT-${order['id']}-VIP',
          'title': 'VIP order ${order['kotNumber']}',
          'message': '${order['location']} · supervisor watch',
          'severity': 'vip',
          'timestamp': DateTime.now().toIso8601String(),
        });
      }
    }

    return alerts.take(4).toList();
  }

  static Map<String, dynamic> serializeOrder(Map<String, dynamic> order) {
    return {
      ...order,
      'timer': _formatDuration(order['timerSeconds'] as int),
      'statusLabel': _statusLabel(order['status'] as String),
    };
  }

  static Map<String, dynamic> _serializeOrder(Map<String, dynamic> order) =>
      serializeOrder(order);

  static Map<String, dynamic> _widget(
    String key,
    String label,
    String value,
    String detail,
    String tone,
  ) {
    return {
      'key': key,
      'label': label,
      'value': value,
      'detail': detail,
      'tone': tone,
    };
  }

  static Map<String, dynamic> _metric(
    String key,
    String label,
    String value,
    String detail,
    String tone,
  ) {
    return {
      'key': key,
      'label': label,
      'value': value,
      'detail': detail,
      'tone': tone,
    };
  }

  static String _rushDetail(int active) {
    if (active >= 8) {
      return '+${active - 5} rush';
    }
    return 'Steady flow';
  }

  static String _criticalDetail(int delayed) {
    if (delayed >= 2) {
      return '$delayed critical';
    }
    return delayed == 1 ? '1 flagged' : 'Clear';
  }

  static String _formatDuration(int seconds) {
    if (seconds <= 0) {
      return '00:00';
    }
    final minutes = seconds ~/ 60;
    final remaining = seconds % 60;
    return '${minutes.toString().padLeft(2, '0')}:${remaining.toString().padLeft(2, '0')}';
  }

  static String _statusLabel(String status) {
    return switch (status) {
      'new' => 'New order',
      'accepted' => 'Accepted',
      'preparing' => 'Preparing',
      'ready' => 'Ready',
      'served' => 'Served',
      'delayed' => 'Delayed',
      'rejected' => 'Rejected',
      're_fire' => 'Re-fire requested',
      _ => status,
    };
  }
}
