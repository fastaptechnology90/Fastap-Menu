class ExpeditorSnapshot {

  const ExpeditorSnapshot({

    required this.section,

    required this.lastSyncedAt,

    required this.tickets,

    required this.coordinationGroups,

    required this.tableSync,

    required this.stats,

    required this.expeditorFeatures,

    required this.sections,

  });



  final String section;

  final DateTime lastSyncedAt;

  final List<ExpeditorTicket> tickets;

  final List<CoordinationGroup> coordinationGroups;

  final List<TableSyncEntry> tableSync;

  final ExpeditorStats stats;

  final ExpeditorFeatureFlags expeditorFeatures;

  final List<String> sections;



  factory ExpeditorSnapshot.fromJson(Map<String, dynamic> json) {

    return ExpeditorSnapshot(

      section: json['section'] as String? ?? 'All',

      lastSyncedAt: DateTime.parse(json['lastSyncedAt'] as String),

      tickets: (json['tickets'] as List<dynamic>)

          .map((item) => ExpeditorTicket.fromJson(item as Map<String, dynamic>))

          .toList(),

      coordinationGroups: (json['coordinationGroups'] as List<dynamic>)

          .map(

            (item) => CoordinationGroup.fromJson(item as Map<String, dynamic>),

          )

          .toList(),

      tableSync: (json['tableSync'] as List<dynamic>)

          .map((item) => TableSyncEntry.fromJson(item as Map<String, dynamic>))

          .toList(),

      stats: ExpeditorStats.fromJson(json['stats'] as Map<String, dynamic>),

      expeditorFeatures: ExpeditorFeatureFlags.fromJson(

        json['expeditorFeatures'] as Map<String, dynamic>,

      ),

      sections: (json['sections'] as List<dynamic>)

          .map((item) => item.toString())

          .toList(),

    );

  }

}



class ExpeditorTicket {

  const ExpeditorTicket({

    required this.id,

    required this.orderId,

    required this.kotNumber,

    required this.section,

    required this.location,

    required this.tableNumber,

    required this.deliveryType,

    required this.summary,

    required this.status,

    required this.finalValidated,

    required this.packagingVerified,

    required this.dispatchApproved,

    required this.availableActions,

  });



  final String id;

  final String orderId;

  final String kotNumber;

  final String section;

  final String location;

  final String? tableNumber;

  final String deliveryType;

  final String summary;

  final String status;

  final bool finalValidated;

  final bool packagingVerified;

  final bool dispatchApproved;

  final List<String> availableActions;



  factory ExpeditorTicket.fromJson(Map<String, dynamic> json) {

    return ExpeditorTicket(

      id: json['id'] as String,

      orderId: json['orderId'] as String,

      kotNumber: json['kotNumber'] as String,

      section: json['section'] as String,

      location: json['location'] as String,

      tableNumber: json['tableNumber'] as String?,

      deliveryType: json['deliveryType'] as String,

      summary: json['summary'] as String,

      status: json['status'] as String? ?? 'awaiting_validation',

      finalValidated: json['finalValidated'] as bool? ?? false,

      packagingVerified: json['packagingVerified'] as bool? ?? false,

      dispatchApproved: json['dispatchApproved'] as bool? ?? false,

      availableActions:

          (json['availableActions'] as List<dynamic>? ?? const [])

              .map((item) => item.toString())

              .toList(),

    );

  }

}



class CoordinationGroup {

  const CoordinationGroup({

    required this.id,

    required this.location,

    required this.tableNumber,

    required this.sections,

    required this.syncStatus,

    required this.allReady,

  });



  final String id;

  final String location;

  final String? tableNumber;

  final List<CoordinationSection> sections;

  final String syncStatus;

  final bool allReady;



  factory CoordinationGroup.fromJson(Map<String, dynamic> json) {

    return CoordinationGroup(

      id: json['id'] as String,

      location: json['location'] as String,

      tableNumber: json['tableNumber'] as String?,

      sections: (json['sections'] as List<dynamic>)

          .map(

            (item) => CoordinationSection.fromJson(item as Map<String, dynamic>),

          )

          .toList(),

      syncStatus: json['syncStatus'] as String? ?? 'pending',

      allReady: json['allReady'] as bool? ?? false,

    );

  }

}



class CoordinationSection {

  const CoordinationSection({

    required this.section,

    required this.kotNumber,

    required this.status,

  });



  final String section;

  final String kotNumber;

  final String status;



  factory CoordinationSection.fromJson(Map<String, dynamic> json) {

    return CoordinationSection(

      section: json['section'] as String,

      kotNumber: json['kotNumber'] as String,

      status: json['status'] as String,

    );

  }

}



class TableSyncEntry {

  const TableSyncEntry({

    required this.tableNumber,

    required this.location,

    required this.kotCount,

    required this.syncStatus,

    required this.lastSyncedAt,

  });



  final String tableNumber;

  final String location;

  final int kotCount;

  final String syncStatus;

  final DateTime lastSyncedAt;



  factory TableSyncEntry.fromJson(Map<String, dynamic> json) {

    return TableSyncEntry(

      tableNumber: json['tableNumber'] as String,

      location: json['location'] as String? ?? '',

      kotCount: json['kotCount'] as int? ?? 0,

      syncStatus: json['syncStatus'] as String? ?? 'pending',

      lastSyncedAt: DateTime.parse(json['lastSyncedAt'] as String),

    );

  }

}



class ExpeditorStats {

  const ExpeditorStats({

    required this.awaitingValidation,

    required this.coordinationGroups,

    required this.packagingChecks,

    required this.dispatchReady,

    required this.dispatchedToday,

    required this.tablesSynced,

  });



  final int awaitingValidation;

  final int coordinationGroups;

  final int packagingChecks;

  final int dispatchReady;

  final int dispatchedToday;

  final int tablesSynced;



  factory ExpeditorStats.fromJson(Map<String, dynamic> json) {

    return ExpeditorStats(

      awaitingValidation: json['awaitingValidation'] as int? ?? 0,

      coordinationGroups: json['coordinationGroups'] as int? ?? 0,

      packagingChecks: json['packagingChecks'] as int? ?? 0,

      dispatchReady: json['dispatchReady'] as int? ?? 0,

      dispatchedToday: json['dispatchedToday'] as int? ?? 0,

      tablesSynced: json['tablesSynced'] as int? ?? 0,

    );

  }

}



class ExpeditorFeatureFlags {

  const ExpeditorFeatureFlags({

    required this.finalOrderValidation,

    required this.multiSectionCoordination,

    required this.tableSynchronization,

    required this.dispatchApproval,

    required this.packagingVerification,

  });



  final bool finalOrderValidation;

  final bool multiSectionCoordination;

  final bool tableSynchronization;

  final bool dispatchApproval;

  final bool packagingVerification;



  factory ExpeditorFeatureFlags.fromJson(Map<String, dynamic> json) {

    return ExpeditorFeatureFlags(

      finalOrderValidation: json['finalOrderValidation'] as bool? ?? false,

      multiSectionCoordination: json['multiSectionCoordination'] as bool? ?? false,

      tableSynchronization: json['tableSynchronization'] as bool? ?? false,

      dispatchApproval: json['dispatchApproval'] as bool? ?? false,

      packagingVerification: json['packagingVerification'] as bool? ?? false,

    );

  }

}



class ExpeditorActionResult {

  const ExpeditorActionResult({

    required this.success,

    required this.message,

  });



  final bool success;

  final String message;



  factory ExpeditorActionResult.fromJson(Map<String, dynamic> json) {

    return ExpeditorActionResult(

      success: json['success'] as bool? ?? false,

      message: json['message'] as String? ?? 'Expeditor action applied',

    );

  }

}

