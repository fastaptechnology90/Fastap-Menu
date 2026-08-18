import 'package:flutter_test/flutter_test.dart';

import 'package:kitchenapp/models/audit_compliance/audit_compliance_snapshot.dart';

void main() {
  test('audit compliance snapshot parses API payload', () {
    final snapshot = AuditComplianceSnapshot.fromJson({
      'section': 'All',
      'lastSyncedAt': '2026-06-06T12:00:00.000',
      'sections': ['All', 'Main'],
      'actionLogs': [
        {
          'id': 'AU-ACT-001',
          'actionLabel': 'KDS order bump · #2847',
          'actorName': 'Chef Rahul',
          'section': 'Main',
          'timestampLabel': '12 min ago',
          'severity': 'info',
          'status': 'pending',
          'availableActions': ['review_log'],
        },
      ],
      'foodSafetyLogs': [
        {
          'id': 'AU-FS-001',
          'checkName': 'Walk-in cooler temperature',
          'section': 'Continental',
          'reading': '6°C',
          'threshold': '≤ 4°C',
          'status': 'flagged',
          'availableActions': ['acknowledge_check'],
        },
      ],
      'hygieneLogs': [
        {
          'id': 'AU-HYG-001',
          'taskName': 'Handwash station inspection',
          'section': 'Main',
          'dueLabel': 'Overdue 2 hr',
          'complianceLevel': 'warning',
          'status': 'pending',
          'availableActions': ['mark_compliant'],
        },
      ],
      'staffActivityLogs': [
        {
          'id': 'AU-STF-001',
          'activityLabel': 'Late clock-in · prep shift',
          'staffName': 'Prep lead',
          'section': 'Main',
          'activityType': 'attendance',
          'status': 'pending',
          'availableActions': ['review_activity'],
        },
      ],
      'incidentLogs': [
        {
          'id': 'AU-INC-001',
          'incidentTitle': 'Slip near pass station',
          'section': 'Main',
          'severity': 'high',
          'reportedAt': '45 min ago',
          'status': 'open',
          'availableActions': ['investigate_incident'],
        },
      ],
      'stats': {
        'pendingReviews': 2,
        'foodSafetyFlags': 1,
        'hygieneIssues': 1,
        'staffAlerts': 1,
        'openIncidents': 2,
        'exportedToday': 11,
      },
      'auditFeatures': {
        'actionLogs': true,
        'foodSafetyLogs': true,
        'hygieneLogs': true,
        'staffActivityLogs': true,
        'incidentLogs': true,
      },
    });

    expect(snapshot.actionLogs.first.actorName, 'Chef Rahul');
    expect(snapshot.foodSafetyLogs.first.reading, '6°C');
    expect(snapshot.auditFeatures.incidentLogs, isTrue);
    expect(snapshot.stats.openIncidents, 2);
  });
}
