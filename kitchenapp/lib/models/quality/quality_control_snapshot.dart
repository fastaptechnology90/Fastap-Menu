class QualityControlSnapshot {

  const QualityControlSnapshot({

    required this.section,

    required this.lastSyncedAt,

    required this.pendingChecks,

    required this.randomAudits,

    required this.complaints,

    required this.rejections,

    required this.stats,

    required this.qcFeatures,

    required this.sections,

  });



  final String section;

  final DateTime lastSyncedAt;

  final List<QcPendingCheck> pendingChecks;

  final List<QcRandomAudit> randomAudits;

  final List<QcComplaint> complaints;

  final List<QcRejection> rejections;

  final QcStats stats;

  final QcFeatureFlags qcFeatures;

  final List<String> sections;



  factory QualityControlSnapshot.fromJson(Map<String, dynamic> json) {

    return QualityControlSnapshot(

      section: json['section'] as String? ?? 'All',

      lastSyncedAt: DateTime.parse(json['lastSyncedAt'] as String),

      pendingChecks: (json['pendingChecks'] as List<dynamic>)

          .map((item) => QcPendingCheck.fromJson(item as Map<String, dynamic>))

          .toList(),

      randomAudits: (json['randomAudits'] as List<dynamic>)

          .map((item) => QcRandomAudit.fromJson(item as Map<String, dynamic>))

          .toList(),

      complaints: (json['complaints'] as List<dynamic>)

          .map((item) => QcComplaint.fromJson(item as Map<String, dynamic>))

          .toList(),

      rejections: (json['rejections'] as List<dynamic>)

          .map((item) => QcRejection.fromJson(item as Map<String, dynamic>))

          .toList(),

      stats: QcStats.fromJson(json['stats'] as Map<String, dynamic>),

      qcFeatures: QcFeatureFlags.fromJson(

        json['qcFeatures'] as Map<String, dynamic>,

      ),

      sections: (json['sections'] as List<dynamic>)

          .map((item) => item.toString())

          .toList(),

    );

  }

}



class QcPendingCheck {

  const QcPendingCheck({

    required this.id,

    required this.orderId,

    required this.kotNumber,

    required this.section,

    required this.location,

    required this.dishName,

    required this.status,

    required this.score,

    required this.checklist,

    required this.supervisorRequired,

    required this.assignedSupervisor,

    required this.availableActions,

  });



  final String id;

  final String orderId;

  final String kotNumber;

  final String section;

  final String location;

  final String dishName;

  final String status;

  final int score;

  final List<QcChecklistItem> checklist;

  final bool supervisorRequired;

  final String? assignedSupervisor;

  final List<String> availableActions;



  factory QcPendingCheck.fromJson(Map<String, dynamic> json) {

    return QcPendingCheck(

      id: json['id'] as String,

      orderId: json['orderId'] as String,

      kotNumber: json['kotNumber'] as String,

      section: json['section'] as String,

      location: json['location'] as String,

      dishName: json['dishName'] as String,

      status: json['status'] as String? ?? 'pending',

      score: json['score'] as int? ?? 0,

      checklist: (json['checklist'] as List<dynamic>)

          .map((item) => QcChecklistItem.fromJson(item as Map<String, dynamic>))

          .toList(),

      supervisorRequired: json['supervisorRequired'] as bool? ?? false,

      assignedSupervisor: json['assignedSupervisor'] as String?,

      availableActions:

          (json['availableActions'] as List<dynamic>? ?? const [])

              .map((item) => item.toString())

              .toList(),

    );

  }

}



class QcChecklistItem {

  const QcChecklistItem({

    required this.id,

    required this.label,

    required this.category,

    required this.passed,

    required this.required,

  });



  final String id;

  final String label;

  final String category;

  final bool? passed;

  final bool required;



  factory QcChecklistItem.fromJson(Map<String, dynamic> json) {

    return QcChecklistItem(

      id: json['id'] as String,

      label: json['label'] as String,

      category: json['category'] as String,

      passed: json['passed'] as bool?,

      required: json['required'] as bool? ?? true,

    );

  }

}



class QcRandomAudit {

  const QcRandomAudit({

    required this.id,

    required this.section,

    required this.dishName,

    required this.auditor,

    required this.triggeredAt,

    required this.score,

    required this.notes,

    required this.status,

  });



  final String id;

  final String section;

  final String dishName;

  final String auditor;

  final DateTime triggeredAt;

  final int score;

  final String notes;

  final String status;



  factory QcRandomAudit.fromJson(Map<String, dynamic> json) {

    return QcRandomAudit(

      id: json['id'] as String,

      section: json['section'] as String,

      dishName: json['dishName'] as String,

      auditor: json['auditor'] as String,

      triggeredAt: DateTime.parse(json['triggeredAt'] as String),

      score: json['score'] as int? ?? 0,

      notes: json['notes'] as String? ?? '',

      status: json['status'] as String? ?? 'open',

    );

  }

}



class QcComplaint {

  const QcComplaint({

    required this.id,

    required this.orderId,

    required this.kotNumber,

    required this.section,

    required this.reason,

    required this.severity,

    required this.loggedAt,

    required this.status,

  });



  final String id;

  final String orderId;

  final String kotNumber;

  final String section;

  final String reason;

  final String severity;

  final DateTime loggedAt;

  final String status;



  factory QcComplaint.fromJson(Map<String, dynamic> json) {

    return QcComplaint(

      id: json['id'] as String,

      orderId: json['orderId'] as String,

      kotNumber: json['kotNumber'] as String,

      section: json['section'] as String,

      reason: json['reason'] as String,

      severity: json['severity'] as String? ?? 'medium',

      loggedAt: DateTime.parse(json['loggedAt'] as String),

      status: json['status'] as String? ?? 'open',

    );

  }

}



class QcRejection {

  const QcRejection({

    required this.id,

    required this.orderId,

    required this.kotNumber,

    required this.section,

    required this.dishName,

    required this.reason,

    required this.rejectedBy,

    required this.rejectedAt,

    required this.disposition,

  });



  final String id;

  final String orderId;

  final String kotNumber;

  final String section;

  final String dishName;

  final String reason;

  final String rejectedBy;

  final DateTime rejectedAt;

  final String disposition;



  factory QcRejection.fromJson(Map<String, dynamic> json) {

    return QcRejection(

      id: json['id'] as String,

      orderId: json['orderId'] as String,

      kotNumber: json['kotNumber'] as String,

      section: json['section'] as String,

      dishName: json['dishName'] as String,

      reason: json['reason'] as String,

      rejectedBy: json['rejectedBy'] as String,

      rejectedAt: DateTime.parse(json['rejectedAt'] as String),

      disposition: json['disposition'] as String? ?? 'Waste log',

    );

  }

}



class QcStats {

  const QcStats({

    required this.pendingChecks,

    required this.awaitingSupervisor,

    required this.passRate,

    required this.averageScore,

    required this.openComplaints,

    required this.rejectionsToday,

    required this.randomAudits,

  });



  final int pendingChecks;

  final int awaitingSupervisor;

  final int passRate;

  final int averageScore;

  final int openComplaints;

  final int rejectionsToday;

  final int randomAudits;



  factory QcStats.fromJson(Map<String, dynamic> json) {

    return QcStats(

      pendingChecks: json['pendingChecks'] as int? ?? 0,

      awaitingSupervisor: json['awaitingSupervisor'] as int? ?? 0,

      passRate: json['passRate'] as int? ?? 0,

      averageScore: json['averageScore'] as int? ?? 0,

      openComplaints: json['openComplaints'] as int? ?? 0,

      rejectionsToday: json['rejectionsToday'] as int? ?? 0,

      randomAudits: json['randomAudits'] as int? ?? 0,

    );

  }

}



class QcFeatureFlags {

  const QcFeatureFlags({

    required this.foodQualityChecklist,

    required this.presentationValidation,

    required this.temperatureValidation,

    required this.hygieneValidation,

    required this.supervisorApproval,

    required this.randomAudits,

    required this.qcScoring,

    required this.complaintTracking,

    required this.rejectedFoodTracking,

  });



  final bool foodQualityChecklist;

  final bool presentationValidation;

  final bool temperatureValidation;

  final bool hygieneValidation;

  final bool supervisorApproval;

  final bool randomAudits;

  final bool qcScoring;

  final bool complaintTracking;

  final bool rejectedFoodTracking;



  factory QcFeatureFlags.fromJson(Map<String, dynamic> json) {

    return QcFeatureFlags(

      foodQualityChecklist: json['foodQualityChecklist'] as bool? ?? false,

      presentationValidation: json['presentationValidation'] as bool? ?? false,

      temperatureValidation: json['temperatureValidation'] as bool? ?? false,

      hygieneValidation: json['hygieneValidation'] as bool? ?? false,

      supervisorApproval: json['supervisorApproval'] as bool? ?? false,

      randomAudits: json['randomAudits'] as bool? ?? false,

      qcScoring: json['qcScoring'] as bool? ?? false,

      complaintTracking: json['complaintTracking'] as bool? ?? false,

      rejectedFoodTracking: json['rejectedFoodTracking'] as bool? ?? false,

    );

  }

}



class QualityControlActionResult {

  const QualityControlActionResult({

    required this.success,

    required this.message,

  });



  final bool success;

  final String message;



  factory QualityControlActionResult.fromJson(Map<String, dynamic> json) {

    return QualityControlActionResult(

      success: json['success'] as bool? ?? false,

      message: json['message'] as String? ?? 'QC action applied',

    );

  }

}

