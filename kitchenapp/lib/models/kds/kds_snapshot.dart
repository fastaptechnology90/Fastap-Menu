import 'kds_order.dart';

class KdsSnapshot {
  const KdsSnapshot({
    required this.section,
    required this.view,
    required this.filter,
    required this.lastSyncedAt,
    required this.orders,
    required this.groups,
    required this.stats,
    required this.isGrouped,
  });

  final String section;
  final String view;
  final String filter;
  final DateTime lastSyncedAt;
  final List<KdsOrder> orders;
  final List<KdsOrderGroup> groups;
  final KdsStats stats;
  final bool isGrouped;

  static const _liveTimerStatuses = {
    'new',
    'accepted',
    'preparing',
    'delayed',
    're_fire',
  };

  /// Advances preparation timers client-side between API syncs.
  KdsSnapshot withLiveTimerTick() {
    KdsOrder tick(KdsOrder order) {
      if (!_liveTimerStatuses.contains(order.status.apiValue)) {
        return order;
      }
      return order.copyWith(
        timerSeconds: order.timerSeconds + 1,
        progress: (order.progress + 0.002).clamp(0.0, 0.98),
      );
    }

    final tickedOrders = orders.map(tick).toList();
    final tickedGroups = groups
        .map(
          (group) => KdsOrderGroup(
            label: group.label,
            orders: group.orders.map(tick).toList(),
          ),
        )
        .toList();

    return KdsSnapshot(
      section: section,
      view: view,
      filter: filter,
      lastSyncedAt: lastSyncedAt,
      orders: tickedOrders,
      groups: tickedGroups,
      stats: stats,
      isGrouped: isGrouped,
    );
  }

  /// Keeps locally ticking timers when a silent sync returns older values.
  KdsSnapshot mergeLiveTimersFrom(KdsSnapshot previous) {
    final timerById = {
      for (final order in previous.orders) order.id: order.timerSeconds,
    };
    final progressById = {
      for (final order in previous.orders) order.id: order.progress,
    };

    KdsOrder merge(KdsOrder order) {
      final localTimer = timerById[order.id];
      if (localTimer == null || localTimer <= order.timerSeconds) {
        return order;
      }
      return order.copyWith(
        timerSeconds: localTimer,
        progress: progressById[order.id] ?? order.progress,
      );
    }

    final mergedOrders = orders.map(merge).toList();
    final mergedGroups = groups
        .map(
          (group) => KdsOrderGroup(
            label: group.label,
            orders: group.orders.map(merge).toList(),
          ),
        )
        .toList();

    return KdsSnapshot(
      section: section,
      view: view,
      filter: filter,
      lastSyncedAt: lastSyncedAt,
      orders: mergedOrders,
      groups: mergedGroups,
      stats: stats,
      isGrouped: isGrouped,
    );
  }

  factory KdsSnapshot.fromJson(Map<String, dynamic> json) {
    final rawOrders = json['orders'];
    final isGrouped = rawOrders is List &&
        rawOrders.isNotEmpty &&
        rawOrders.first is Map<String, dynamic> &&
        rawOrders.first.containsKey('group');

    if (isGrouped) {
      final groups = rawOrders
          .map((item) => KdsOrderGroup.fromJson(item as Map<String, dynamic>))
          .toList();
      return KdsSnapshot(
        section: json['section'] as String? ?? 'All',
        view: json['view'] as String? ?? 'queue',
        filter: json['filter'] as String? ?? 'all',
        lastSyncedAt: DateTime.parse(json['lastSyncedAt'] as String),
        orders: groups.expand((group) => group.orders).toList(),
        groups: groups,
        stats: KdsStats.fromJson(json['stats'] as Map<String, dynamic>),
        isGrouped: true,
      );
    }

    final orders = (rawOrders as List<dynamic>)
        .map((item) => KdsOrder.fromJson(item as Map<String, dynamic>))
        .toList();

    return KdsSnapshot(
      section: json['section'] as String? ?? 'All',
      view: json['view'] as String? ?? 'queue',
      filter: json['filter'] as String? ?? 'all',
      lastSyncedAt: DateTime.parse(json['lastSyncedAt'] as String),
      orders: orders,
      groups: const [],
      stats: KdsStats.fromJson(json['stats'] as Map<String, dynamic>),
      isGrouped: false,
    );
  }
}

class KdsOrderGroup {
  const KdsOrderGroup({required this.label, required this.orders});

  final String label;
  final List<KdsOrder> orders;

  factory KdsOrderGroup.fromJson(Map<String, dynamic> json) {
    return KdsOrderGroup(
      label: json['group'] as String,
      orders: (json['orders'] as List<dynamic>)
          .map((item) => KdsOrder.fromJson(item as Map<String, dynamic>))
          .toList(),
    );
  }
}

class KdsStats {
  const KdsStats({
    required this.total,
    required this.delayed,
    required this.vip,
    required this.priority,
  });

  final int total;
  final int delayed;
  final int vip;
  final int priority;

  factory KdsStats.fromJson(Map<String, dynamic> json) {
    return KdsStats(
      total: json['total'] as int? ?? 0,
      delayed: json['delayed'] as int? ?? 0,
      vip: json['vip'] as int? ?? 0,
      priority: json['priority'] as int? ?? 0,
    );
  }
}
