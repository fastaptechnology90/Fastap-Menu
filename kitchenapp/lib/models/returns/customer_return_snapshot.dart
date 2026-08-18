class CustomerReturnSnapshot {

  const CustomerReturnSnapshot({

    required this.section,

    required this.lastSyncedAt,

    required this.returnRequests,

    required this.complaintTags,

    required this.history,

    required this.stats,

    required this.returnFeatures,

    required this.sections,

  });



  final String section;

  final DateTime lastSyncedAt;

  final List<ReturnRequest> returnRequests;

  final List<ComplaintTagEntry> complaintTags;

  final List<ReturnHistoryEntry> history;

  final ReturnStats stats;

  final ReturnFeatureFlags returnFeatures;

  final List<String> sections;



  factory CustomerReturnSnapshot.fromJson(Map<String, dynamic> json) {

    return CustomerReturnSnapshot(

      section: json['section'] as String? ?? 'All',

      lastSyncedAt: DateTime.parse(json['lastSyncedAt'] as String),

      returnRequests: (json['returnRequests'] as List<dynamic>)

          .map((item) => ReturnRequest.fromJson(item as Map<String, dynamic>))

          .toList(),

      complaintTags: (json['complaintTags'] as List<dynamic>)

          .map(

            (item) => ComplaintTagEntry.fromJson(item as Map<String, dynamic>),

          )

          .toList(),

      history: (json['history'] as List<dynamic>)

          .map(

            (item) => ReturnHistoryEntry.fromJson(item as Map<String, dynamic>),

          )

          .toList(),

      stats: ReturnStats.fromJson(json['stats'] as Map<String, dynamic>),

      returnFeatures: ReturnFeatureFlags.fromJson(

        json['returnFeatures'] as Map<String, dynamic>,

      ),

      sections: (json['sections'] as List<dynamic>)

          .map((item) => item.toString())

          .toList(),

    );

  }

}



class ReturnRequest {

  const ReturnRequest({

    required this.id,

    required this.orderId,

    required this.kotNumber,

    required this.section,

    required this.location,

    required this.dishName,

    required this.returnType,

    required this.reason,

    required this.status,

    required this.priorityRemake,

    required this.complaintTags,

    required this.availableActions,

  });



  final String id;

  final String orderId;

  final String kotNumber;

  final String section;

  final String location;

  final String dishName;

  final String returnType;

  final String reason;

  final String status;

  final bool priorityRemake;

  final List<String> complaintTags;

  final List<String> availableActions;



  factory ReturnRequest.fromJson(Map<String, dynamic> json) {

    return ReturnRequest(

      id: json['id'] as String,

      orderId: json['orderId'] as String,

      kotNumber: json['kotNumber'] as String,

      section: json['section'] as String,

      location: json['location'] as String,

      dishName: json['dishName'] as String,

      returnType: json['returnType'] as String? ?? 'refire',

      reason: json['reason'] as String,

      status: json['status'] as String? ?? 'open',

      priorityRemake: json['priorityRemake'] as bool? ?? false,

      complaintTags:

          (json['complaintTags'] as List<dynamic>? ?? const [])

              .map((item) => item.toString())

              .toList(),

      availableActions:

          (json['availableActions'] as List<dynamic>? ?? const [])

              .map((item) => item.toString())

              .toList(),

    );

  }

}



class ComplaintTagEntry {

  const ComplaintTagEntry({

    required this.id,

    required this.returnId,

    required this.orderId,

    required this.kotNumber,

    required this.tag,

    required this.severity,

    required this.loggedAt,

  });



  final String id;

  final String returnId;

  final String orderId;

  final String kotNumber;

  final String tag;

  final String severity;

  final DateTime loggedAt;



  factory ComplaintTagEntry.fromJson(Map<String, dynamic> json) {

    return ComplaintTagEntry(

      id: json['id'] as String,

      returnId: json['returnId'] as String,

      orderId: json['orderId'] as String,

      kotNumber: json['kotNumber'] as String,

      tag: json['tag'] as String,

      severity: json['severity'] as String? ?? 'medium',

      loggedAt: DateTime.parse(json['loggedAt'] as String),

    );

  }

}



class ReturnHistoryEntry {

  const ReturnHistoryEntry({

    required this.id,

    required this.orderId,

    required this.kotNumber,

    required this.section,

    required this.action,

    required this.summary,

    required this.loggedAt,

  });



  final String id;

  final String orderId;

  final String kotNumber;

  final String section;

  final String action;

  final String summary;

  final DateTime loggedAt;



  factory ReturnHistoryEntry.fromJson(Map<String, dynamic> json) {

    return ReturnHistoryEntry(

      id: json['id'] as String,

      orderId: json['orderId'] as String,

      kotNumber: json['kotNumber'] as String,

      section: json['section'] as String,

      action: json['action'] as String,

      summary: json['summary'] as String,

      loggedAt: DateTime.parse(json['loggedAt'] as String),

    );

  }

}



class ReturnStats {

  const ReturnStats({

    required this.openReturns,

    required this.priorityRemakes,

    required this.refireQueue,

    required this.complaintTags,

    required this.resolvedToday,

    required this.wrongItemCount,

    required this.burntItemCount,

  });



  final int openReturns;

  final int priorityRemakes;

  final int refireQueue;

  final int complaintTags;

  final int resolvedToday;

  final int wrongItemCount;

  final int burntItemCount;



  factory ReturnStats.fromJson(Map<String, dynamic> json) {

    return ReturnStats(

      openReturns: json['openReturns'] as int? ?? 0,

      priorityRemakes: json['priorityRemakes'] as int? ?? 0,

      refireQueue: json['refireQueue'] as int? ?? 0,

      complaintTags: json['complaintTags'] as int? ?? 0,

      resolvedToday: json['resolvedToday'] as int? ?? 0,

      wrongItemCount: json['wrongItemCount'] as int? ?? 0,

      burntItemCount: json['burntItemCount'] as int? ?? 0,

    );

  }

}



class ReturnFeatureFlags {

  const ReturnFeatureFlags({

    required this.wrongItemReplacement,

    required this.burntItemReplacement,

    required this.refireRequest,

    required this.priorityRemake,

    required this.complaintTagging,

  });



  final bool wrongItemReplacement;

  final bool burntItemReplacement;

  final bool refireRequest;

  final bool priorityRemake;

  final bool complaintTagging;



  factory ReturnFeatureFlags.fromJson(Map<String, dynamic> json) {

    return ReturnFeatureFlags(

      wrongItemReplacement: json['wrongItemReplacement'] as bool? ?? false,

      burntItemReplacement: json['burntItemReplacement'] as bool? ?? false,

      refireRequest: json['refireRequest'] as bool? ?? false,

      priorityRemake: json['priorityRemake'] as bool? ?? false,

      complaintTagging: json['complaintTagging'] as bool? ?? false,

    );

  }

}



class CustomerReturnActionResult {

  const CustomerReturnActionResult({

    required this.success,

    required this.message,

  });



  final bool success;

  final String message;



  factory CustomerReturnActionResult.fromJson(Map<String, dynamic> json) {

    return CustomerReturnActionResult(

      success: json['success'] as bool? ?? false,

      message: json['message'] as String? ?? 'Return action applied',

    );

  }

}

