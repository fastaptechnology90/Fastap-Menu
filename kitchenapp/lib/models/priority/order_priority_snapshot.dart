import '../kitchen_order.dart';

class OrderPrioritySnapshot {
  const OrderPrioritySnapshot({
    required this.section,
    required this.lastSyncedAt,
    required this.orders,
    required this.lanes,
    required this.alerts,
    required this.stats,
    required this.priorityEngine,
    required this.sections,
  });

  final String section;
  final DateTime lastSyncedAt;
  final List<PriorityOrder> orders;
  final List<PriorityLane> lanes;
  final List<PriorityAlert> alerts;
  final PriorityStats stats;
  final PriorityEngineFlags priorityEngine;
  final List<String> sections;

  factory OrderPrioritySnapshot.fromJson(Map<String, dynamic> json) {
    return OrderPrioritySnapshot(
      section: json['section'] as String? ?? 'All',
      lastSyncedAt: DateTime.parse(json['lastSyncedAt'] as String),
      orders: (json['orders'] as List<dynamic>)
          .map((item) => PriorityOrder.fromJson(item as Map<String, dynamic>))
          .toList(),
      lanes: (json['lanes'] as List<dynamic>)
          .map((item) => PriorityLane.fromJson(item as Map<String, dynamic>))
          .toList(),
      alerts: (json['alerts'] as List<dynamic>)
          .map((item) => PriorityAlert.fromJson(item as Map<String, dynamic>))
          .toList(),
      stats: PriorityStats.fromJson(json['stats'] as Map<String, dynamic>),
      priorityEngine: PriorityEngineFlags.fromJson(
        json['priorityEngine'] as Map<String, dynamic>,
      ),
      sections: (json['sections'] as List<dynamic>)
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class PriorityOrder {
  const PriorityOrder({
    required this.base,
    required this.priorityType,
    required this.priorityLabel,
    required this.priorityScore,
    required this.queuePosition,
    required this.flashAlert,
    required this.soundAlert,
    required this.escalated,
    required this.availableActions,
  });

  final KitchenOrder base;
  final String priorityType;
  final String priorityLabel;
  final int priorityScore;
  final int queuePosition;
  final bool flashAlert;
  final bool soundAlert;
  final bool escalated;
  final List<String> availableActions;

  factory PriorityOrder.fromJson(Map<String, dynamic> json) {
    return PriorityOrder(
      base: KitchenOrder.fromJson(json),
      priorityType: json['priorityType'] as String,
      priorityLabel: json['priorityLabel'] as String,
      priorityScore: json['priorityScore'] as int,
      queuePosition: json['queuePosition'] as int,
      flashAlert: json['flashAlert'] as bool? ?? false,
      soundAlert: json['soundAlert'] as bool? ?? false,
      escalated: json['escalated'] as bool? ?? false,
      availableActions:
          (json['availableActions'] as List<dynamic>? ?? const [])
              .map((item) => item.toString())
              .toList(),
    );
  }
}

class PriorityLane {
  const PriorityLane({
    required this.type,
    required this.label,
    required this.count,
    required this.orderIds,
  });

  final String type;
  final String label;
  final int count;
  final List<String> orderIds;

  factory PriorityLane.fromJson(Map<String, dynamic> json) {
    return PriorityLane(
      type: json['type'] as String,
      label: json['label'] as String,
      count: json['count'] as int,
      orderIds: (json['orderIds'] as List<dynamic>)
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class PriorityAlert {
  const PriorityAlert({
    required this.id,
    required this.type,
    required this.orderId,
    required this.kotNumber,
    required this.message,
  });

  final String id;
  final String type;
  final String orderId;
  final String kotNumber;
  final String message;

  factory PriorityAlert.fromJson(Map<String, dynamic> json) {
    return PriorityAlert(
      id: json['id'] as String,
      type: json['type'] as String,
      orderId: json['orderId'] as String,
      kotNumber: json['kotNumber'] as String,
      message: json['message'] as String,
    );
  }
}

class PriorityStats {
  const PriorityStats({
    required this.total,
    required this.vip,
    required this.express,
    required this.roomService,
    required this.event,
    required this.delivery,
    required this.childMeal,
    required this.flashAlerts,
    required this.escalated,
  });

  final int total;
  final int vip;
  final int express;
  final int roomService;
  final int event;
  final int delivery;
  final int childMeal;
  final int flashAlerts;
  final int escalated;

  factory PriorityStats.fromJson(Map<String, dynamic> json) {
    return PriorityStats(
      total: json['total'] as int? ?? 0,
      vip: json['vip'] as int? ?? 0,
      express: json['express'] as int? ?? 0,
      roomService: json['roomService'] as int? ?? 0,
      event: json['event'] as int? ?? 0,
      delivery: json['delivery'] as int? ?? 0,
      childMeal: json['childMeal'] as int? ?? 0,
      flashAlerts: json['flashAlerts'] as int? ?? 0,
      escalated: json['escalated'] as int? ?? 0,
    );
  }
}

class PriorityEngineFlags {
  const PriorityEngineFlags({
    required this.vipPrioritization,
    required this.expressLane,
    required this.roomServicePriority,
    required this.eventPriority,
    required this.deliveryPriority,
    required this.childMealPriority,
    required this.queueJump,
    required this.flashAlert,
    required this.soundAlert,
    required this.autoEscalation,
    required this.autoReassignment,
  });

  final bool vipPrioritization;
  final bool expressLane;
  final bool roomServicePriority;
  final bool eventPriority;
  final bool deliveryPriority;
  final bool childMealPriority;
  final bool queueJump;
  final bool flashAlert;
  final bool soundAlert;
  final bool autoEscalation;
  final bool autoReassignment;

  factory PriorityEngineFlags.fromJson(Map<String, dynamic> json) {
    return PriorityEngineFlags(
      vipPrioritization: json['vipPrioritization'] as bool? ?? false,
      expressLane: json['expressLane'] as bool? ?? false,
      roomServicePriority: json['roomServicePriority'] as bool? ?? false,
      eventPriority: json['eventPriority'] as bool? ?? false,
      deliveryPriority: json['deliveryPriority'] as bool? ?? false,
      childMealPriority: json['childMealPriority'] as bool? ?? false,
      queueJump: json['queueJump'] as bool? ?? false,
      flashAlert: json['flashAlert'] as bool? ?? false,
      soundAlert: json['soundAlert'] as bool? ?? false,
      autoEscalation: json['autoEscalation'] as bool? ?? false,
      autoReassignment: json['autoReassignment'] as bool? ?? false,
    );
  }
}

class PriorityActionResult {
  const PriorityActionResult({
    required this.success,
    required this.message,
  });

  final bool success;
  final String message;

  factory PriorityActionResult.fromJson(Map<String, dynamic> json) {
    return PriorityActionResult(
      success: json['success'] as bool? ?? false,
      message: json['message'] as String? ?? 'Priority action applied',
    );
  }
}
