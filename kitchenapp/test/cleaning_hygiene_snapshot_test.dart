import 'package:flutter_test/flutter_test.dart';

import 'package:kitchenapp/models/hygiene/cleaning_hygiene_snapshot.dart';

void main() {
  test('cleaning hygiene snapshot parses API payload', () {
    final snapshot = CleaningHygieneSnapshot.fromJson({
      'section': 'All',
      'lastSyncedAt': '2026-06-06T12:00:00.000',
      'sections': ['All', 'Main'],
      'cleaningSchedules': [
        {
          'id': 'CLN-002',
          'taskName': 'Mid-shift surface wipe',
          'section': 'Tandoor',
          'frequency': 'Shift',
          'scheduledTime': '14:00',
          'assignedStaff': 'Tandoor Helper',
          'status': 'in_progress',
          'availableActions': ['complete_task', 'hold_task'],
        },
      ],
      'hygieneChecklists': [
        {
          'id': 'CHK-001',
          'title': 'Opening hygiene checklist',
          'section': 'Main',
          'itemsCompleted': 8,
          'totalItems': 12,
          'status': 'in_progress',
          'availableActions': ['complete_checklist'],
        },
      ],
      'sanitizationTasks': [
        {
          'id': 'SAN-001',
          'equipmentName': 'Deep fryer #2',
          'section': 'Main',
          'lastSanitized': '3h ago',
          'dueInMinutes': 15,
          'status': 'overdue',
          'availableActions': ['mark_sanitized'],
        },
      ],
      'foodSafetyEntries': [
        {
          'id': 'FS-002',
          'checkType': 'Hot holding line',
          'section': 'Main',
          'reading': '58°C',
          'threshold': '≥60°C',
          'status': 'alert',
        },
      ],
      'deepCleaningJobs': [
        {
          'id': 'DCL-001',
          'areaName': 'Exhaust hood deep clean',
          'section': 'Tandoor',
          'scheduledDate': 'Friday 22:00',
          'assignedTeam': 'Maintenance + Hygiene',
          'status': 'scheduled',
          'availableActions': ['start_task'],
        },
      ],
      'complianceRecords': [
        {
          'id': 'CMP-001',
          'recordType': 'fssai_sop',
          'title': 'FSSAI SOP compliance review',
          'section': 'All',
          'lastUpdated': 'Today 08:00',
          'status': 'compliant',
          'availableActions': ['record_audit'],
        },
      ],
      'stats': {
        'scheduledTasks': 1,
        'checklistsOpen': 1,
        'sanitizationDue': 1,
        'foodSafetyAlerts': 1,
        'deepCleanPending': 1,
        'complianceIssues': 0,
        'completedToday': 18,
      },
      'hygieneFeatures': {
        'cleaningSchedules': true,
        'hygieneChecklists': true,
        'equipmentSanitization': true,
        'foodSafetyTracking': true,
        'deepCleaningManagement': true,
        'fssaiSopTracking': true,
        'hygieneAuditLogs': false,
        'staffHygieneVerification': false,
      },
    });

    expect(snapshot.cleaningSchedules.length, 1);
    expect(snapshot.sanitizationTasks.first.status, 'overdue');
    expect(snapshot.hygieneFeatures.fssaiSopTracking, isTrue);
    expect(snapshot.stats.foodSafetyAlerts, 1);
  });
}
