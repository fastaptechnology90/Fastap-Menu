class PackingDeliverySnapshot {

  const PackingDeliverySnapshot({

    required this.section,

    required this.lastSyncedAt,

    required this.packingJobs,

    required this.stats,

    required this.packingFeatures,

    required this.sections,

  });



  final String section;

  final DateTime lastSyncedAt;

  final List<PackingJob> packingJobs;

  final PackingStats stats;

  final PackingFeatureFlags packingFeatures;

  final List<String> sections;



  factory PackingDeliverySnapshot.fromJson(Map<String, dynamic> json) {

    return PackingDeliverySnapshot(

      section: json['section'] as String? ?? 'All',

      lastSyncedAt: DateTime.parse(json['lastSyncedAt'] as String),

      packingJobs: (json['packingJobs'] as List<dynamic>)

          .map((item) => PackingJob.fromJson(item as Map<String, dynamic>))

          .toList(),

      stats: PackingStats.fromJson(json['stats'] as Map<String, dynamic>),

      packingFeatures: PackingFeatureFlags.fromJson(

        json['packingFeatures'] as Map<String, dynamic>,

      ),

      sections: (json['sections'] as List<dynamic>)

          .map((item) => item.toString())

          .toList(),

    );

  }

}



class PackingJob {

  const PackingJob({

    required this.id,

    required this.orderId,

    required this.kotNumber,

    required this.section,

    required this.location,

    required this.deliveryType,

    required this.packingType,

    required this.customerName,

    required this.itemsSummary,

    required this.status,

    required this.spillProofChecked,

    required this.labelsPrinted,

    required this.label,

    required this.availableActions,

  });



  final String id;

  final String orderId;

  final String kotNumber;

  final String section;

  final String location;

  final String deliveryType;

  final String packingType;

  final String customerName;

  final String itemsSummary;

  final String status;

  final bool spillProofChecked;

  final bool labelsPrinted;

  final PackingLabel label;

  final List<String> availableActions;



  factory PackingJob.fromJson(Map<String, dynamic> json) {

    return PackingJob(

      id: json['id'] as String,

      orderId: json['orderId'] as String,

      kotNumber: json['kotNumber'] as String,

      section: json['section'] as String,

      location: json['location'] as String,

      deliveryType: json['deliveryType'] as String,

      packingType: json['packingType'] as String? ?? 'delivery',

      customerName: json['customerName'] as String? ?? 'Guest',

      itemsSummary: json['itemsSummary'] as String,

      status: json['status'] as String? ?? 'queued',

      spillProofChecked: json['spillProofChecked'] as bool? ?? false,

      labelsPrinted: json['labelsPrinted'] as bool? ?? false,

      label: PackingLabel.fromJson(json['label'] as Map<String, dynamic>),

      availableActions:

          (json['availableActions'] as List<dynamic>? ?? const [])

              .map((item) => item.toString())

              .toList(),

    );

  }

}



class PackingLabel {

  const PackingLabel({

    required this.customerName,

    required this.orderId,

    required this.deliveryType,

    required this.allergyNotes,

    required this.specialInstructions,

  });



  final String customerName;

  final String orderId;

  final String deliveryType;

  final String allergyNotes;

  final String specialInstructions;



  factory PackingLabel.fromJson(Map<String, dynamic> json) {

    return PackingLabel(

      customerName: json['customerName'] as String? ?? 'Guest',

      orderId: json['orderId'] as String,

      deliveryType: json['deliveryType'] as String,

      allergyNotes: json['allergyNotes'] as String? ?? 'None',

      specialInstructions: json['specialInstructions'] as String? ?? '',

    );

  }

}



class PackingStats {

  const PackingStats({

    required this.queuedJobs,

    required this.inProgress,

    required this.completedToday,

    required this.deliveryPacks,

    required this.roomServicePacks,

    required this.takeawayPacks,

    required this.eventPacks,

    required this.spillProofChecks,

  });



  final int queuedJobs;

  final int inProgress;

  final int completedToday;

  final int deliveryPacks;

  final int roomServicePacks;

  final int takeawayPacks;

  final int eventPacks;

  final int spillProofChecks;



  factory PackingStats.fromJson(Map<String, dynamic> json) {

    return PackingStats(

      queuedJobs: json['queuedJobs'] as int? ?? 0,

      inProgress: json['inProgress'] as int? ?? 0,

      completedToday: json['completedToday'] as int? ?? 0,

      deliveryPacks: json['deliveryPacks'] as int? ?? 0,

      roomServicePacks: json['roomServicePacks'] as int? ?? 0,

      takeawayPacks: json['takeawayPacks'] as int? ?? 0,

      eventPacks: json['eventPacks'] as int? ?? 0,

      spillProofChecks: json['spillProofChecks'] as int? ?? 0,

    );

  }

}



class PackingFeatureFlags {

  const PackingFeatureFlags({

    required this.deliveryPacking,

    required this.roomServicePacking,

    required this.takeawayPacking,

    required this.eventPacking,

    required this.spillProofChecks,

    required this.packingLabels,

  });



  final bool deliveryPacking;

  final bool roomServicePacking;

  final bool takeawayPacking;

  final bool eventPacking;

  final bool spillProofChecks;

  final bool packingLabels;



  factory PackingFeatureFlags.fromJson(Map<String, dynamic> json) {

    return PackingFeatureFlags(

      deliveryPacking: json['deliveryPacking'] as bool? ?? false,

      roomServicePacking: json['roomServicePacking'] as bool? ?? false,

      takeawayPacking: json['takeawayPacking'] as bool? ?? false,

      eventPacking: json['eventPacking'] as bool? ?? false,

      spillProofChecks: json['spillProofChecks'] as bool? ?? false,

      packingLabels: json['packingLabels'] as bool? ?? false,

    );

  }

}



class PackingActionResult {

  const PackingActionResult({

    required this.success,

    required this.message,

  });



  final bool success;

  final String message;



  factory PackingActionResult.fromJson(Map<String, dynamic> json) {

    return PackingActionResult(

      success: json['success'] as bool? ?? false,

      message: json['message'] as String? ?? 'Packing action applied',

    );

  }

}

