import 'mock_section_registry.dart';

class MockCleaningHygieneRegistry {
  MockCleaningHygieneRegistry._();

  static final List<Map<String, dynamic>> _schedules = _seedSchedules();
  static final List<Map<String, dynamic>> _checklists = _seedChecklists();
  static final List<Map<String, dynamic>> _sanitization = _seedSanitization();
  static final List<Map<String, dynamic>> _foodSafety = _seedFoodSafety();
  static final List<Map<String, dynamic>> _deepCleaning = _seedDeepCleaning();
  static final List<Map<String, dynamic>> _compliance = _seedCompliance();
  static int _completedToday = 18;

  static List<Map<String, dynamic>> schedulesFor(String section) {
    if (section == 'All') {
      return _schedules.map(_serializeSchedule).toList();
    }
    return _schedules
        .where((task) => task['section'] == section)
        .map(_serializeSchedule)
        .toList();
  }

  static List<Map<String, dynamic>> checklistsFor(String section) {
    if (section == 'All') {
      return _checklists.map(_serializeChecklist).toList();
    }
    return _checklists
        .where((item) => item['section'] == section)
        .map(_serializeChecklist)
        .toList();
  }

  static List<Map<String, dynamic>> sanitizationFor(String section) {
    if (section == 'All') {
      return _sanitization.map(_serializeSanitization).toList();
    }
    return _sanitization
        .where((item) => item['section'] == section)
        .map(_serializeSanitization)
        .toList();
  }

  static List<Map<String, dynamic>> foodSafetyFor(String section) {
    if (section == 'All') {
      return _foodSafety.map(Map<String, dynamic>.from).toList();
    }
    return _foodSafety
        .where((item) => item['section'] == section)
        .map(Map<String, dynamic>.from)
        .toList();
  }

  static List<Map<String, dynamic>> deepCleaningFor(String section) {
    if (section == 'All') {
      return _deepCleaning.map(_serializeDeepClean).toList();
    }
    return _deepCleaning
        .where((item) => item['section'] == section)
        .map(_serializeDeepClean)
        .toList();
  }

  static List<Map<String, dynamic>> complianceFor(String section) {
    if (section == 'All') {
      return _compliance.map(_serializeCompliance).toList();
    }
    return _compliance
        .where((item) => item['section'] == section || item['section'] == 'All')
        .map(_serializeCompliance)
        .toList();
  }

  static Map<String, dynamic> performAction({
    required String taskId,
    required String action,
    String? staffName,
  }) {
    final schedule = _findInList(_schedules, taskId);
    final checklist = _findInList(_checklists, taskId);
    final sanitization = _findInList(_sanitization, taskId);
    final deepClean = _findInList(_deepCleaning, taskId);
    final compliance = _findInList(_compliance, taskId);

    final target = schedule ?? checklist ?? sanitization ?? deepClean ?? compliance;
    if (target == null) {
      throw ArgumentError('Hygiene task not found');
    }

    final label = target['taskName'] ??
        target['title'] ??
        target['equipmentName'] ??
        target['areaName'] ??
        'Hygiene task';

    switch (action) {
      case 'start_task':
        target['status'] = 'in_progress';
        return {'success': true, 'message': 'Task started · $label'};
      case 'complete_checklist':
        target['itemsCompleted'] = target['totalItems'];
        target['status'] = 'completed';
        _completedToday++;
        return {'success': true, 'message': 'Checklist completed · $label'};
      case 'mark_sanitized':
        target['status'] = 'sanitized';
        target['lastSanitized'] = 'Just now';
        target['dueInMinutes'] = 240;
        _completedToday++;
        return {'success': true, 'message': 'Equipment sanitized · $label'};
      case 'log_food_safety':
        target['status'] = 'logged';
        return {'success': true, 'message': 'Food safety logged · $label'};
      case 'schedule_deep_clean':
        target['status'] = 'scheduled';
        return {'success': true, 'message': 'Deep clean scheduled · $label'};
      case 'verify_staff':
        target['status'] = 'verified';
        if (staffName != null) {
          target['assignedStaff'] = staffName;
        }
        _completedToday++;
        return {'success': true, 'message': 'Staff hygiene verified · $label'};
      case 'record_audit':
        target['status'] = 'compliant';
        target['lastUpdated'] = DateTime.now().toIso8601String();
        return {'success': true, 'message': 'Audit recorded · $label'};
      case 'complete_task':
        target['status'] = 'completed';
        _completedToday++;
        return {'success': true, 'message': 'Task completed · $label'};
      case 'hold_task':
        target['status'] = 'on_hold';
        return {'success': true, 'message': 'Task held · $label'};
      default:
        throw ArgumentError('Unknown hygiene action: $action');
    }
  }

  static Map<String, dynamic> startAudit({String? auditType}) {
    final type = auditType ?? 'FSSAI SOP audit';
    _compliance.insert(0, {
      'id': 'CMP-${DateTime.now().millisecondsSinceEpoch}',
      'recordType': 'audit',
      'title': type,
      'section': 'All',
      'lastUpdated': DateTime.now().toIso8601String(),
      'status': 'in_review',
    });
    return {'success': true, 'message': 'Hygiene audit started · $type'};
  }

  static Map<String, dynamic>? _findInList(
    List<Map<String, dynamic>> items,
    String id,
  ) {
    for (final item in items) {
      if (item['id'] == id) {
        return item;
      }
    }
    return null;
  }

  static Map<String, dynamic> _serializeSchedule(Map<String, dynamic> task) {
    return {
      'id': task['id'],
      'taskName': task['taskName'],
      'section': task['section'],
      'frequency': task['frequency'],
      'scheduledTime': task['scheduledTime'],
      'assignedStaff': task['assignedStaff'],
      'status': task['status'],
      'availableActions': _scheduleActions(task),
    };
  }

  static Map<String, dynamic> _serializeChecklist(Map<String, dynamic> item) {
    return {
      'id': item['id'],
      'title': item['title'],
      'section': item['section'],
      'itemsCompleted': item['itemsCompleted'],
      'totalItems': item['totalItems'],
      'status': item['status'],
      'availableActions': _checklistActions(item),
    };
  }

  static Map<String, dynamic> _serializeSanitization(Map<String, dynamic> item) {
    return {
      'id': item['id'],
      'equipmentName': item['equipmentName'],
      'section': item['section'],
      'lastSanitized': item['lastSanitized'],
      'dueInMinutes': item['dueInMinutes'],
      'status': item['status'],
      'availableActions': _sanitizationActions(item),
    };
  }

  static Map<String, dynamic> _serializeDeepClean(Map<String, dynamic> item) {
    return {
      'id': item['id'],
      'areaName': item['areaName'],
      'section': item['section'],
      'scheduledDate': item['scheduledDate'],
      'assignedTeam': item['assignedTeam'],
      'status': item['status'],
      'availableActions': _deepCleanActions(item),
    };
  }

  static Map<String, dynamic> _serializeCompliance(Map<String, dynamic> item) {
    return {
      'id': item['id'],
      'recordType': item['recordType'],
      'title': item['title'],
      'section': item['section'],
      'lastUpdated': item['lastUpdated'],
      'status': item['status'],
      'availableActions': _complianceActions(item),
    };
  }

  static List<String> _scheduleActions(Map<String, dynamic> task) {
    if (task['status'] == 'completed') {
      return const [];
    }
    return ['start_task', 'complete_task', 'hold_task'];
  }

  static List<String> _checklistActions(Map<String, dynamic> item) {
    if (item['status'] == 'completed') {
      return const [];
    }
    return ['start_task', 'complete_checklist', 'hold_task'];
  }

  static List<String> _sanitizationActions(Map<String, dynamic> item) {
    if (item['status'] == 'sanitized') {
      return const [];
    }
    return ['mark_sanitized', 'hold_task'];
  }

  static List<String> _deepCleanActions(Map<String, dynamic> item) {
    if (item['status'] == 'completed') {
      return const [];
    }
    return ['schedule_deep_clean', 'start_task', 'complete_task', 'hold_task'];
  }

  static List<String> _complianceActions(Map<String, dynamic> item) {
    return switch (item['recordType']) {
      'staff_verification' => ['verify_staff', 'record_audit'],
      'fssai_sop' => ['record_audit', 'hold_task'],
      _ => ['record_audit', 'verify_staff'],
    };
  }

  static List<Map<String, dynamic>> _seedSchedules() {
    return [
      {
        'id': 'CLN-001',
        'taskName': 'Morning floor mop',
        'section': 'Main',
        'frequency': 'Daily',
        'scheduledTime': '06:00',
        'assignedStaff': 'Hygiene Team A',
        'status': 'completed',
      },
      {
        'id': 'CLN-002',
        'taskName': 'Mid-shift surface wipe',
        'section': 'Tandoor',
        'frequency': 'Shift',
        'scheduledTime': '14:00',
        'assignedStaff': 'Tandoor Helper',
        'status': 'in_progress',
      },
      {
        'id': 'CLN-003',
        'taskName': 'Closing sanitization',
        'section': 'Chinese',
        'frequency': 'Daily',
        'scheduledTime': '23:00',
        'assignedStaff': 'Night shift',
        'status': 'scheduled',
      },
    ];
  }

  static List<Map<String, dynamic>> _seedChecklists() {
    return [
      {
        'id': 'CHK-001',
        'title': 'Opening hygiene checklist',
        'section': 'Main',
        'itemsCompleted': 8,
        'totalItems': 12,
        'status': 'in_progress',
      },
      {
        'id': 'CHK-002',
        'title': 'Cold storage checklist',
        'section': 'Continental',
        'itemsCompleted': 5,
        'totalItems': 5,
        'status': 'completed',
      },
    ];
  }

  static List<Map<String, dynamic>> _seedSanitization() {
    return [
      {
        'id': 'SAN-001',
        'equipmentName': 'Deep fryer #2',
        'section': 'Main',
        'lastSanitized': '3h ago',
        'dueInMinutes': 15,
        'status': 'overdue',
      },
      {
        'id': 'SAN-002',
        'equipmentName': 'Tandoor chamber',
        'section': 'Tandoor',
        'lastSanitized': '1h ago',
        'dueInMinutes': 180,
        'status': 'due',
      },
      {
        'id': 'SAN-003',
        'equipmentName': 'Prep counter A',
        'section': 'Chinese',
        'lastSanitized': 'Just now',
        'dueInMinutes': 240,
        'status': 'sanitized',
      },
    ];
  }

  static List<Map<String, dynamic>> _seedFoodSafety() {
    return [
      {
        'id': 'FS-001',
        'checkType': 'Walk-in chiller temperature',
        'section': 'Continental',
        'reading': '3.8°C',
        'threshold': '0-4°C',
        'status': 'ok',
      },
      {
        'id': 'FS-002',
        'checkType': 'Hot holding line',
        'section': 'Main',
        'reading': '58°C',
        'threshold': '≥60°C',
        'status': 'alert',
      },
      {
        'id': 'FS-003',
        'checkType': 'Raw meat storage',
        'section': 'Grill',
        'reading': '2.1°C',
        'threshold': '0-4°C',
        'status': 'ok',
      },
    ];
  }

  static List<Map<String, dynamic>> _seedDeepCleaning() {
    return [
      {
        'id': 'DCL-001',
        'areaName': 'Exhaust hood deep clean',
        'section': 'Tandoor',
        'scheduledDate': 'Friday 22:00',
        'assignedTeam': 'Maintenance + Hygiene',
        'status': 'scheduled',
      },
      {
        'id': 'DCL-002',
        'areaName': 'Floor drain sanitization',
        'section': 'Main',
        'scheduledDate': 'Tonight 23:30',
        'assignedTeam': 'Hygiene Team B',
        'status': 'scheduled',
      },
    ];
  }

  static List<Map<String, dynamic>> _seedCompliance() {
    return [
      {
        'id': 'CMP-001',
        'recordType': 'fssai_sop',
        'title': 'FSSAI SOP compliance review',
        'section': 'All',
        'lastUpdated': 'Today 08:00',
        'status': 'compliant',
      },
      {
        'id': 'CMP-002',
        'recordType': 'audit',
        'title': 'Weekly hygiene audit log',
        'section': 'All',
        'lastUpdated': 'Yesterday',
        'status': 'compliant',
      },
      {
        'id': 'CMP-003',
        'recordType': 'staff_verification',
        'title': 'Staff hand-wash verification',
        'section': 'Main',
        'lastUpdated': '2h ago',
        'status': 'pending',
      },
    ];
  }

  static int get completedToday => _completedToday;
}

class MockCleaningHygieneEngine {
  const MockCleaningHygieneEngine._();

  static Map<String, dynamic> buildSnapshot({String section = 'All'}) {
    final cleaningSchedules = MockCleaningHygieneRegistry.schedulesFor(section);
    final hygieneChecklists = MockCleaningHygieneRegistry.checklistsFor(section);
    final sanitizationTasks = MockCleaningHygieneRegistry.sanitizationFor(section);
    final foodSafetyEntries = MockCleaningHygieneRegistry.foodSafetyFor(section);
    final deepCleaningJobs = MockCleaningHygieneRegistry.deepCleaningFor(section);
    final complianceRecords = MockCleaningHygieneRegistry.complianceFor(section);

    return {
      'section': section,
      'lastSyncedAt': DateTime.now().toIso8601String(),
      'cleaningSchedules': cleaningSchedules,
      'hygieneChecklists': hygieneChecklists,
      'sanitizationTasks': sanitizationTasks,
      'foodSafetyEntries': foodSafetyEntries,
      'deepCleaningJobs': deepCleaningJobs,
      'complianceRecords': complianceRecords,
      'stats': {
        'scheduledTasks': cleaningSchedules
            .where((task) => task['status'] == 'scheduled')
            .length,
        'checklistsOpen': hygieneChecklists
            .where((item) => item['status'] != 'completed')
            .length,
        'sanitizationDue': sanitizationTasks
            .where((item) => item['status'] != 'sanitized')
            .length,
        'foodSafetyAlerts': foodSafetyEntries
            .where((item) => item['status'] == 'alert')
            .length,
        'deepCleanPending': deepCleaningJobs
            .where((item) => item['status'] == 'scheduled')
            .length,
        'complianceIssues': complianceRecords
            .where((item) => item['status'] == 'pending')
            .length,
        'completedToday': MockCleaningHygieneRegistry.completedToday,
      },
      'hygieneFeatures': {
        'cleaningSchedules': cleaningSchedules.isNotEmpty,
        'hygieneChecklists': hygieneChecklists.isNotEmpty,
        'equipmentSanitization': sanitizationTasks.isNotEmpty,
        'foodSafetyTracking': foodSafetyEntries.isNotEmpty,
        'deepCleaningManagement': deepCleaningJobs.isNotEmpty,
        'fssaiSopTracking': complianceRecords.any(
          (item) => item['recordType'] == 'fssai_sop',
        ),
        'hygieneAuditLogs': complianceRecords.any(
          (item) => item['recordType'] == 'audit',
        ),
        'staffHygieneVerification': complianceRecords.any(
          (item) => item['recordType'] == 'staff_verification',
        ),
      },
      'sections': MockSectionRegistry.filterSections,
    };
  }
}
