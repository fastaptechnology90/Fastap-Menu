class CourseFiringSnapshot {
  const CourseFiringSnapshot({
    required this.section,
    required this.lastSyncedAt,
    required this.sessions,
    required this.stats,
    required this.smartFiring,
    required this.coordinationBoard,
    required this.sections,
  });

  final String section;
  final DateTime lastSyncedAt;
  final List<FiringSession> sessions;
  final FiringStats stats;
  final SmartFiringFlags smartFiring;
  final List<FiringCoordinationItem> coordinationBoard;
  final List<String> sections;

  factory CourseFiringSnapshot.fromJson(Map<String, dynamic> json) {
    return CourseFiringSnapshot(
      section: json['section'] as String? ?? 'All',
      lastSyncedAt: DateTime.parse(json['lastSyncedAt'] as String),
      sessions: (json['sessions'] as List<dynamic>)
          .map((item) => FiringSession.fromJson(item as Map<String, dynamic>))
          .toList(),
      stats: FiringStats.fromJson(json['stats'] as Map<String, dynamic>),
      smartFiring: SmartFiringFlags.fromJson(
        json['smartFiring'] as Map<String, dynamic>,
      ),
      coordinationBoard: (json['coordinationBoard'] as List<dynamic>)
          .map(
            (item) => FiringCoordinationItem.fromJson(
              item as Map<String, dynamic>,
            ),
          )
          .toList(),
      sections: (json['sections'] as List<dynamic>)
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class FiringSession {
  const FiringSession({
    required this.id,
    required this.location,
    required this.guestType,
    required this.deliveryType,
    required this.sections,
    required this.servingMode,
    required this.servingModeLabel,
    required this.linkedOrderIds,
    required this.vip,
    required this.pacing,
    required this.courses,
    required this.sessionActions,
    this.tableNumber,
    this.roomNumber,
  });

  final String id;
  final String location;
  final String? tableNumber;
  final String? roomNumber;
  final String guestType;
  final String deliveryType;
  final List<String> sections;
  final String servingMode;
  final String servingModeLabel;
  final List<String> linkedOrderIds;
  final bool vip;
  final FiringPacing pacing;
  final List<FiringCourse> courses;
  final List<String> sessionActions;

  factory FiringSession.fromJson(Map<String, dynamic> json) {
    return FiringSession(
      id: json['id'] as String,
      location: json['location'] as String,
      tableNumber: json['tableNumber'] as String?,
      roomNumber: json['roomNumber'] as String?,
      guestType: json['guestType'] as String,
      deliveryType: json['deliveryType'] as String,
      sections: (json['sections'] as List<dynamic>)
          .map((item) => item.toString())
          .toList(),
      servingMode: json['servingMode'] as String,
      servingModeLabel: json['servingModeLabel'] as String,
      linkedOrderIds: (json['linkedOrderIds'] as List<dynamic>)
          .map((item) => item.toString())
          .toList(),
      vip: json['vip'] as bool? ?? false,
      pacing: FiringPacing.fromJson(json['pacing'] as Map<String, dynamic>),
      courses: (json['courses'] as List<dynamic>)
          .map((item) => FiringCourse.fromJson(item as Map<String, dynamic>))
          .toList(),
      sessionActions: (json['sessionActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class FiringCourse {
  const FiringCourse({
    required this.type,
    required this.label,
    required this.status,
    required this.statusLabel,
    required this.items,
    required this.firedSecondsAgo,
    required this.etaMinutes,
    required this.linkedKot,
    required this.elapsed,
    required this.availableActions,
  });

  final String type;
  final String label;
  final String status;
  final String statusLabel;
  final List<String> items;
  final int firedSecondsAgo;
  final int etaMinutes;
  final String linkedKot;
  final String elapsed;
  final List<String> availableActions;

  factory FiringCourse.fromJson(Map<String, dynamic> json) {
    return FiringCourse(
      type: json['type'] as String,
      label: json['label'] as String,
      status: json['status'] as String,
      statusLabel: json['statusLabel'] as String,
      items: (json['items'] as List<dynamic>).map((item) => item.toString()).toList(),
      firedSecondsAgo: json['firedSecondsAgo'] as int? ?? 0,
      etaMinutes: json['etaMinutes'] as int? ?? 0,
      linkedKot: json['linkedKot'] as String,
      elapsed: json['elapsed'] as String? ?? '00:00',
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class FiringPacing {
  const FiringPacing({
    required this.tableMinutesSinceSeat,
    required this.guestReady,
    required this.syncDelayMinutes,
    required this.targetGapMinutes,
  });

  final int tableMinutesSinceSeat;
  final bool guestReady;
  final int syncDelayMinutes;
  final int targetGapMinutes;

  factory FiringPacing.fromJson(Map<String, dynamic> json) {
    return FiringPacing(
      tableMinutesSinceSeat: json['tableMinutesSinceSeat'] as int? ?? 0,
      guestReady: json['guestReady'] as bool? ?? true,
      syncDelayMinutes: json['syncDelayMinutes'] as int? ?? 0,
      targetGapMinutes: json['targetGapMinutes'] as int? ?? 12,
    );
  }
}

class FiringStats {
  const FiringStats({
    required this.totalSessions,
    required this.activeFires,
    required this.heldCourses,
    required this.vipSessions,
    required this.syncAlerts,
  });

  final int totalSessions;
  final int activeFires;
  final int heldCourses;
  final int vipSessions;
  final int syncAlerts;

  factory FiringStats.fromJson(Map<String, dynamic> json) {
    return FiringStats(
      totalSessions: json['totalSessions'] as int? ?? 0,
      activeFires: json['activeFires'] as int? ?? 0,
      heldCourses: json['heldCourses'] as int? ?? 0,
      vipSessions: json['vipSessions'] as int? ?? 0,
      syncAlerts: json['syncAlerts'] as int? ?? 0,
    );
  }
}

class SmartFiringFlags {
  const SmartFiringFlags({
    required this.tablePacing,
    required this.guestPacing,
    required this.delaySynchronization,
    required this.multiCourseCoordination,
  });

  final bool tablePacing;
  final bool guestPacing;
  final bool delaySynchronization;
  final bool multiCourseCoordination;

  factory SmartFiringFlags.fromJson(Map<String, dynamic> json) {
    return SmartFiringFlags(
      tablePacing: json['tablePacing'] as bool? ?? false,
      guestPacing: json['guestPacing'] as bool? ?? false,
      delaySynchronization: json['delaySynchronization'] as bool? ?? false,
      multiCourseCoordination: json['multiCourseCoordination'] as bool? ?? false,
    );
  }
}

class FiringCoordinationItem {
  const FiringCoordinationItem({
    required this.sessionId,
    required this.location,
    required this.mode,
    required this.nextAction,
    required this.etaMinutes,
  });

  final String sessionId;
  final String location;
  final String mode;
  final String nextAction;
  final int etaMinutes;

  factory FiringCoordinationItem.fromJson(Map<String, dynamic> json) {
    return FiringCoordinationItem(
      sessionId: json['sessionId'] as String,
      location: json['location'] as String,
      mode: json['mode'] as String,
      nextAction: json['nextAction'] as String,
      etaMinutes: json['etaMinutes'] as int? ?? 0,
    );
  }
}

class FiringActionResult {
  const FiringActionResult({
    required this.success,
    required this.message,
  });

  final bool success;
  final String message;

  factory FiringActionResult.fromJson(Map<String, dynamic> json) {
    return FiringActionResult(
      success: json['success'] as bool? ?? false,
      message: json['message'] as String? ?? 'Action applied',
    );
  }
}
