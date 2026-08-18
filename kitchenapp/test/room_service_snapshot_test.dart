import 'package:flutter_test/flutter_test.dart';

import 'package:kitchenapp/models/room_service/room_service_snapshot.dart';

void main() {
  test('room service snapshot parses API payload', () {
    final snapshot = RoomServiceSnapshot.fromJson({
      'section': 'All',
      'lastSyncedAt': '2026-06-06T12:00:00.000',
      'sections': ['All', 'Main'],
      'roomOrders': [
        {
          'id': 'RS-ORD-1843',
          'orderId': 'ORD-1843',
          'kotNumber': 'KOT #1843',
          'roomNumber': '804',
          'section': 'Main',
          'guestType': 'VIP',
          'itemSummary': 'Dal makhani · Steamed rice',
          'status': 'preparing',
          'priority': 'vip',
          'timerSeconds': 282,
          'timerLabel': '04:42',
          'availableActions': ['dispatch_tray', 'complete_order'],
        },
      ],
      'vipRoomAlerts': [
        {
          'id': 'VIP-804',
          'roomNumber': '804',
          'guestName': 'VIP guest · Suite 804',
          'alertType': 'allergy_protocol',
          'priority': 'vip',
          'status': 'active',
        },
      ],
      'scheduledDeliveries': [
        {
          'id': 'SCH-1852',
          'orderId': 'ORD-1852',
          'kotNumber': 'KOT #1852',
          'roomNumber': '215',
          'scheduledTime': '20:30',
          'itemSummary': 'Club sandwich · Fries',
          'status': 'scheduled',
        },
      ],
      'trayAssignments': [
        {
          'id': 'ASG-1843',
          'trayId': 'TRAY-441',
          'roomNumber': '804',
          'orderId': 'ORD-1843',
          'kotNumber': 'KOT #1843',
          'staffName': 'Ravi Kumar',
          'status': 'assigned',
        },
      ],
      'miniBarSync': [
        {
          'id': 'MB-804',
          'roomNumber': '804',
          'itemName': 'Mineral water',
          'quantity': 2,
          'syncStatus': 'pending',
          'lastSyncedAt': '12m ago',
        },
      ],
      'stats': {
        'activeRoomOrders': 1,
        'vipRooms': 1,
        'scheduledDeliveries': 1,
        'traysInTransit': 0,
        'miniBarPending': 1,
        'completedToday': 11,
      },
      'roomServiceFeatures': {
        'roomWiseOrderTracking': true,
        'vipRoomPriority': true,
        'scheduledRoomDelivery': true,
        'trayManagement': true,
        'miniBarSynchronization': true,
      },
    });

    expect(snapshot.roomOrders.length, 1);
    expect(snapshot.roomOrders.first.roomNumber, '804');
    expect(snapshot.roomServiceFeatures.vipRoomPriority, isTrue);
    expect(snapshot.stats.completedToday, 11);
  });
}
