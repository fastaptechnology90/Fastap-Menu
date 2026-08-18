class BakeryDessertSnapshot {

  const BakeryDessertSnapshot({

    required this.section,

    required this.lastSyncedAt,

    required this.dessertQueue,

    required this.productionBatches,

    required this.eventPlans,

    required this.stats,

    required this.bakeryFeatures,

    required this.sections,

  });



  final String section;

  final DateTime lastSyncedAt;

  final List<DessertJob> dessertQueue;

  final List<ProductionBatch> productionBatches;

  final List<EventDessertPlan> eventPlans;

  final BakeryDessertStats stats;

  final BakeryFeatureFlags bakeryFeatures;

  final List<String> sections;



  factory BakeryDessertSnapshot.fromJson(Map<String, dynamic> json) {

    return BakeryDessertSnapshot(

      section: json['section'] as String? ?? 'All',

      lastSyncedAt: DateTime.parse(json['lastSyncedAt'] as String),

      dessertQueue: (json['dessertQueue'] as List<dynamic>)

          .map((item) => DessertJob.fromJson(item as Map<String, dynamic>))

          .toList(),

      productionBatches: (json['productionBatches'] as List<dynamic>)

          .map((item) => ProductionBatch.fromJson(item as Map<String, dynamic>))

          .toList(),

      eventPlans: (json['eventPlans'] as List<dynamic>)

          .map((item) => EventDessertPlan.fromJson(item as Map<String, dynamic>))

          .toList(),

      stats: BakeryDessertStats.fromJson(json['stats'] as Map<String, dynamic>),

      bakeryFeatures: BakeryFeatureFlags.fromJson(

        json['bakeryFeatures'] as Map<String, dynamic>,

      ),

      sections: (json['sections'] as List<dynamic>)

          .map((item) => item.toString())

          .toList(),

    );

  }

}



class DessertJob {

  const DessertJob({

    required this.id,

    required this.orderId,

    required this.kotNumber,

    required this.section,

    required this.location,

    required this.itemName,

    required this.jobType,

    required this.customization,

    required this.status,

    required this.batchSize,

    required this.timerSeconds,

    required this.timerLabel,

    required this.availableActions,

  });



  final String id;

  final String orderId;

  final String kotNumber;

  final String section;

  final String location;

  final String itemName;

  final String jobType;

  final String customization;

  final String status;

  final int batchSize;

  final int timerSeconds;

  final String timerLabel;

  final List<String> availableActions;



  factory DessertJob.fromJson(Map<String, dynamic> json) {

    return DessertJob(

      id: json['id'] as String,

      orderId: json['orderId'] as String,

      kotNumber: json['kotNumber'] as String,

      section: json['section'] as String,

      location: json['location'] as String,

      itemName: json['itemName'] as String,

      jobType: json['jobType'] as String? ?? 'dessert',

      customization: json['customization'] as String? ?? 'Standard',

      status: json['status'] as String? ?? 'queued',

      batchSize: json['batchSize'] as int? ?? 1,

      timerSeconds: json['timerSeconds'] as int? ?? 0,

      timerLabel: json['timerLabel'] as String? ?? '00:00',

      availableActions:

          (json['availableActions'] as List<dynamic>? ?? const [])

              .map((item) => item.toString())

              .toList(),

    );

  }

}



class ProductionBatch {

  const ProductionBatch({

    required this.id,

    required this.itemName,

    required this.quantity,

    required this.status,

    required this.expiryMinutes,

    required this.section,

  });



  final String id;

  final String itemName;

  final int quantity;

  final String status;

  final int expiryMinutes;

  final String section;



  factory ProductionBatch.fromJson(Map<String, dynamic> json) {

    return ProductionBatch(

      id: json['id'] as String,

      itemName: json['itemName'] as String,

      quantity: json['quantity'] as int? ?? 0,

      status: json['status'] as String? ?? 'baking',

      expiryMinutes: json['expiryMinutes'] as int? ?? 0,

      section: json['section'] as String? ?? 'Bakery',

    );

  }

}



class EventDessertPlan {

  const EventDessertPlan({

    required this.id,

    required this.eventName,

    required this.location,

    required this.items,

    required this.totalServings,

    required this.status,

  });



  final String id;

  final String eventName;

  final String location;

  final List<String> items;

  final int totalServings;

  final String status;



  factory EventDessertPlan.fromJson(Map<String, dynamic> json) {

    return EventDessertPlan(

      id: json['id'] as String,

      eventName: json['eventName'] as String,

      location: json['location'] as String,

      items: (json['items'] as List<dynamic>)

          .map((item) => item.toString())

          .toList(),

      totalServings: json['totalServings'] as int? ?? 0,

      status: json['status'] as String? ?? 'planned',

    );

  }

}



class BakeryDessertStats {

  const BakeryDessertStats({

    required this.queuedJobs,

    required this.inProduction,

    required this.customCakes,

    required this.eventPlans,

    required this.completedToday,

    required this.activeBatches,

  });



  final int queuedJobs;

  final int inProduction;

  final int customCakes;

  final int eventPlans;

  final int completedToday;

  final int activeBatches;



  factory BakeryDessertStats.fromJson(Map<String, dynamic> json) {

    return BakeryDessertStats(

      queuedJobs: json['queuedJobs'] as int? ?? 0,

      inProduction: json['inProduction'] as int? ?? 0,

      customCakes: json['customCakes'] as int? ?? 0,

      eventPlans: json['eventPlans'] as int? ?? 0,

      completedToday: json['completedToday'] as int? ?? 0,

      activeBatches: json['activeBatches'] as int? ?? 0,

    );

  }

}



class BakeryFeatureFlags {

  const BakeryFeatureFlags({

    required this.dessertPreparationQueue,

    required this.bakeryProductionTracking,

    required this.cakeCustomization,

    required this.eventDessertPlanning,

  });



  final bool dessertPreparationQueue;

  final bool bakeryProductionTracking;

  final bool cakeCustomization;

  final bool eventDessertPlanning;



  factory BakeryFeatureFlags.fromJson(Map<String, dynamic> json) {

    return BakeryFeatureFlags(

      dessertPreparationQueue:

          json['dessertPreparationQueue'] as bool? ?? false,

      bakeryProductionTracking:

          json['bakeryProductionTracking'] as bool? ?? false,

      cakeCustomization: json['cakeCustomization'] as bool? ?? false,

      eventDessertPlanning: json['eventDessertPlanning'] as bool? ?? false,

    );

  }

}



class BakeryDessertActionResult {

  const BakeryDessertActionResult({

    required this.success,

    required this.message,

  });



  final bool success;

  final String message;



  factory BakeryDessertActionResult.fromJson(Map<String, dynamic> json) {

    return BakeryDessertActionResult(

      success: json['success'] as bool? ?? false,

      message: json['message'] as String? ?? 'Bakery action applied',

    );

  }

}

