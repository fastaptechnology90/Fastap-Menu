class AllergySafetySnapshot {
  const AllergySafetySnapshot({
    required this.section,
    required this.lastSyncedAt,
    required this.cases,
    required this.allergyTypes,
    required this.stats,
    required this.safetyFeatures,
    required this.sections,
  });

  final String section;
  final DateTime lastSyncedAt;
  final List<SafetyCase> cases;
  final List<String> allergyTypes;
  final SafetyStats stats;
  final SafetyFeatureFlags safetyFeatures;
  final List<String> sections;

  factory AllergySafetySnapshot.fromJson(Map<String, dynamic> json) {
    return AllergySafetySnapshot(
      section: json['section'] as String? ?? 'All',
      lastSyncedAt: DateTime.parse(json['lastSyncedAt'] as String),
      cases: (json['cases'] as List<dynamic>)
          .map((item) => SafetyCase.fromJson(item as Map<String, dynamic>))
          .toList(),
      allergyTypes: (json['allergyTypes'] as List<dynamic>)
          .map((item) => item.toString())
          .toList(),
      stats: SafetyStats.fromJson(json['stats'] as Map<String, dynamic>),
      safetyFeatures: SafetyFeatureFlags.fromJson(
        json['safetyFeatures'] as Map<String, dynamic>,
      ),
      sections: (json['sections'] as List<dynamic>)
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class SafetyCase {
  const SafetyCase({
    required this.id,
    required this.orderId,
    required this.kotNumber,
    required this.location,
    required this.section,
    required this.assignedChef,
    required this.status,
    required this.statusLabel,
    required this.allergyTypes,
    required this.severity,
    required this.colorCode,
    required this.crossContaminationRisk,
    required this.dedicatedPrepRequired,
    required this.chefConfirmed,
    required this.sopAcknowledged,
    required this.escalated,
    required this.vip,
    required this.items,
    required this.warnings,
    required this.availableActions,
  });

  final String id;
  final String orderId;
  final String kotNumber;
  final String location;
  final String section;
  final String assignedChef;
  final String status;
  final String statusLabel;
  final List<String> allergyTypes;
  final String severity;
  final String colorCode;
  final bool crossContaminationRisk;
  final bool dedicatedPrepRequired;
  final bool chefConfirmed;
  final bool sopAcknowledged;
  final bool escalated;
  final bool vip;
  final List<String> items;
  final List<String> warnings;
  final List<String> availableActions;

  factory SafetyCase.fromJson(Map<String, dynamic> json) {
    return SafetyCase(
      id: json['id'] as String,
      orderId: json['orderId'] as String,
      kotNumber: json['kotNumber'] as String,
      location: json['location'] as String,
      section: json['section'] as String,
      assignedChef: json['assignedChef'] as String,
      status: json['status'] as String,
      statusLabel: json['statusLabel'] as String,
      allergyTypes: (json['allergyTypes'] as List<dynamic>)
          .map((item) => item.toString())
          .toList(),
      severity: json['severity'] as String,
      colorCode: json['colorCode'] as String,
      crossContaminationRisk: json['crossContaminationRisk'] as bool? ?? false,
      dedicatedPrepRequired: json['dedicatedPrepRequired'] as bool? ?? false,
      chefConfirmed: json['chefConfirmed'] as bool? ?? false,
      sopAcknowledged: json['sopAcknowledged'] as bool? ?? false,
      escalated: json['escalated'] as bool? ?? false,
      vip: json['vip'] as bool? ?? false,
      items: (json['items'] as List<dynamic>).map((item) => item.toString()).toList(),
      warnings: (json['warnings'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class SafetyStats {
  const SafetyStats({
    required this.totalCases,
    required this.activeCases,
    required this.pendingChefConfirm,
    required this.pendingSopAck,
    required this.crossContaminationAlerts,
    required this.criticalCases,
  });

  final int totalCases;
  final int activeCases;
  final int pendingChefConfirm;
  final int pendingSopAck;
  final int crossContaminationAlerts;
  final int criticalCases;

  factory SafetyStats.fromJson(Map<String, dynamic> json) {
    return SafetyStats(
      totalCases: json['totalCases'] as int? ?? 0,
      activeCases: json['activeCases'] as int? ?? 0,
      pendingChefConfirm: json['pendingChefConfirm'] as int? ?? 0,
      pendingSopAck: json['pendingSopAck'] as int? ?? 0,
      crossContaminationAlerts: json['crossContaminationAlerts'] as int? ?? 0,
      criticalCases: json['criticalCases'] as int? ?? 0,
    );
  }
}

class SafetyFeatureFlags {
  const SafetyFeatureFlags({
    required this.allergyColorCoding,
    required this.mandatoryChefConfirmation,
    required this.crossContaminationWarnings,
    required this.dedicatedPrepWarnings,
    required this.safetySopReminders,
  });

  final bool allergyColorCoding;
  final bool mandatoryChefConfirmation;
  final bool crossContaminationWarnings;
  final bool dedicatedPrepWarnings;
  final bool safetySopReminders;

  factory SafetyFeatureFlags.fromJson(Map<String, dynamic> json) {
    return SafetyFeatureFlags(
      allergyColorCoding: json['allergyColorCoding'] as bool? ?? false,
      mandatoryChefConfirmation:
          json['mandatoryChefConfirmation'] as bool? ?? false,
      crossContaminationWarnings:
          json['crossContaminationWarnings'] as bool? ?? false,
      dedicatedPrepWarnings: json['dedicatedPrepWarnings'] as bool? ?? false,
      safetySopReminders: json['safetySopReminders'] as bool? ?? false,
    );
  }
}
