class RoomServiceSnapshot {
  const RoomServiceSnapshot({
    required this.section,
    required this.lastSyncedAt,
    required this.roomOrders,
    required this.vipRoomAlerts,
    required this.scheduledDeliveries,
    required this.trayAssignments,
    required this.miniBarSync,
    required this.stats,
    required this.roomServiceFeatures,
    required this.sections,
  });

  final String section;
  final DateTime lastSyncedAt;
  final List<RoomOrder> roomOrders;
  final List<VipRoomAlert> vipRoomAlerts;
  final List<ScheduledDelivery> scheduledDeliveries;
  final List<TrayAssignment> trayAssignments;
  final List<MiniBarSyncItem> miniBarSync;
  final RoomServiceStats stats;
  final RoomServiceFeatureFlags roomServiceFeatures;
  final List<String> sections;

  factory RoomServiceSnapshot.fromJson(Map<String, dynamic> json) {
    return RoomServiceSnapshot(
      section: json['section'] as String? ?? 'All',
      lastSyncedAt: DateTime.parse(json['lastSyncedAt'] as String),
      roomOrders: (json['roomOrders'] as List<dynamic>)
          .map((item) => RoomOrder.fromJson(item as Map<String, dynamic>))
          .toList(),
      vipRoomAlerts: (json['vipRoomAlerts'] as List<dynamic>)
          .map((item) => VipRoomAlert.fromJson(item as Map<String, dynamic>))
          .toList(),
      scheduledDeliveries: (json['scheduledDeliveries'] as List<dynamic>)
          .map(
            (item) =>
                ScheduledDelivery.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      trayAssignments: (json['trayAssignments'] as List<dynamic>)
          .map((item) => TrayAssignment.fromJson(item as Map<String, dynamic>))
          .toList(),
      miniBarSync: (json['miniBarSync'] as List<dynamic>)
          .map((item) => MiniBarSyncItem.fromJson(item as Map<String, dynamic>))
          .toList(),
      stats: RoomServiceStats.fromJson(json['stats'] as Map<String, dynamic>),
      roomServiceFeatures: RoomServiceFeatureFlags.fromJson(
        json['roomServiceFeatures'] as Map<String, dynamic>,
      ),
      sections: (json['sections'] as List<dynamic>)
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class RoomOrder {
  const RoomOrder({
    required this.id,
    required this.orderId,
    required this.kotNumber,
    required this.roomNumber,
    required this.section,
    required this.guestType,
    required this.itemSummary,
    required this.status,
    required this.priority,
    required this.timerSeconds,
    required this.timerLabel,
    required this.availableActions,
  });

  final String id;
  final String orderId;
  final String kotNumber;
  final String roomNumber;
  final String section;
  final String guestType;
  final String itemSummary;
  final String status;
  final String priority;
  final int timerSeconds;
  final String timerLabel;
  final List<String> availableActions;

  factory RoomOrder.fromJson(Map<String, dynamic> json) {
    return RoomOrder(
      id: json['id'] as String,
      orderId: json['orderId'] as String,
      kotNumber: json['kotNumber'] as String,
      roomNumber: json['roomNumber'] as String,
      section: json['section'] as String,
      guestType: json['guestType'] as String? ?? 'Regular',
      itemSummary: json['itemSummary'] as String? ?? '',
      status: json['status'] as String? ?? 'queued',
      priority: json['priority'] as String? ?? 'normal',
      timerSeconds: json['timerSeconds'] as int? ?? 0,
      timerLabel: json['timerLabel'] as String? ?? '00:00',
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class VipRoomAlert {
  const VipRoomAlert({
    required this.id,
    required this.roomNumber,
    required this.guestName,
    required this.alertType,
    required this.priority,
    required this.status,
  });

  final String id;
  final String roomNumber;
  final String guestName;
  final String alertType;
  final String priority;
  final String status;

  factory VipRoomAlert.fromJson(Map<String, dynamic> json) {
    return VipRoomAlert(
      id: json['id'] as String,
      roomNumber: json['roomNumber'] as String,
      guestName: json['guestName'] as String? ?? 'VIP Guest',
      alertType: json['alertType'] as String? ?? 'priority',
      priority: json['priority'] as String? ?? 'vip',
      status: json['status'] as String? ?? 'active',
    );
  }
}

class ScheduledDelivery {
  const ScheduledDelivery({
    required this.id,
    required this.orderId,
    required this.kotNumber,
    required this.roomNumber,
    required this.scheduledTime,
    required this.itemSummary,
    required this.status,
  });

  final String id;
  final String orderId;
  final String kotNumber;
  final String roomNumber;
  final String scheduledTime;
  final String itemSummary;
  final String status;

  factory ScheduledDelivery.fromJson(Map<String, dynamic> json) {
    return ScheduledDelivery(
      id: json['id'] as String,
      orderId: json['orderId'] as String,
      kotNumber: json['kotNumber'] as String,
      roomNumber: json['roomNumber'] as String,
      scheduledTime: json['scheduledTime'] as String? ?? '20:00',
      itemSummary: json['itemSummary'] as String? ?? '',
      status: json['status'] as String? ?? 'scheduled',
    );
  }
}

class TrayAssignment {
  const TrayAssignment({
    required this.id,
    required this.trayId,
    required this.roomNumber,
    required this.orderId,
    required this.kotNumber,
    required this.staffName,
    required this.status,
  });

  final String id;
  final String trayId;
  final String roomNumber;
  final String orderId;
  final String kotNumber;
  final String staffName;
  final String status;

  factory TrayAssignment.fromJson(Map<String, dynamic> json) {
    return TrayAssignment(
      id: json['id'] as String,
      trayId: json['trayId'] as String,
      roomNumber: json['roomNumber'] as String,
      orderId: json['orderId'] as String,
      kotNumber: json['kotNumber'] as String,
      staffName: json['staffName'] as String? ?? 'Unassigned',
      status: json['status'] as String? ?? 'pending',
    );
  }
}

class MiniBarSyncItem {
  const MiniBarSyncItem({
    required this.id,
    required this.roomNumber,
    required this.itemName,
    required this.quantity,
    required this.syncStatus,
    required this.lastSyncedAt,
  });

  final String id;
  final String roomNumber;
  final String itemName;
  final int quantity;
  final String syncStatus;
  final String lastSyncedAt;

  factory MiniBarSyncItem.fromJson(Map<String, dynamic> json) {
    return MiniBarSyncItem(
      id: json['id'] as String,
      roomNumber: json['roomNumber'] as String,
      itemName: json['itemName'] as String,
      quantity: json['quantity'] as int? ?? 0,
      syncStatus: json['syncStatus'] as String? ?? 'pending',
      lastSyncedAt: json['lastSyncedAt'] as String? ?? 'Just now',
    );
  }
}

class RoomServiceStats {
  const RoomServiceStats({
    required this.activeRoomOrders,
    required this.vipRooms,
    required this.scheduledDeliveries,
    required this.traysInTransit,
    required this.miniBarPending,
    required this.completedToday,
  });

  final int activeRoomOrders;
  final int vipRooms;
  final int scheduledDeliveries;
  final int traysInTransit;
  final int miniBarPending;
  final int completedToday;

  factory RoomServiceStats.fromJson(Map<String, dynamic> json) {
    return RoomServiceStats(
      activeRoomOrders: json['activeRoomOrders'] as int? ?? 0,
      vipRooms: json['vipRooms'] as int? ?? 0,
      scheduledDeliveries: json['scheduledDeliveries'] as int? ?? 0,
      traysInTransit: json['traysInTransit'] as int? ?? 0,
      miniBarPending: json['miniBarPending'] as int? ?? 0,
      completedToday: json['completedToday'] as int? ?? 0,
    );
  }
}

class RoomServiceFeatureFlags {
  const RoomServiceFeatureFlags({
    required this.roomWiseOrderTracking,
    required this.vipRoomPriority,
    required this.scheduledRoomDelivery,
    required this.trayManagement,
    required this.miniBarSynchronization,
  });

  final bool roomWiseOrderTracking;
  final bool vipRoomPriority;
  final bool scheduledRoomDelivery;
  final bool trayManagement;
  final bool miniBarSynchronization;

  factory RoomServiceFeatureFlags.fromJson(Map<String, dynamic> json) {
    return RoomServiceFeatureFlags(
      roomWiseOrderTracking: json['roomWiseOrderTracking'] as bool? ?? false,
      vipRoomPriority: json['vipRoomPriority'] as bool? ?? false,
      scheduledRoomDelivery: json['scheduledRoomDelivery'] as bool? ?? false,
      trayManagement: json['trayManagement'] as bool? ?? false,
      miniBarSynchronization:
          json['miniBarSynchronization'] as bool? ?? false,
    );
  }
}

class RoomServiceActionResult {
  const RoomServiceActionResult({
    required this.success,
    required this.message,
  });

  final bool success;
  final String message;

  factory RoomServiceActionResult.fromJson(Map<String, dynamic> json) {
    return RoomServiceActionResult(
      success: json['success'] as bool? ?? false,
      message: json['message'] as String? ?? 'Room service action applied',
    );
  }
}
