import 'package:flutter_test/flutter_test.dart';

import 'package:kitchenapp/models/expeditor/expeditor_snapshot.dart';

void main() {
  test('expeditor snapshot parses API payload', () {
    final snapshot = ExpeditorSnapshot.fromJson({
      'section': 'All',
      'lastSyncedAt': '2026-06-06T12:00:00.000',
      'sections': ['All', 'Beverage'],
      'tickets': [
        {
          'id': 'EXP-ORD-1846',
          'orderId': 'ORD-1846',
          'kotNumber': 'KOT #1846',
          'section': 'Beverage',
          'location': 'Takeaway',
          'tableNumber': null,
          'deliveryType': 'Takeaway',
          'summary': '2x Cold coffee',
          'status': 'awaiting_validation',
          'finalValidated': false,
          'packagingVerified': false,
          'dispatchApproved': false,
          'availableActions': ['validate_final', 'verify_packaging', 'hold'],
        },
      ],
      'coordinationGroups': [
        {
          'id': 'COORD-12',
          'location': 'Table 12',
          'tableNumber': '12',
          'syncStatus': 'pending',
          'allReady': false,
          'sections': [
            {
              'section': 'Tandoor',
              'kotNumber': 'KOT #1842',
              'status': 'preparing',
            },
          ],
        },
      ],
      'tableSync': [
        {
          'tableNumber': '12',
          'location': 'Table 12',
          'kotCount': 3,
          'syncStatus': 'pending',
          'lastSyncedAt': '2026-06-06T11:54:00.000',
        },
      ],
      'stats': {
        'awaitingValidation': 1,
        'coordinationGroups': 1,
        'packagingChecks': 0,
        'dispatchReady': 0,
        'dispatchedToday': 2,
        'tablesSynced': 0,
      },
      'expeditorFeatures': {
        'finalOrderValidation': true,
        'multiSectionCoordination': true,
        'tableSynchronization': true,
        'dispatchApproval': false,
        'packagingVerification': true,
      },
    });

    expect(snapshot.tickets.length, 1);
    expect(snapshot.coordinationGroups.first.location, 'Table 12');
    expect(snapshot.expeditorFeatures.tableSynchronization, isTrue);
    expect(snapshot.stats.dispatchedToday, 2);
  });
}
