class WaiterAssignmentSnapshot {
  const WaiterAssignmentSnapshot({
    required this.filterSection,
    required this.tasks,
    required this.notifications,
    required this.workloadBoard,
    required this.stats,
    required this.featureFlags,
    required this.lastSyncedAt,
  });

  final String filterSection;
  final List<WaiterDeliveryTask> tasks;
  final List<WaiterReadyNotification> notifications;
  final List<WaiterWorkloadEntry> workloadBoard;
  final WaiterAssignmentStats stats;
  final WaiterFeatureFlags featureFlags;
  final DateTime lastSyncedAt;

  factory WaiterAssignmentSnapshot.fromJson(Map<String, dynamic> json) {
    return WaiterAssignmentSnapshot(
      filterSection: json['filterSection'] as String? ?? 'All',
      tasks: (json['tasks'] as List<dynamic>)
          .map(
            (item) =>
                WaiterDeliveryTask.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      notifications: (json['notifications'] as List<dynamic>)
          .map(
            (item) => WaiterReadyNotification.fromJson(
              item as Map<String, dynamic>,
            ),
          )
          .toList(),
      workloadBoard: (json['workloadBoard'] as List<dynamic>)
          .map(
            (item) =>
                WaiterWorkloadEntry.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      stats: WaiterAssignmentStats.fromJson(
        json['stats'] as Map<String, dynamic>,
      ),
      featureFlags: WaiterFeatureFlags.fromJson(
        json['featureFlags'] as Map<String, dynamic>,
      ),
      lastSyncedAt: DateTime.parse(json['lastSyncedAt'] as String),
    );
  }
}

class WaiterDeliveryTask {
  const WaiterDeliveryTask({
    required this.id,
    required this.orderId,
    required this.kotNumber,
    required this.tableNumber,
    required this.roomNumber,
    required this.assignedWaiter,
    required this.status,
    required this.priority,
    required this.message,
    required this.availableActions,
  });

  final String id;
  final String orderId;
  final String kotNumber;
  final String tableNumber;
  final String? roomNumber;
  final String assignedWaiter;
  final String status;
  final String priority;
  final String message;
  final List<String> availableActions;

  factory WaiterDeliveryTask.fromJson(Map<String, dynamic> json) {
    return WaiterDeliveryTask(
      id: json['id'] as String,
      orderId: json['orderId'] as String,
      kotNumber: json['kotNumber'] as String,
      tableNumber: json['tableNumber'] as String,
      roomNumber: json['roomNumber'] as String?,
      assignedWaiter: json['assignedWaiter'] as String? ?? 'Unassigned',
      status: json['status'] as String? ?? 'assigned',
      priority: json['priority'] as String? ?? 'normal',
      message: json['message'] as String? ?? '',
      availableActions: (json['availableActions'] as List<dynamic>?)
              ?.map((item) => item.toString())
              .toList() ??
          const [],
    );
  }
}

class WaiterReadyNotification {
  const WaiterReadyNotification({
    required this.id,
    required this.title,
    required this.body,
    required this.tableNumber,
    required this.status,
    required this.createdAt,
    required this.availableActions,
  });

  final String id;
  final String title;
  final String body;
  final String tableNumber;
  final String status;
  final String createdAt;
  final List<String> availableActions;

  factory WaiterReadyNotification.fromJson(Map<String, dynamic> json) {
    return WaiterReadyNotification(
      id: json['id'] as String,
      title: json['title'] as String,
      body: json['body'] as String,
      tableNumber: json['tableNumber'] as String? ?? '',
      status: json['status'] as String? ?? 'new',
      createdAt: json['createdAt'] as String? ?? 'Just now',
      availableActions: (json['availableActions'] as List<dynamic>?)
              ?.map((item) => item.toString())
              .toList() ??
          const [],
    );
  }
}

class WaiterWorkloadEntry {
  const WaiterWorkloadEntry({
    required this.waiterId,
    required this.waiterName,
    required this.activeTasks,
    required this.completedToday,
    required this.loadScore,
    required this.status,
  });

  final String waiterId;
  final String waiterName;
  final int activeTasks;
  final int completedToday;
  final double loadScore;
  final String status;

  factory WaiterWorkloadEntry.fromJson(Map<String, dynamic> json) {
    return WaiterWorkloadEntry(
      waiterId: json['waiterId'] as String,
      waiterName: json['waiterName'] as String,
      activeTasks: json['activeTasks'] as int? ?? 0,
      completedToday: json['completedToday'] as int? ?? 0,
      loadScore: (json['loadScore'] as num?)?.toDouble() ?? 0,
      status: json['status'] as String? ?? 'balanced',
    );
  }
}

class WaiterAssignmentStats {
  const WaiterAssignmentStats({
    required this.openTasks,
    required this.readyNotifications,
    required this.deliveriesConfirmedToday,
    required this.autoAssignmentsToday,
    required this.balancedWaiters,
  });

  final int openTasks;
  final int readyNotifications;
  final int deliveriesConfirmedToday;
  final int autoAssignmentsToday;
  final int balancedWaiters;

  factory WaiterAssignmentStats.fromJson(Map<String, dynamic> json) {
    return WaiterAssignmentStats(
      openTasks: json['openTasks'] as int? ?? 0,
      readyNotifications: json['readyNotifications'] as int? ?? 0,
      deliveriesConfirmedToday: json['deliveriesConfirmedToday'] as int? ?? 0,
      autoAssignmentsToday: json['autoAssignmentsToday'] as int? ?? 0,
      balancedWaiters: json['balancedWaiters'] as int? ?? 0,
    );
  }
}

class WaiterFeatureFlags {
  const WaiterFeatureFlags({
    required this.autoTaskAllocation,
    required this.orderReadyNotifications,
    required this.deliveryConfirmation,
    required this.workloadBalanceAlgorithm,
    required this.inHotelNavigation,
    required this.noManualCalling,
  });

  final bool autoTaskAllocation;
  final bool orderReadyNotifications;
  final bool deliveryConfirmation;
  final bool workloadBalanceAlgorithm;
  final bool inHotelNavigation;
  final bool noManualCalling;

  factory WaiterFeatureFlags.fromJson(Map<String, dynamic> json) {
    return WaiterFeatureFlags(
      autoTaskAllocation: json['autoTaskAllocation'] as bool? ?? true,
      orderReadyNotifications:
          json['orderReadyNotifications'] as bool? ?? true,
      deliveryConfirmation: json['deliveryConfirmation'] as bool? ?? true,
      workloadBalanceAlgorithm:
          json['workloadBalanceAlgorithm'] as bool? ?? true,
      inHotelNavigation: json['inHotelNavigation'] as bool? ?? false,
      noManualCalling: json['noManualCalling'] as bool? ?? true,
    );
  }
}

class WaiterAssignmentActionResult {
  const WaiterAssignmentActionResult({
    required this.success,
    required this.message,
  });

  final bool success;
  final String message;

  factory WaiterAssignmentActionResult.fromJson(Map<String, dynamic> json) {
    return WaiterAssignmentActionResult(
      success: json['success'] as bool? ?? true,
      message: json['message'] as String? ?? 'Action completed',
    );
  }
}
