import 'package:flutter_test/flutter_test.dart';

import 'package:kitchenapp/models/returns/customer_return_snapshot.dart';

void main() {
  test('customer return snapshot parses API payload', () {
    final snapshot = CustomerReturnSnapshot.fromJson({
      'section': 'All',
      'lastSyncedAt': '2026-06-06T12:00:00.000',
      'sections': ['All', 'Main'],
      'returnRequests': [
        {
          'id': 'RET-001',
          'orderId': 'ORD-1851',
          'kotNumber': 'KOT #1851',
          'section': 'Main',
          'location': 'Table 2',
          'dishName': '1x Paneer tikka',
          'returnType': 'wrong_item',
          'reason': 'Guest received wrong spice level',
          'status': 'open',
          'priorityRemake': false,
          'complaintTags': ['Wrong spice level'],
          'availableActions': ['wrong_item_replacement', 'refire_request', 'resolve'],
        },
      ],
      'complaintTags': [
        {
          'id': 'TAG-001',
          'returnId': 'RET-001',
          'orderId': 'ORD-1851',
          'kotNumber': 'KOT #1851',
          'tag': 'Wrong spice level',
          'severity': 'medium',
          'loggedAt': '2026-06-06T11:38:00.000',
        },
      ],
      'history': [
        {
          'id': 'RHIS-001',
          'orderId': 'ORD-1840',
          'kotNumber': 'KOT #1840',
          'section': 'Chinese',
          'action': 'refire_request',
          'summary': 'Re-fire completed',
          'loggedAt': '2026-06-06T09:00:00.000',
        },
      ],
      'stats': {
        'openReturns': 1,
        'priorityRemakes': 0,
        'refireQueue': 0,
        'complaintTags': 1,
        'resolvedToday': 0,
        'wrongItemCount': 1,
        'burntItemCount': 0,
      },
      'returnFeatures': {
        'wrongItemReplacement': true,
        'burntItemReplacement': false,
        'refireRequest': false,
        'priorityRemake': false,
        'complaintTagging': true,
      },
    });

    expect(snapshot.returnRequests.length, 1);
    expect(snapshot.returnRequests.first.returnType, 'wrong_item');
    expect(snapshot.returnFeatures.complaintTagging, isTrue);
    expect(snapshot.stats.wrongItemCount, 1);
  });
}
