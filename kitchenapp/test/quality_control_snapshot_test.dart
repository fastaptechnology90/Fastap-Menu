import 'package:flutter_test/flutter_test.dart';

import 'package:kitchenapp/models/quality/quality_control_snapshot.dart';

void main() {
  test('quality control snapshot parses API payload', () {
    final snapshot = QualityControlSnapshot.fromJson({
      'section': 'All',
      'lastSyncedAt': '2026-06-06T12:00:00.000',
      'sections': ['All', 'Main'],
      'pendingChecks': [
        {
          'id': 'QC-ORD-1843',
          'orderId': 'ORD-1843',
          'kotNumber': 'KOT #1843',
          'section': 'Main',
          'location': 'Room 804',
          'dishName': '1x Dal makhani',
          'status': 'awaiting_supervisor',
          'score': 100,
          'supervisorRequired': true,
          'assignedSupervisor': 'Pending supervisor',
          'availableActions': ['supervisor_signoff', 'approve', 'reject'],
          'checklist': [
            {
              'id': 'quality-portion',
              'label': 'Portion size matches standard',
              'category': 'quality',
              'passed': true,
              'required': true,
            },
          ],
        },
      ],
      'randomAudits': [
        {
          'id': 'AUD-001',
          'section': 'Grill',
          'dishName': '1x Grilled fish',
          'auditor': 'QC Lead · Priya Nair',
          'triggeredAt': '2026-06-06T11:25:00.000',
          'score': 88,
          'notes': 'Temperature probe verified',
          'status': 'closed',
        },
      ],
      'complaints': [
        {
          'id': 'CMP-001',
          'orderId': 'ORD-1842',
          'kotNumber': 'KOT #1842',
          'section': 'Tandoor',
          'reason': 'Naan served cold',
          'severity': 'high',
          'loggedAt': '2026-06-06T10:00:00.000',
          'status': 'investigating',
        },
      ],
      'rejections': [
        {
          'id': 'REJ-001',
          'orderId': 'ORD-1840',
          'kotNumber': 'KOT #1840',
          'section': 'Chinese',
          'dishName': '1x Fried rice',
          'reason': 'Burnt edges',
          'rejectedBy': 'QC Supervisor',
          'rejectedAt': '2026-06-06T07:00:00.000',
          'disposition': 'Waste log',
        },
      ],
      'stats': {
        'pendingChecks': 1,
        'awaitingSupervisor': 1,
        'passRate': 94,
        'averageScore': 100,
        'openComplaints': 1,
        'rejectionsToday': 1,
        'randomAudits': 1,
      },
      'qcFeatures': {
        'foodQualityChecklist': true,
        'presentationValidation': true,
        'temperatureValidation': false,
        'hygieneValidation': true,
        'supervisorApproval': true,
        'randomAudits': true,
        'qcScoring': true,
        'complaintTracking': true,
        'rejectedFoodTracking': true,
      },
    });

    expect(snapshot.pendingChecks.length, 1);
    expect(snapshot.pendingChecks.first.supervisorRequired, isTrue);
    expect(snapshot.qcFeatures.complaintTracking, isTrue);
    expect(snapshot.stats.averageScore, 100);
  });
}
