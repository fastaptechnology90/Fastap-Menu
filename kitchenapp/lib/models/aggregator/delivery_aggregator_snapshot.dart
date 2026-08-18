class DeliveryAggregatorSnapshot {

  const DeliveryAggregatorSnapshot({

    required this.section,

    required this.lastSyncedAt,

    required this.orders,

    required this.riderAlerts,

    required this.dispatchTracking,

    required this.stats,

    required this.aggregatorFeatures,

    required this.sections,

  });



  final String section;

  final DateTime lastSyncedAt;

  final List<AggregatorOrder> orders;

  final List<RiderAlert> riderAlerts;

  final List<DispatchTrackingEntry> dispatchTracking;

  final AggregatorStats stats;

  final AggregatorFeatureFlags aggregatorFeatures;

  final List<String> sections;



  factory DeliveryAggregatorSnapshot.fromJson(Map<String, dynamic> json) {

    return DeliveryAggregatorSnapshot(

      section: json['section'] as String? ?? 'All',

      lastSyncedAt: DateTime.parse(json['lastSyncedAt'] as String),

      orders: (json['orders'] as List<dynamic>)

          .map((item) => AggregatorOrder.fromJson(item as Map<String, dynamic>))

          .toList(),

      riderAlerts: (json['riderAlerts'] as List<dynamic>)

          .map((item) => RiderAlert.fromJson(item as Map<String, dynamic>))

          .toList(),

      dispatchTracking: (json['dispatchTracking'] as List<dynamic>)

          .map(

            (item) =>

                DispatchTrackingEntry.fromJson(item as Map<String, dynamic>),

          )

          .toList(),

      stats: AggregatorStats.fromJson(json['stats'] as Map<String, dynamic>),

      aggregatorFeatures: AggregatorFeatureFlags.fromJson(

        json['aggregatorFeatures'] as Map<String, dynamic>,

      ),

      sections: (json['sections'] as List<dynamic>)

          .map((item) => item.toString())

          .toList(),

    );

  }

}



class AggregatorOrder {

  const AggregatorOrder({

    required this.id,

    required this.orderId,

    required this.kotNumber,

    required this.platform,

    required this.section,

    required this.location,

    required this.itemsSummary,

    required this.syncStatus,

    required this.pickupCountdownSeconds,

    required this.countdownLabel,

    required this.prepTimerSeconds,

    required this.prepTimerLabel,

    required this.dispatchStatus,

    required this.riderWaiting,

    required this.availableActions,

  });



  final String id;

  final String orderId;

  final String kotNumber;

  final String platform;

  final String section;

  final String location;

  final String itemsSummary;

  final String syncStatus;

  final int pickupCountdownSeconds;

  final String countdownLabel;

  final int prepTimerSeconds;

  final String prepTimerLabel;

  final String dispatchStatus;

  final bool riderWaiting;

  final List<String> availableActions;



  factory AggregatorOrder.fromJson(Map<String, dynamic> json) {

    return AggregatorOrder(

      id: json['id'] as String,

      orderId: json['orderId'] as String,

      kotNumber: json['kotNumber'] as String,

      platform: json['platform'] as String,

      section: json['section'] as String,

      location: json['location'] as String,

      itemsSummary: json['itemsSummary'] as String,

      syncStatus: json['syncStatus'] as String? ?? 'pending',

      pickupCountdownSeconds: json['pickupCountdownSeconds'] as int? ?? 0,

      countdownLabel: json['countdownLabel'] as String? ?? '00:00',

      prepTimerSeconds: json['prepTimerSeconds'] as int? ?? 0,

      prepTimerLabel: json['prepTimerLabel'] as String? ?? '00:00',

      dispatchStatus: json['dispatchStatus'] as String? ?? 'preparing',

      riderWaiting: json['riderWaiting'] as bool? ?? false,

      availableActions:

          (json['availableActions'] as List<dynamic>? ?? const [])

              .map((item) => item.toString())

              .toList(),

    );

  }

}



class RiderAlert {

  const RiderAlert({

    required this.id,

    required this.orderId,

    required this.kotNumber,

    required this.platform,

    required this.message,

    required this.severity,

    required this.triggeredAt,

  });



  final String id;

  final String orderId;

  final String kotNumber;

  final String platform;

  final String message;

  final String severity;

  final DateTime triggeredAt;



  factory RiderAlert.fromJson(Map<String, dynamic> json) {

    return RiderAlert(

      id: json['id'] as String,

      orderId: json['orderId'] as String,

      kotNumber: json['kotNumber'] as String,

      platform: json['platform'] as String,

      message: json['message'] as String,

      severity: json['severity'] as String? ?? 'medium',

      triggeredAt: DateTime.parse(json['triggeredAt'] as String),

    );

  }

}



class DispatchTrackingEntry {

  const DispatchTrackingEntry({

    required this.orderId,

    required this.kotNumber,

    required this.platform,

    required this.status,

    required this.updatedAt,

  });



  final String orderId;

  final String kotNumber;

  final String platform;

  final String status;

  final DateTime updatedAt;



  factory DispatchTrackingEntry.fromJson(Map<String, dynamic> json) {

    return DispatchTrackingEntry(

      orderId: json['orderId'] as String,

      kotNumber: json['kotNumber'] as String,

      platform: json['platform'] as String,

      status: json['status'] as String,

      updatedAt: DateTime.parse(json['updatedAt'] as String),

    );

  }

}



class AggregatorStats {

  const AggregatorStats({

    required this.activeOrders,

    required this.swiggyOrders,

    required this.zomatoOrders,

    required this.ondcOrders,

    required this.riderAlerts,

    required this.awaitingPickup,

    required this.dispatchedToday,

  });



  final int activeOrders;

  final int swiggyOrders;

  final int zomatoOrders;

  final int ondcOrders;

  final int riderAlerts;

  final int awaitingPickup;

  final int dispatchedToday;



  factory AggregatorStats.fromJson(Map<String, dynamic> json) {

    return AggregatorStats(

      activeOrders: json['activeOrders'] as int? ?? 0,

      swiggyOrders: json['swiggyOrders'] as int? ?? 0,

      zomatoOrders: json['zomatoOrders'] as int? ?? 0,

      ondcOrders: json['ondcOrders'] as int? ?? 0,

      riderAlerts: json['riderAlerts'] as int? ?? 0,

      awaitingPickup: json['awaitingPickup'] as int? ?? 0,

      dispatchedToday: json['dispatchedToday'] as int? ?? 0,

    );

  }

}



class AggregatorFeatureFlags {

  const AggregatorFeatureFlags({

    required this.aggregatorOrderSync,

    required this.pickupCountdown,

    required this.riderWaitingAlerts,

    required this.dispatchTracking,

    required this.deliveryPrepTimers,

    required this.swiggy,

    required this.zomato,

    required this.ondc,

  });



  final bool aggregatorOrderSync;

  final bool pickupCountdown;

  final bool riderWaitingAlerts;

  final bool dispatchTracking;

  final bool deliveryPrepTimers;

  final bool swiggy;

  final bool zomato;

  final bool ondc;



  factory AggregatorFeatureFlags.fromJson(Map<String, dynamic> json) {

    return AggregatorFeatureFlags(

      aggregatorOrderSync: json['aggregatorOrderSync'] as bool? ?? false,

      pickupCountdown: json['pickupCountdown'] as bool? ?? false,

      riderWaitingAlerts: json['riderWaitingAlerts'] as bool? ?? false,

      dispatchTracking: json['dispatchTracking'] as bool? ?? false,

      deliveryPrepTimers: json['deliveryPrepTimers'] as bool? ?? false,

      swiggy: json['swiggy'] as bool? ?? false,

      zomato: json['zomato'] as bool? ?? false,

      ondc: json['ondc'] as bool? ?? false,

    );

  }

}



class DeliveryAggregatorActionResult {

  const DeliveryAggregatorActionResult({

    required this.success,

    required this.message,

  });



  final bool success;

  final String message;



  factory DeliveryAggregatorActionResult.fromJson(Map<String, dynamic> json) {

    return DeliveryAggregatorActionResult(

      success: json['success'] as bool? ?? false,

      message: json['message'] as String? ?? 'Aggregator action applied',

    );

  }

}

