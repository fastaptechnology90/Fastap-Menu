import 'package:flutter_test/flutter_test.dart';

import 'package:kitchenapp/models/communication/kitchen_communication_snapshot.dart';

void main() {
  test('kitchen communication snapshot parses API payload', () {
    final snapshot = KitchenCommunicationSnapshot.fromJson({
      'section': 'All',
      'lastSyncedAt': '2026-06-06T12:00:00.000',
      'sections': ['All', 'Main'],
      'threads': [
        {
          'id': 'CHAT-804',
          'orderId': 'ORD-1843',
          'kotNumber': 'KOT #1843',
          'waiterName': 'Waiter Ankit',
          'section': 'Main',
          'location': 'Room 804',
          'unreadCount': 2,
          'lastMessageAt': '2026-06-06T11:56:00.000',
          'messages': [
            {
              'id': 'MSG-101',
              'sender': 'Waiter Ankit',
              'senderRole': 'waiter',
              'body': 'Guest asking ETA for VIP dal',
              'type': 'text',
              'sentAt': '2026-06-06T11:54:00.000',
            },
          ],
        },
      ],
      'announcements': [
        {
          'id': 'ANN-001',
          'title': 'Banquet A dessert sync',
          'body': 'Fire dessert batch together at 21:30',
          'author': 'Chef Arjun Mehta',
          'scope': 'Dessert',
          'postedAt': '2026-06-06T11:25:00.000',
        },
      ],
      'broadcasts': [
        {
          'id': 'BC-001',
          'message': 'Rush window starting in 15 minutes',
          'author': 'Kitchen Manager Dev',
          'scope': 'All',
          'sentAt': '2026-06-06T11:50:00.000',
        },
      ],
      'smartAlerts': [
        {
          'id': 'OOS-001',
          'type': 'out_of_stock',
          'title': 'Out of stock alert',
          'detail': 'Fresh basil unavailable',
          'orderId': 'ORD-1849',
          'section': 'Salad',
          'severity': 'medium',
          'status': 'open',
          'availableActions': ['acknowledge', 'resolve'],
          'createdAt': '2026-06-06T11:38:00.000',
        },
      ],
      'stats': {
        'threads': 1,
        'unreadMessages': 2,
        'announcements': 1,
        'broadcasts': 1,
        'openAlerts': 1,
        'voiceNotes': 0,
      },
      'communicationFeatures': {
        'waiterKitchenChat': true,
        'voiceNotes': true,
        'delayUpdates': true,
        'itemAvailabilityAlerts': true,
        'chefAnnouncements': true,
        'broadcastMessages': true,
        'outOfStockAlerts': true,
        'delayWarnings': false,
        'urgentOrderAlerts': false,
        'modificationRequests': false,
        'refireRequests': false,
      },
    });

    expect(snapshot.threads.length, 1);
    expect(snapshot.stats.unreadMessages, 2);
    expect(snapshot.communicationFeatures.waiterKitchenChat, isTrue);
    expect(snapshot.smartAlerts.first.type, 'out_of_stock');
  });
}
