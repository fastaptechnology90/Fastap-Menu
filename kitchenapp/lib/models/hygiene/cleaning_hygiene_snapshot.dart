class CleaningHygieneSnapshot {
  const CleaningHygieneSnapshot({
    required this.section,
    required this.lastSyncedAt,
    required this.cleaningSchedules,
    required this.hygieneChecklists,
    required this.sanitizationTasks,
    required this.foodSafetyEntries,
    required this.deepCleaningJobs,
    required this.complianceRecords,
    required this.stats,
    required this.hygieneFeatures,
    required this.sections,
  });

  final String section;
  final DateTime lastSyncedAt;
  final List<CleaningSchedule> cleaningSchedules;
  final List<HygieneChecklist> hygieneChecklists;
  final List<SanitizationTask> sanitizationTasks;
  final List<FoodSafetyEntry> foodSafetyEntries;
  final List<DeepCleaningJob> deepCleaningJobs;
  final List<ComplianceRecord> complianceRecords;
  final CleaningHygieneStats stats;
  final CleaningHygieneFeatureFlags hygieneFeatures;
  final List<String> sections;

  factory CleaningHygieneSnapshot.fromJson(Map<String, dynamic> json) {
    return CleaningHygieneSnapshot(
      section: json['section'] as String? ?? 'All',
      lastSyncedAt: DateTime.parse(json['lastSyncedAt'] as String),
      cleaningSchedules: (json['cleaningSchedules'] as List<dynamic>)
          .map((item) => CleaningSchedule.fromJson(item as Map<String, dynamic>))
          .toList(),
      hygieneChecklists: (json['hygieneChecklists'] as List<dynamic>)
          .map((item) => HygieneChecklist.fromJson(item as Map<String, dynamic>))
          .toList(),
      sanitizationTasks: (json['sanitizationTasks'] as List<dynamic>)
          .map((item) => SanitizationTask.fromJson(item as Map<String, dynamic>))
          .toList(),
      foodSafetyEntries: (json['foodSafetyEntries'] as List<dynamic>)
          .map((item) => FoodSafetyEntry.fromJson(item as Map<String, dynamic>))
          .toList(),
      deepCleaningJobs: (json['deepCleaningJobs'] as List<dynamic>)
          .map((item) => DeepCleaningJob.fromJson(item as Map<String, dynamic>))
          .toList(),
      complianceRecords: (json['complianceRecords'] as List<dynamic>)
          .map((item) => ComplianceRecord.fromJson(item as Map<String, dynamic>))
          .toList(),
      stats: CleaningHygieneStats.fromJson(json['stats'] as Map<String, dynamic>),
      hygieneFeatures: CleaningHygieneFeatureFlags.fromJson(
        json['hygieneFeatures'] as Map<String, dynamic>,
      ),
      sections: (json['sections'] as List<dynamic>)
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class CleaningSchedule {
  const CleaningSchedule({
    required this.id,
    required this.taskName,
    required this.section,
    required this.frequency,
    required this.scheduledTime,
    required this.assignedStaff,
    required this.status,
    required this.availableActions,
  });

  final String id;
  final String taskName;
  final String section;
  final String frequency;
  final String scheduledTime;
  final String assignedStaff;
  final String status;
  final List<String> availableActions;

  factory CleaningSchedule.fromJson(Map<String, dynamic> json) {
    return CleaningSchedule(
      id: json['id'] as String,
      taskName: json['taskName'] as String,
      section: json['section'] as String,
      frequency: json['frequency'] as String? ?? 'Daily',
      scheduledTime: json['scheduledTime'] as String? ?? '06:00',
      assignedStaff: json['assignedStaff'] as String? ?? 'Unassigned',
      status: json['status'] as String? ?? 'scheduled',
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class HygieneChecklist {
  const HygieneChecklist({
    required this.id,
    required this.title,
    required this.section,
    required this.itemsCompleted,
    required this.totalItems,
    required this.status,
    required this.availableActions,
  });

  final String id;
  final String title;
  final String section;
  final int itemsCompleted;
  final int totalItems;
  final String status;
  final List<String> availableActions;

  factory HygieneChecklist.fromJson(Map<String, dynamic> json) {
    return HygieneChecklist(
      id: json['id'] as String,
      title: json['title'] as String,
      section: json['section'] as String,
      itemsCompleted: json['itemsCompleted'] as int? ?? 0,
      totalItems: json['totalItems'] as int? ?? 0,
      status: json['status'] as String? ?? 'pending',
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class SanitizationTask {
  const SanitizationTask({
    required this.id,
    required this.equipmentName,
    required this.section,
    required this.lastSanitized,
    required this.dueInMinutes,
    required this.status,
    required this.availableActions,
  });

  final String id;
  final String equipmentName;
  final String section;
  final String lastSanitized;
  final int dueInMinutes;
  final String status;
  final List<String> availableActions;

  factory SanitizationTask.fromJson(Map<String, dynamic> json) {
    return SanitizationTask(
      id: json['id'] as String,
      equipmentName: json['equipmentName'] as String,
      section: json['section'] as String,
      lastSanitized: json['lastSanitized'] as String? ?? 'Unknown',
      dueInMinutes: json['dueInMinutes'] as int? ?? 0,
      status: json['status'] as String? ?? 'due',
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class FoodSafetyEntry {
  const FoodSafetyEntry({
    required this.id,
    required this.checkType,
    required this.section,
    required this.reading,
    required this.threshold,
    required this.status,
  });

  final String id;
  final String checkType;
  final String section;
  final String reading;
  final String threshold;
  final String status;

  factory FoodSafetyEntry.fromJson(Map<String, dynamic> json) {
    return FoodSafetyEntry(
      id: json['id'] as String,
      checkType: json['checkType'] as String,
      section: json['section'] as String,
      reading: json['reading'] as String? ?? '',
      threshold: json['threshold'] as String? ?? '',
      status: json['status'] as String? ?? 'ok',
    );
  }
}

class DeepCleaningJob {
  const DeepCleaningJob({
    required this.id,
    required this.areaName,
    required this.section,
    required this.scheduledDate,
    required this.assignedTeam,
    required this.status,
    required this.availableActions,
  });

  final String id;
  final String areaName;
  final String section;
  final String scheduledDate;
  final String assignedTeam;
  final String status;
  final List<String> availableActions;

  factory DeepCleaningJob.fromJson(Map<String, dynamic> json) {
    return DeepCleaningJob(
      id: json['id'] as String,
      areaName: json['areaName'] as String,
      section: json['section'] as String,
      scheduledDate: json['scheduledDate'] as String? ?? 'Today',
      assignedTeam: json['assignedTeam'] as String? ?? 'Hygiene team',
      status: json['status'] as String? ?? 'scheduled',
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class ComplianceRecord {
  const ComplianceRecord({
    required this.id,
    required this.recordType,
    required this.title,
    required this.section,
    required this.lastUpdated,
    required this.status,
    required this.availableActions,
  });

  final String id;
  final String recordType;
  final String title;
  final String section;
  final String lastUpdated;
  final String status;
  final List<String> availableActions;

  factory ComplianceRecord.fromJson(Map<String, dynamic> json) {
    return ComplianceRecord(
      id: json['id'] as String,
      recordType: json['recordType'] as String? ?? 'audit',
      title: json['title'] as String,
      section: json['section'] as String? ?? 'All',
      lastUpdated: json['lastUpdated'] as String? ?? 'Today',
      status: json['status'] as String? ?? 'compliant',
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class CleaningHygieneStats {
  const CleaningHygieneStats({
    required this.scheduledTasks,
    required this.checklistsOpen,
    required this.sanitizationDue,
    required this.foodSafetyAlerts,
    required this.deepCleanPending,
    required this.complianceIssues,
    required this.completedToday,
  });

  final int scheduledTasks;
  final int checklistsOpen;
  final int sanitizationDue;
  final int foodSafetyAlerts;
  final int deepCleanPending;
  final int complianceIssues;
  final int completedToday;

  factory CleaningHygieneStats.fromJson(Map<String, dynamic> json) {
    return CleaningHygieneStats(
      scheduledTasks: json['scheduledTasks'] as int? ?? 0,
      checklistsOpen: json['checklistsOpen'] as int? ?? 0,
      sanitizationDue: json['sanitizationDue'] as int? ?? 0,
      foodSafetyAlerts: json['foodSafetyAlerts'] as int? ?? 0,
      deepCleanPending: json['deepCleanPending'] as int? ?? 0,
      complianceIssues: json['complianceIssues'] as int? ?? 0,
      completedToday: json['completedToday'] as int? ?? 0,
    );
  }
}

class CleaningHygieneFeatureFlags {
  const CleaningHygieneFeatureFlags({
    required this.cleaningSchedules,
    required this.hygieneChecklists,
    required this.equipmentSanitization,
    required this.foodSafetyTracking,
    required this.deepCleaningManagement,
    required this.fssaiSopTracking,
    required this.hygieneAuditLogs,
    required this.staffHygieneVerification,
  });

  final bool cleaningSchedules;
  final bool hygieneChecklists;
  final bool equipmentSanitization;
  final bool foodSafetyTracking;
  final bool deepCleaningManagement;
  final bool fssaiSopTracking;
  final bool hygieneAuditLogs;
  final bool staffHygieneVerification;

  factory CleaningHygieneFeatureFlags.fromJson(Map<String, dynamic> json) {
    return CleaningHygieneFeatureFlags(
      cleaningSchedules: json['cleaningSchedules'] as bool? ?? false,
      hygieneChecklists: json['hygieneChecklists'] as bool? ?? false,
      equipmentSanitization: json['equipmentSanitization'] as bool? ?? false,
      foodSafetyTracking: json['foodSafetyTracking'] as bool? ?? false,
      deepCleaningManagement:
          json['deepCleaningManagement'] as bool? ?? false,
      fssaiSopTracking: json['fssaiSopTracking'] as bool? ?? false,
      hygieneAuditLogs: json['hygieneAuditLogs'] as bool? ?? false,
      staffHygieneVerification:
          json['staffHygieneVerification'] as bool? ?? false,
    );
  }
}

class CleaningHygieneActionResult {
  const CleaningHygieneActionResult({
    required this.success,
    required this.message,
  });

  final bool success;
  final String message;

  factory CleaningHygieneActionResult.fromJson(Map<String, dynamic> json) {
    return CleaningHygieneActionResult(
      success: json['success'] as bool? ?? false,
      message: json['message'] as String? ?? 'Hygiene action applied',
    );
  }
}
