import 'mock_order_store.dart';
import 'mock_section_registry.dart';

class MockKitchenCommunicationRegistry {
  MockKitchenCommunicationRegistry._();

  static int _messageCounter = 200;

  static final List<Map<String, dynamic>> _threads = _seedThreads();
  static final List<Map<String, dynamic>> _announcements = _seedAnnouncements();
  static final List<Map<String, dynamic>> _broadcasts = _seedBroadcasts();
  static final List<Map<String, dynamic>> _smartAlerts = _seedSmartAlerts();

  static List<Map<String, dynamic>> threadsFor(String section) {
    if (section == 'All') {
      return _threads.map(_cloneThread).toList();
    }
    return _threads
        .where((thread) => thread['section'] == section)
        .map(_cloneThread)
        .toList();
  }

  static List<Map<String, dynamic>> announcementsFor(String section) {
    if (section == 'All') {
      return _announcements.map(Map<String, dynamic>.from).toList();
    }
    return _announcements
        .where(
          (item) =>
              item['scope'] == 'All' || item['scope'] == section,
        )
        .map(Map<String, dynamic>.from)
        .toList();
  }

  static List<Map<String, dynamic>> broadcastsFor(String section) {
    if (section == 'All') {
      return _broadcasts.map(Map<String, dynamic>.from).toList();
    }
    return _broadcasts
        .where(
          (item) =>
              item['scope'] == 'All' || item['scope'] == section,
        )
        .map(Map<String, dynamic>.from)
        .toList();
  }

  static List<Map<String, dynamic>> smartAlertsFor(String section) {
    _syncAlertsFromOrders();
    final alerts = section == 'All'
        ? _smartAlerts
        : _smartAlerts.where((alert) => alert['section'] == section);
    return alerts.map(Map<String, dynamic>.from).toList();
  }

  static Map<String, dynamic> sendMessage({
    required String threadId,
    required String message,
    required String sender,
  }) {
    final thread = _findThread(threadId);
    if (thread == null) {
      throw ArgumentError('Chat thread not found');
    }

    _messageCounter++;
    final entry = {
      'id': 'MSG-$_messageCounter',
      'sender': sender,
      'senderRole': 'kitchen',
      'body': message.trim(),
      'type': 'text',
      'sentAt': DateTime.now().toIso8601String(),
    };
    (thread['messages'] as List<dynamic>).add(entry);
    thread['lastMessageAt'] = entry['sentAt'];
    thread['unreadCount'] = 0;

    return {
      'success': true,
      'message': 'Reply sent to ${thread['waiterName']}',
    };
  }

  static Map<String, dynamic> sendVoiceNote({
    required String threadId,
    required String sender,
  }) {
    final thread = _findThread(threadId);
    if (thread == null) {
      throw ArgumentError('Chat thread not found');
    }

    _messageCounter++;
    (thread['messages'] as List<dynamic>).add({
      'id': 'MSG-$_messageCounter',
      'sender': sender,
      'senderRole': 'kitchen',
      'body': 'Voice note · 0:18',
      'type': 'voice',
      'sentAt': DateTime.now().toIso8601String(),
    });
    thread['lastMessageAt'] = DateTime.now().toIso8601String();

    return {
      'success': true,
      'message': 'Voice note sent to ${thread['waiterName']}',
    };
  }

  static Map<String, dynamic> sendDelayUpdate({
    required String orderId,
    required int minutes,
    required String sender,
  }) {
    final order = MockOrderStore.findById(orderId);
    if (order == null) {
      throw ArgumentError('Order not found');
    }

    MockOrderStore.processAction(orderId, 'delay');
    _messageCounter++;
    final thread = _threadForOrder(orderId);
    if (thread != null) {
      (thread['messages'] as List<dynamic>).add({
        'id': 'MSG-$_messageCounter',
        'sender': sender,
        'senderRole': 'kitchen',
        'body': 'Delay update · +$minutes minutes on ${order['kotNumber']}',
        'type': 'delay_update',
        'sentAt': DateTime.now().toIso8601String(),
      });
    }

    return {
      'success': true,
      'message': 'Delay update sent · ${order['kotNumber']} +$minutes min',
    };
  }

  static Map<String, dynamic> postAnnouncement({
    required String title,
    required String body,
    required String author,
    String scope = 'All',
  }) {
    _announcements.insert(0, {
      'id': 'ANN-${DateTime.now().millisecondsSinceEpoch}',
      'title': title.trim(),
      'body': body.trim(),
      'author': author,
      'scope': scope,
      'postedAt': DateTime.now().toIso8601String(),
    });

    return {
      'success': true,
      'message': 'Chef announcement posted',
    };
  }

  static Map<String, dynamic> sendBroadcast({
    required String message,
    required String author,
    String scope = 'All',
  }) {
    _broadcasts.insert(0, {
      'id': 'BC-${DateTime.now().millisecondsSinceEpoch}',
      'message': message.trim(),
      'author': author,
      'scope': scope,
      'sentAt': DateTime.now().toIso8601String(),
    });

    return {
      'success': true,
      'message': 'Broadcast sent to ${scope == 'All' ? 'all sections' : scope}',
    };
  }

  static Map<String, dynamic> performAlertAction({
    required String alertId,
    required String action,
  }) {
    final alert = _smartAlerts.cast<Map<String, dynamic>?>().firstWhere(
          (item) => item?['id'] == alertId,
          orElse: () => null,
        );
    if (alert == null) {
      throw ArgumentError('Alert not found');
    }

    switch (action) {
      case 'acknowledge':
        alert['status'] = 'acknowledged';
        return {
          'success': true,
          'message': 'Alert acknowledged · ${alert['title']}',
        };
      case 'respond':
        alert['status'] = 'responded';
        return {
          'success': true,
          'message': 'Response sent for ${alert['title']}',
        };
      case 'resolve':
        _smartAlerts.remove(alert);
        return {
          'success': true,
          'message': 'Alert resolved · ${alert['title']}',
        };
      default:
        throw ArgumentError('Unknown alert action: $action');
    }
  }

  static void _syncAlertsFromOrders() {
    for (final order in MockOrderStore.activeOrders('All')) {
      if (order['status'] == 'delayed' &&
          !_hasAlert('delay', order['id'] as String)) {
        _addAlert(
          type: 'delay_warning',
          title: 'Delay warning',
          detail: '${order['kotNumber']} · recovery needed',
          orderId: order['id'] as String,
          section: order['section'] as String,
          severity: 'high',
        );
      }
      if (order['reFireRequested'] == true &&
          !_hasAlert('refire', order['id'] as String)) {
        _addAlert(
          type: 'refire_request',
          title: 'Re-fire request',
          detail: '${order['kotNumber']} · re-fire in progress',
          orderId: order['id'] as String,
          section: order['section'] as String,
          severity: 'critical',
        );
      }
      if (order['vip'] == true &&
          order['status'] == 'preparing' &&
          !_hasAlert('urgent', order['id'] as String)) {
        _addAlert(
          type: 'urgent_order',
          title: 'Urgent order alert',
          detail: '${order['kotNumber']} · VIP lane active',
          orderId: order['id'] as String,
          section: order['section'] as String,
          severity: 'high',
        );
      }
    }
  }

  static bool _hasAlert(String prefix, String orderId) {
    return _smartAlerts.any((alert) => alert['id'] == '$prefix-$orderId');
  }

  static void _addAlert({
    required String type,
    required String title,
    required String detail,
    required String orderId,
    required String section,
    required String severity,
  }) {
    _smartAlerts.insert(0, {
      'id': '$type-$orderId',
      'type': type,
      'title': title,
      'detail': detail,
      'orderId': orderId,
      'section': section,
      'severity': severity,
      'status': 'open',
      'availableActions': ['acknowledge', 'respond', 'resolve'],
      'createdAt': DateTime.now().toIso8601String(),
    });
  }

  static Map<String, dynamic>? _findThread(String threadId) {
    for (final thread in _threads) {
      if (thread['id'] == threadId) {
        return thread;
      }
    }
    return null;
  }

  static Map<String, dynamic>? _threadForOrder(String orderId) {
    for (final thread in _threads) {
      if (thread['orderId'] == orderId) {
        return thread;
      }
    }
    return null;
  }

  static Map<String, dynamic> _cloneThread(Map<String, dynamic> thread) {
    return {
      ...thread,
      'messages': (thread['messages'] as List<dynamic>)
          .map((item) => Map<String, dynamic>.from(item as Map))
          .toList(),
    };
  }

  static List<Map<String, dynamic>> _seedThreads() {
    return [
      {
        'id': 'CHAT-804',
        'orderId': 'ORD-1843',
        'kotNumber': 'KOT #1843',
        'waiterName': 'Waiter Ankit',
        'section': 'Main',
        'location': 'Room 804',
        'unreadCount': 2,
        'lastMessageAt': DateTime.now()
            .subtract(const Duration(minutes: 4))
            .toIso8601String(),
        'messages': [
          {
            'id': 'MSG-101',
            'sender': 'Waiter Ankit',
            'senderRole': 'waiter',
            'body': 'Guest asking ETA for VIP dal · allergy protocol active',
            'type': 'text',
            'sentAt': DateTime.now()
                .subtract(const Duration(minutes: 6))
                .toIso8601String(),
          },
          {
            'id': 'MSG-102',
            'sender': 'Waiter Ankit',
            'senderRole': 'waiter',
            'body': 'Voice note · 0:12',
            'type': 'voice',
            'sentAt': DateTime.now()
                .subtract(const Duration(minutes: 4))
                .toIso8601String(),
          },
        ],
      },
      {
        'id': 'CHAT-1844',
        'orderId': 'ORD-1844',
        'kotNumber': 'KOT #1844',
        'waiterName': 'Dispatch Desk',
        'section': 'Chinese',
        'location': 'Zomato',
        'unreadCount': 1,
        'lastMessageAt': DateTime.now()
            .subtract(const Duration(minutes: 2))
            .toIso8601String(),
        'messages': [
          {
            'id': 'MSG-103',
            'sender': 'Dispatch Desk',
            'senderRole': 'waiter',
            'body': 'Rider waiting · need delay update on noodles order',
            'type': 'text',
            'sentAt': DateTime.now()
                .subtract(const Duration(minutes: 2))
                .toIso8601String(),
          },
        ],
      },
      {
        'id': 'CHAT-1849',
        'orderId': 'ORD-1849',
        'kotNumber': 'KOT #1849',
        'waiterName': 'Waiter Neha',
        'section': 'Salad',
        'location': 'Table 7',
        'unreadCount': 0,
        'lastMessageAt': DateTime.now()
            .subtract(const Duration(minutes: 18))
            .toIso8601String(),
        'messages': [
          {
            'id': 'MSG-104',
            'sender': 'Waiter Neha',
            'senderRole': 'waiter',
            'body': 'Modification request · extra dressing on caesar salad',
            'type': 'modification_request',
            'sentAt': DateTime.now()
                .subtract(const Duration(minutes: 18))
                .toIso8601String(),
          },
        ],
      },
    ];
  }

  static List<Map<String, dynamic>> _seedAnnouncements() {
    return [
      {
        'id': 'ANN-001',
        'title': 'Banquet A dessert sync',
        'body': 'Fire dessert batch together at 21:30 · coordinate with pastry',
        'author': 'Chef Arjun Mehta',
        'scope': 'Dessert',
        'postedAt': DateTime.now()
            .subtract(const Duration(minutes: 35))
            .toIso8601String(),
      },
      {
        'id': 'ANN-002',
        'title': 'Allergy protocol reminder',
        'body': 'VIP room 804 nut allergy · verify separate utensils',
        'author': 'Kitchen Manager Dev',
        'scope': 'All',
        'postedAt': DateTime.now()
            .subtract(const Duration(hours: 1))
            .toIso8601String(),
      },
    ];
  }

  static List<Map<String, dynamic>> _seedBroadcasts() {
    return [
      {
        'id': 'BC-001',
        'message': 'Rush window starting in 15 minutes · prep backup line',
        'author': 'Kitchen Manager Dev',
        'scope': 'All',
        'sentAt': DateTime.now()
            .subtract(const Duration(minutes: 10))
            .toIso8601String(),
      },
    ];
  }

  static List<Map<String, dynamic>> _seedSmartAlerts() {
    return [
      {
        'id': 'OOS-001',
        'type': 'out_of_stock',
        'title': 'Out of stock alert',
        'detail': 'Fresh basil unavailable · swap to spinach garnish',
        'orderId': 'ORD-1849',
        'section': 'Salad',
        'severity': 'medium',
        'status': 'open',
        'availableActions': ['acknowledge', 'respond', 'resolve'],
        'createdAt': DateTime.now()
            .subtract(const Duration(minutes: 22))
            .toIso8601String(),
      },
      {
        'id': 'AVAIL-001',
        'type': 'item_availability',
        'title': 'Item availability alert',
        'detail': 'Tandoori platter 86\'d for 20 minutes · offer alternate',
        'orderId': 'ORD-1842',
        'section': 'Tandoor',
        'severity': 'medium',
        'status': 'open',
        'availableActions': ['acknowledge', 'respond', 'resolve'],
        'createdAt': DateTime.now()
            .subtract(const Duration(minutes: 14))
            .toIso8601String(),
      },
    ];
  }
}

class MockKitchenCommunicationEngine {
  const MockKitchenCommunicationEngine._();

  static Map<String, dynamic> buildSnapshot({String section = 'All'}) {
    final threads = MockKitchenCommunicationRegistry.threadsFor(section);
    final announcements =
        MockKitchenCommunicationRegistry.announcementsFor(section);
    final broadcasts = MockKitchenCommunicationRegistry.broadcastsFor(section);
    final alerts = MockKitchenCommunicationRegistry.smartAlertsFor(section);
    final unread = threads.fold<int>(
      0,
      (sum, thread) => sum + (thread['unreadCount'] as int),
    );

    return {
      'section': section,
      'lastSyncedAt': DateTime.now().toIso8601String(),
      'threads': threads,
      'announcements': announcements,
      'broadcasts': broadcasts,
      'smartAlerts': alerts,
      'stats': {
        'threads': threads.length,
        'unreadMessages': unread,
        'announcements': announcements.length,
        'broadcasts': broadcasts.length,
        'openAlerts': alerts.where((a) => a['status'] == 'open').length,
        'voiceNotes': _countMessageType(threads, 'voice'),
      },
      'communicationFeatures': {
        'waiterKitchenChat': true,
        'voiceNotes': true,
        'delayUpdates': true,
        'itemAvailabilityAlerts': alerts.any((a) => a['type'] == 'item_availability'),
        'chefAnnouncements': announcements.isNotEmpty,
        'broadcastMessages': broadcasts.isNotEmpty,
        'outOfStockAlerts': alerts.any((a) => a['type'] == 'out_of_stock'),
        'delayWarnings': alerts.any((a) => a['type'] == 'delay_warning'),
        'urgentOrderAlerts': alerts.any((a) => a['type'] == 'urgent_order'),
        'modificationRequests': _hasModificationMessages(threads),
        'refireRequests': alerts.any((a) => a['type'] == 'refire_request'),
      },
      'sections': MockSectionRegistry.filterSections,
    };
  }

  static int _countMessageType(
    List<Map<String, dynamic>> threads,
    String type,
  ) {
    var count = 0;
    for (final thread in threads) {
      for (final message in thread['messages'] as List<dynamic>) {
        if (message['type'] == type) {
          count++;
        }
      }
    }
    return count;
  }

  static bool _hasModificationMessages(List<Map<String, dynamic>> threads) {
    for (final thread in threads) {
      for (final message in thread['messages'] as List<dynamic>) {
        if (message['type'] == 'modification_request') {
          return true;
        }
      }
    }
    return false;
  }
}
