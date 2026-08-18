import 'mock_order_store.dart';

class MockWaiterAutoAssignmentEngine {
  const MockWaiterAutoAssignmentEngine._();

  static final List<Map<String, dynamic>> _waiters = _seedWaiters();
  static final List<Map<String, dynamic>> _tasks = _seedTasks();
  static final List<Map<String, dynamic>> _notifications = _seedNotifications();
  static int _autoAssignmentsToday = 4;
  static int _deliveriesConfirmedToday = 2;

  static Map<String, dynamic> buildSnapshot({String section = 'All'}) {
    _syncReadyNotifications();

    final tasks = _tasksFor(section);
    final notifications = _notificationsFor(section);
    final workload = _waiters.map(_serializeWorkload).toList();

    return {
      'filterSection': section,
      'tasks': tasks,
      'notifications': notifications,
      'workloadBoard': workload,
      'stats': {
        'openTasks': tasks.where((t) => t['status'] != 'delivered').length,
        'readyNotifications':
            notifications.where((n) => n['status'] == 'new').length,
        'deliveriesConfirmedToday': _deliveriesConfirmedToday,
        'autoAssignmentsToday': _autoAssignmentsToday,
        'balancedWaiters':
            workload.where((w) => w['status'] == 'balanced').length,
      },
      'featureFlags': {
        'autoTaskAllocation': true,
        'orderReadyNotifications': true,
        'deliveryConfirmation': true,
        'workloadBalanceAlgorithm': true,
        'inHotelNavigation': false,
        'noManualCalling': true,
      },
      'lastSyncedAt': DateTime.now().toIso8601String(),
    };
  }

  static Map<String, dynamic> autoAllocate() {
    final pending = _tasks.where((task) => task['status'] == 'ready').toList();
    if (pending.isEmpty) {
      return {
        'success': true,
        'message': 'No ready orders waiting for waiter assignment.',
      };
    }

    for (final task in pending) {
      final waiter = _pickBalancedWaiter();
      task['assignedWaiter'] = waiter['name'];
      task['waiterId'] = waiter['id'];
      task['status'] = 'assigned';
      task['message'] = 'Auto-assigned to ${waiter['name']}';
      waiter['activeTasks'] = (waiter['activeTasks'] as int) + 1;
      _autoAssignmentsToday += 1;

      _notifications.insert(0, {
        'id': 'WRN-${DateTime.now().millisecondsSinceEpoch}',
        'title': 'Order Ready – Table ${task['tableNumber']}',
        'body':
            'Kitchen marked ${task['kotNumber']} ready. Deliver to table ${task['tableNumber']}.',
        'tableNumber': task['tableNumber'],
        'status': 'new',
        'createdAt': 'Just now',
        'availableActions': const ['acknowledge', 'start_delivery'],
      });
    }

    _rebalanceWorkload();
    return {
      'success': true,
      'message':
          'Auto-assigned ${pending.length} ready order(s) to balanced waiters.',
    };
  }

  static Map<String, dynamic> balanceWorkload() {
    _rebalanceWorkload();
    return {
      'success': true,
      'message': 'Workload balance algorithm updated waiter queues.',
    };
  }

  static Map<String, dynamic> performTaskAction({
    required String taskId,
    required String action,
  }) {
    final task = _findTask(taskId);
    if (task == null) {
      throw ArgumentError('Waiter task not found');
    }

    final table = task['tableNumber'];
    final kot = task['kotNumber'];

    switch (action) {
      case 'accept_task':
        task['status'] = 'accepted';
        task['message'] = 'Task accepted · heading to kitchen pass';
        return {'success': true, 'message': 'Task accepted · $kot'};
      case 'start_delivery':
        task['status'] = 'delivering';
        task['message'] = 'En route to table $table';
        return {'success': true, 'message': 'Delivery started · Table $table'};
      case 'confirm_delivery':
        task['status'] = 'delivered';
        task['message'] = 'Delivered and confirmed · Table $table';
        _deliveriesConfirmedToday += 1;
        _releaseWaiterTask(task['waiterId'] as String?);
        return {
          'success': true,
          'message': 'Delivery confirmed · Table $table',
        };
      default:
        throw ArgumentError('Unknown waiter task action: $action');
    }
  }

  static Map<String, dynamic> performNotificationAction({
    required String notificationId,
    required String action,
  }) {
    Map<String, dynamic>? notification;
    for (final item in _notifications) {
      if (item['id'] == notificationId) {
        notification = item;
        break;
      }
    }
    if (notification == null) {
      throw ArgumentError('Waiter notification not found');
    }

    switch (action) {
      case 'acknowledge':
        notification['status'] = 'acknowledged';
        return {
          'success': true,
          'message': 'Notification acknowledged · ${notification['title']}',
        };
      case 'start_delivery':
        notification['status'] = 'in_progress';
        final table = notification['tableNumber'];
        for (final item in _tasks) {
          if (item['tableNumber'] == table) {
            item['status'] = 'delivering';
            break;
          }
        }
        return {
          'success': true,
          'message': 'Started delivery for table $table',
        };
      default:
        throw ArgumentError('Unknown notification action: $action');
    }
  }

  static void _syncReadyNotifications() {
    final readyOrders = MockOrderStore.orders
        .where((order) => order['status'] == 'ready')
        .take(3);

    for (final order in readyOrders) {
      final table = order['tableNumber']?.toString() ?? '—';
      final exists = _tasks.any((task) => task['orderId'] == order['id']);
      if (exists) {
        continue;
      }

      _tasks.add({
        'id': 'WTS-${order['id']}',
        'orderId': order['id'],
        'kotNumber': order['kotNumber'],
        'tableNumber': table,
        'roomNumber': order['roomNumber'],
        'section': order['section'],
        'assignedWaiter': 'Pending auto-assign',
        'waiterId': null,
        'status': 'ready',
        'priority': order['guestType'] == 'VIP' ? 'vip' : 'normal',
        'message': 'Kitchen ready · awaiting auto assignment',
        'availableActions': const ['accept_task'],
      });
    }
  }

  static List<Map<String, dynamic>> _tasksFor(String section) {
    return _tasks
        .where((task) => section == 'All' || task['section'] == section)
        .map(_serializeTask)
        .toList();
  }

  static List<Map<String, dynamic>> _notificationsFor(String section) {
    if (section == 'All') {
      return _notifications.map(Map<String, dynamic>.from).toList();
    }
    return _notifications
        .where((item) => item['tableNumber'] != null)
        .map(Map<String, dynamic>.from)
        .toList();
  }

  static Map<String, dynamic> _serializeTask(Map<String, dynamic> task) {
    return {
      'id': task['id'],
      'orderId': task['orderId'],
      'kotNumber': task['kotNumber'],
      'tableNumber': task['tableNumber'],
      'roomNumber': task['roomNumber'],
      'assignedWaiter': task['assignedWaiter'],
      'status': task['status'],
      'priority': task['priority'],
      'message': task['message'],
      'availableActions': _actionsForTask(task),
    };
  }

  static List<String> _actionsForTask(Map<String, dynamic> task) {
    return switch (task['status']) {
      'ready' => const ['accept_task'],
      'assigned' || 'accepted' => const ['start_delivery', 'confirm_delivery'],
      'delivering' => const ['confirm_delivery'],
      _ => const <String>[],
    };
  }

  static Map<String, dynamic> _serializeWorkload(Map<String, dynamic> waiter) {
    final active = waiter['activeTasks'] as int;
    final status = active <= 1
        ? 'balanced'
        : active == 2
            ? 'busy'
            : 'overloaded';
    waiter['status'] = status;
    waiter['loadScore'] = (active * 0.35).clamp(0, 1.0);

    return {
      'waiterId': waiter['id'],
      'waiterName': waiter['name'],
      'activeTasks': active,
      'completedToday': waiter['completedToday'],
      'loadScore': waiter['loadScore'],
      'status': status,
    };
  }

  static Map<String, dynamic> _pickBalancedWaiter() {
    _waiters.sort(
      (a, b) => (a['activeTasks'] as int).compareTo(b['activeTasks'] as int),
    );
    return _waiters.first;
  }

  static void _rebalanceWorkload() {
    for (final waiter in _waiters) {
      final active = waiter['activeTasks'] as int;
      if (active > 2) {
        waiter['status'] = 'rebalanced';
      }
    }
  }

  static void _releaseWaiterTask(String? waiterId) {
    if (waiterId == null) {
      return;
    }
    for (final waiter in _waiters) {
      if (waiter['id'] == waiterId) {
        waiter['activeTasks'] = ((waiter['activeTasks'] as int) - 1).clamp(0, 99);
        waiter['completedToday'] = (waiter['completedToday'] as int) + 1;
        return;
      }
    }
  }

  static Map<String, dynamic>? _findTask(String taskId) {
    for (final task in _tasks) {
      if (task['id'] == taskId) {
        return task;
      }
    }
    return null;
  }

  static List<Map<String, dynamic>> _seedWaiters() {
    return [
      {
        'id': 'WTR-001',
        'name': 'Rohan Waiter',
        'activeTasks': 1,
        'completedToday': 6,
      },
      {
        'id': 'WTR-002',
        'name': 'Priya Floor',
        'activeTasks': 2,
        'completedToday': 5,
      },
      {
        'id': 'WTR-003',
        'name': 'Amit Service',
        'activeTasks': 0,
        'completedToday': 4,
      },
    ];
  }

  static List<Map<String, dynamic>> _seedTasks() {
    return [
      {
        'id': 'WTS-001',
        'orderId': 'ORD-1801',
        'kotNumber': 'KOT #1801',
        'tableNumber': '12',
        'roomNumber': null,
        'section': 'Main',
        'assignedWaiter': 'Rohan Waiter',
        'waiterId': 'WTR-001',
        'status': 'assigned',
        'priority': 'normal',
        'message': 'Auto-assigned · Order Ready – Table 12',
        'availableActions': const ['start_delivery', 'confirm_delivery'],
      },
      {
        'id': 'WTS-002',
        'orderId': 'ORD-1802',
        'kotNumber': 'KOT #1802',
        'tableNumber': '7',
        'roomNumber': null,
        'section': 'Main',
        'assignedWaiter': 'Priya Floor',
        'waiterId': 'WTR-002',
        'status': 'delivering',
        'priority': 'vip',
        'message': 'VIP table · en route from kitchen pass',
        'availableActions': const ['confirm_delivery'],
      },
    ];
  }

  static List<Map<String, dynamic>> _seedNotifications() {
    return [
      {
        'id': 'WRN-001',
        'title': 'Order Ready – Table 12',
        'body': 'Kitchen marked KOT #1801 ready. Deliver to table 12.',
        'tableNumber': '12',
        'status': 'new',
        'createdAt': '1 min ago',
        'availableActions': const ['acknowledge', 'start_delivery'],
      },
      {
        'id': 'WRN-002',
        'title': 'Order Ready – Table 7',
        'body': 'VIP order ready. Priority delivery to table 7.',
        'tableNumber': '7',
        'status': 'acknowledged',
        'createdAt': '4 min ago',
        'availableActions': const ['start_delivery'],
      },
    ];
  }
}
