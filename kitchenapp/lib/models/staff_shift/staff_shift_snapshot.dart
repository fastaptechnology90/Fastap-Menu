class StaffShiftSnapshot {
  const StaffShiftSnapshot({
    required this.section,
    required this.lastSyncedAt,
    required this.shiftRecords,
    required this.swapRequests,
    required this.handoverNotes,
    required this.stats,
    required this.shiftFeatures,
    required this.sections,
  });

  final String section;
  final DateTime lastSyncedAt;
  final List<StaffShiftRecord> shiftRecords;
  final List<ShiftSwapRequest> swapRequests;
  final List<ShiftHandoverNote> handoverNotes;
  final StaffShiftStats stats;
  final StaffShiftFeatureFlags shiftFeatures;
  final List<String> sections;

  factory StaffShiftSnapshot.fromJson(Map<String, dynamic> json) {
    return StaffShiftSnapshot(
      section: json['section'] as String? ?? 'All',
      lastSyncedAt: DateTime.parse(json['lastSyncedAt'] as String),
      shiftRecords: (json['shiftRecords'] as List<dynamic>)
          .map(
            (item) => StaffShiftRecord.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      swapRequests: (json['swapRequests'] as List<dynamic>)
          .map(
            (item) => ShiftSwapRequest.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      handoverNotes: (json['handoverNotes'] as List<dynamic>)
          .map(
            (item) => ShiftHandoverNote.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      stats: StaffShiftStats.fromJson(json['stats'] as Map<String, dynamic>),
      shiftFeatures: StaffShiftFeatureFlags.fromJson(
        json['shiftFeatures'] as Map<String, dynamic>,
      ),
      sections: (json['sections'] as List<dynamic>)
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class StaffShiftRecord {
  const StaffShiftRecord({
    required this.id,
    required this.staffId,
    required this.staffName,
    required this.section,
    required this.role,
    required this.shiftLabel,
    required this.shiftStatus,
    required this.clockInTime,
    required this.clockOutTime,
    required this.breakMinutes,
    required this.overtimeMinutes,
    required this.attendanceStatus,
    required this.availableActions,
  });

  final String id;
  final String staffId;
  final String staffName;
  final String section;
  final String role;
  final String shiftLabel;
  final String shiftStatus;
  final String clockInTime;
  final String clockOutTime;
  final int breakMinutes;
  final int overtimeMinutes;
  final String attendanceStatus;
  final List<String> availableActions;

  factory StaffShiftRecord.fromJson(Map<String, dynamic> json) {
    return StaffShiftRecord(
      id: json['id'] as String,
      staffId: json['staffId'] as String,
      staffName: json['staffName'] as String,
      section: json['section'] as String,
      role: json['role'] as String? ?? 'Staff',
      shiftLabel: json['shiftLabel'] as String? ?? 'Morning',
      shiftStatus: json['shiftStatus'] as String? ?? 'off_shift',
      clockInTime: json['clockInTime'] as String? ?? '--',
      clockOutTime: json['clockOutTime'] as String? ?? '--',
      breakMinutes: json['breakMinutes'] as int? ?? 0,
      overtimeMinutes: json['overtimeMinutes'] as int? ?? 0,
      attendanceStatus: json['attendanceStatus'] as String? ?? 'absent',
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class ShiftSwapRequest {
  const ShiftSwapRequest({
    required this.id,
    required this.requesterId,
    required this.requesterName,
    required this.targetStaffName,
    required this.section,
    required this.shiftLabel,
    required this.status,
    required this.availableActions,
  });

  final String id;
  final String requesterId;
  final String requesterName;
  final String targetStaffName;
  final String section;
  final String shiftLabel;
  final String status;
  final List<String> availableActions;

  factory ShiftSwapRequest.fromJson(Map<String, dynamic> json) {
    return ShiftSwapRequest(
      id: json['id'] as String,
      requesterId: json['requesterId'] as String,
      requesterName: json['requesterName'] as String,
      targetStaffName: json['targetStaffName'] as String,
      section: json['section'] as String,
      shiftLabel: json['shiftLabel'] as String? ?? 'Evening',
      status: json['status'] as String? ?? 'pending',
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class ShiftHandoverNote {
  const ShiftHandoverNote({
    required this.id,
    required this.fromStaff,
    required this.toStaff,
    required this.section,
    required this.notePreview,
    required this.status,
    required this.availableActions,
  });

  final String id;
  final String fromStaff;
  final String toStaff;
  final String section;
  final String notePreview;
  final String status;
  final List<String> availableActions;

  factory ShiftHandoverNote.fromJson(Map<String, dynamic> json) {
    return ShiftHandoverNote(
      id: json['id'] as String,
      fromStaff: json['fromStaff'] as String,
      toStaff: json['toStaff'] as String,
      section: json['section'] as String,
      notePreview: json['notePreview'] as String? ?? '',
      status: json['status'] as String? ?? 'pending',
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class StaffShiftStats {
  const StaffShiftStats({
    required this.onShiftNow,
    required this.onBreak,
    required this.overtimeActive,
    required this.lateArrivals,
    required this.pendingSwaps,
    required this.openHandovers,
  });

  final int onShiftNow;
  final int onBreak;
  final int overtimeActive;
  final int lateArrivals;
  final int pendingSwaps;
  final int openHandovers;

  factory StaffShiftStats.fromJson(Map<String, dynamic> json) {
    return StaffShiftStats(
      onShiftNow: json['onShiftNow'] as int? ?? 0,
      onBreak: json['onBreak'] as int? ?? 0,
      overtimeActive: json['overtimeActive'] as int? ?? 0,
      lateArrivals: json['lateArrivals'] as int? ?? 0,
      pendingSwaps: json['pendingSwaps'] as int? ?? 0,
      openHandovers: json['openHandovers'] as int? ?? 0,
    );
  }
}

class StaffShiftFeatureFlags {
  const StaffShiftFeatureFlags({
    required this.shiftStartEnd,
    required this.attendanceTracking,
    required this.breakTracking,
    required this.overtimeTracking,
    required this.shiftSwap,
    required this.shiftHandoverNotes,
  });

  final bool shiftStartEnd;
  final bool attendanceTracking;
  final bool breakTracking;
  final bool overtimeTracking;
  final bool shiftSwap;
  final bool shiftHandoverNotes;

  factory StaffShiftFeatureFlags.fromJson(Map<String, dynamic> json) {
    return StaffShiftFeatureFlags(
      shiftStartEnd: json['shiftStartEnd'] as bool? ?? false,
      attendanceTracking: json['attendanceTracking'] as bool? ?? false,
      breakTracking: json['breakTracking'] as bool? ?? false,
      overtimeTracking: json['overtimeTracking'] as bool? ?? false,
      shiftSwap: json['shiftSwap'] as bool? ?? false,
      shiftHandoverNotes: json['shiftHandoverNotes'] as bool? ?? false,
    );
  }
}

class StaffShiftActionResult {
  const StaffShiftActionResult({
    required this.success,
    required this.message,
  });

  final bool success;
  final String message;

  factory StaffShiftActionResult.fromJson(Map<String, dynamic> json) {
    return StaffShiftActionResult(
      success: json['success'] as bool? ?? false,
      message: json['message'] as String? ?? 'Shift action applied',
    );
  }
}
