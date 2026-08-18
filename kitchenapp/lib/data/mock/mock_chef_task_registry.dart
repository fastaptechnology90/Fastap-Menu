import 'mock_order_store.dart';
import 'mock_section_registry.dart';
import 'mock_staff_directory.dart';

class MockChefTaskRegistry {
  MockChefTaskRegistry._();

  static final List<Map<String, dynamic>> _tasks = _seedTasks();

  static List<Map<String, dynamic>> tasksFor(String section) {
    final copy = _tasks.map(_cloneTask).toList();
    if (section == 'All') {
      return copy;
    }
    return copy.where((task) => task['section'] == section).toList();
  }

  static Map<String, dynamic>? findById(String id) {
    for (final task in _tasks) {
      if (task['id'] == id) {
        return task;
      }
    }
    return null;
  }

  static List<Map<String, dynamic>> chefsForSection(String section) {
    return MockStaffDirectory.all
        .where(
          (staff) => section == 'All' || staff['section'] == section,
        )
        .map(
          (staff) => {
            'id': staff['id'],
            'name': staff['name'],
            'role': staff['role'],
            'section': staff['section'],
          },
        )
        .toList();
  }

  static List<String> availableActions(Map<String, dynamic> task) {
    final status = task['status'] as String;
    final actions = <String>[];

    if (status == 'assigned') {
      actions.add('start');
    }
    if (status == 'in_progress') {
      actions.addAll(['complete', 'transfer', 'mark_waiting', 'escalate']);
    }
    if (status == 'waiting') {
      actions.add('resume');
    }
    if (status == 'delayed') {
      actions.addAll(['resume', 'escalate', 'transfer']);
    }
    if (status != 'completed') {
      actions.add('reassign');
    }

    return actions;
  }

  static Map<String, dynamic> performAction(
    String taskId,
    String action, {
    String? targetChefId,
    String? targetChefName,
  }) {
    final task = findById(taskId);
    if (task == null) {
      throw ArgumentError('Chef task not found');
    }

    switch (action) {
      case 'start':
        task['status'] = 'in_progress';
      case 'complete':
        task['status'] = 'completed';
        task['progress'] = 1.0;
        _syncOrderChef(task);
      case 'mark_waiting':
        task['status'] = 'waiting';
      case 'resume':
        task['status'] = 'in_progress';
      case 'escalate':
        task['status'] = 'escalated';
        task['priority'] = 'high';
      case 'transfer':
      case 'reassign':
        if (targetChefId != null || targetChefName != null) {
          _assignChef(task, targetChefId: targetChefId, name: targetChefName);
        } else {
          throw ArgumentError('Target chef required');
        }
      default:
        throw ArgumentError('Unknown chef task action: $action');
    }

    return _cloneTask(task);
  }

  static Map<String, dynamic> balanceWorkload() {
    final active = _tasks.where(
      (task) => !{'completed'}.contains(task['status']),
    ).toList();

    final loads = <String, int>{};
    for (final task in active) {
      final chef = task['assignedChef'] as String;
      loads[chef] = (loads[chef] ?? 0) + 1;
    }

    if (loads.length < 2) {
      return {'moved': 0, 'message': 'Workload already balanced'};
    }

    final busiest = loads.entries.reduce((a, b) => a.value >= b.value ? a : b);
    final lightest = loads.entries.reduce((a, b) => a.value <= b.value ? a : b);
    if (busiest.value - lightest.value <= 1) {
      return {'moved': 0, 'message': 'Section workload is balanced'};
    }

    final movable = active.firstWhere(
      (task) =>
          task['assignedChef'] == busiest.key && task['status'] == 'assigned',
      orElse: () => active.first,
    );
    _assignChef(movable, name: lightest.key);
    return {
      'moved': 1,
      'message': 'Transferred 1 task from ${busiest.key} to ${lightest.key}',
    };
  }

  static void _assignChef(
    Map<String, dynamic> task, {
    String? targetChefId,
    String? name,
  }) {
    Map<String, dynamic>? staff;
    if (targetChefId != null) {
      staff = MockStaffDirectory.all.firstWhere(
        (item) => item['id'] == targetChefId,
        orElse: () => MockStaffDirectory.all.first,
      );
    } else if (name != null) {
      staff = MockStaffDirectory.all.firstWhere(
        (item) => item['name'] == name,
        orElse: () => MockStaffDirectory.all.first,
      );
    }
    if (staff != null) {
      task['assignedChef'] = staff['name'];
      task['assignedChefId'] = staff['id'];
      task['skillTag'] = staff['role'];
      task['section'] = staff['section'];
      _syncOrderChef(task);
    }
  }

  static void _syncOrderChef(Map<String, dynamic> task) {
    final order = MockOrderStore.findById(task['orderId'] as String);
    if (order != null) {
      order['assignedChef'] = task['assignedChef'];
    }
  }

  static Map<String, dynamic> _cloneTask(Map<String, dynamic> task) {
    return {
      ...task,
      'coordination': List<String>.from(task['coordination'] as List),
    };
  }

  static List<Map<String, dynamic>> _seedTasks() {
    return [
      _task(
        id: 'TASK-1842',
        orderId: 'ORD-1842',
        kotNumber: 'KOT #1842',
        title: 'Prepare Tandoori platter',
        section: 'Tandoor',
        assignedChef: 'Ravi Tandoor',
        assignedChefId: 'STF-003',
        skillTag: 'tandoorChef',
        status: 'in_progress',
        priority: 'normal',
        progress: 0.62,
        workloadScore: 0.72,
        coordination: ['Naan batch with Main section'],
      ),
      _task(
        id: 'TASK-1843',
        orderId: 'ORD-1843',
        kotNumber: 'KOT #1843',
        title: 'VIP dal makhani service',
        section: 'Main',
        assignedChef: 'Chef Arjun Mehta',
        assignedChefId: 'STF-001',
        skillTag: 'headChef',
        status: 'in_progress',
        priority: 'vip',
        progress: 0.78,
        workloadScore: 0.81,
        coordination: ['Allergy protocol with Safety team'],
      ),
      _task(
        id: 'TASK-1844',
        orderId: 'ORD-1844',
        kotNumber: 'KOT #1844',
        title: 'Hakka noodles express',
        section: 'Chinese',
        assignedChef: 'Mei Lin',
        assignedChefId: 'STF-004',
        skillTag: 'chineseChef',
        status: 'delayed',
        priority: 'express',
        progress: 0.36,
        workloadScore: 0.94,
        coordination: ['Rider waiting · dispatch sync'],
      ),
      _task(
        id: 'TASK-1845',
        orderId: 'ORD-1845',
        kotNumber: 'KOT #1845',
        title: 'Banquet dessert batch',
        section: 'Dessert',
        assignedChef: 'Dessert Team',
        assignedChefId: 'STF-002',
        skillTag: 'sousChef',
        status: 'in_progress',
        priority: 'event',
        progress: 0.54,
        workloadScore: 0.88,
        coordination: ['Multi-chef batch service'],
      ),
      _task(
        id: 'TASK-1847',
        orderId: 'ORD-1847',
        kotNumber: 'KOT #1847',
        title: 'Grilled fish QC',
        section: 'Grill',
        assignedChef: 'Grill Station',
        assignedChefId: 'STF-002',
        skillTag: 'sousChef',
        status: 'waiting',
        priority: 'normal',
        progress: 0.49,
        workloadScore: 0.55,
        coordination: ['On hold · allergy nearby'],
      ),
      _task(
        id: 'TASK-1848',
        orderId: 'ORD-1848',
        kotNumber: 'KOT #1848',
        title: 'Swiggy fry order',
        section: 'Fry',
        assignedChef: 'Fry Station',
        assignedChefId: 'STF-004',
        skillTag: 'chineseChef',
        status: 'assigned',
        priority: 'express',
        progress: 0.08,
        workloadScore: 0.42,
        coordination: const [],
      ),
      _task(
        id: 'TASK-1849',
        orderId: 'ORD-1849',
        kotNumber: 'KOT #1849',
        title: 'Caesar salad prep',
        section: 'Salad',
        assignedChef: 'Cold Prep',
        assignedChefId: 'STF-002',
        skillTag: 'sousChef',
        status: 'assigned',
        priority: 'normal',
        progress: 0.25,
        workloadScore: 0.38,
        coordination: ['Jain preparation lane'],
      ),
    ];
  }

  static Map<String, dynamic> _task({
    required String id,
    required String orderId,
    required String kotNumber,
    required String title,
    required String section,
    required String assignedChef,
    required String assignedChefId,
    required String skillTag,
    required String status,
    required String priority,
    required double progress,
    required double workloadScore,
    required List<String> coordination,
  }) {
    return {
      'id': id,
      'orderId': orderId,
      'kotNumber': kotNumber,
      'title': title,
      'section': section,
      'assignedChef': assignedChef,
      'assignedChefId': assignedChefId,
      'skillTag': skillTag,
      'shiftId': 'SHIFT-LIVE',
      'status': status,
      'statusLabel': _statusLabel(status),
      'priority': priority,
      'progress': progress,
      'workloadScore': workloadScore,
      'coordination': coordination,
    };
  }

  static String _statusLabel(String status) {
    return switch (status) {
      'assigned' => 'Assigned',
      'in_progress' => 'In progress',
      'waiting' => 'Waiting',
      'completed' => 'Completed',
      'delayed' => 'Delayed',
      'escalated' => 'Escalated',
      _ => status,
    };
  }
}

class MockChefTaskEngine {
  const MockChefTaskEngine._();

  static Map<String, dynamic> buildSnapshot({String section = 'All'}) {
    final tasks = MockChefTaskRegistry.tasksFor(section)
        .map(_serializeTask)
        .toList();

    final assigned = tasks.where((t) => t['status'] == 'assigned').length;
    final inProgress = tasks.where((t) => t['status'] == 'in_progress').length;
    final waiting = tasks.where((t) => t['status'] == 'waiting').length;
    final delayed = tasks.where((t) => t['status'] == 'delayed').length;
    final escalated = tasks.where((t) => t['status'] == 'escalated').length;

    return {
      'section': section,
      'lastSyncedAt': DateTime.now().toIso8601String(),
      'tasks': tasks,
      'chefs': MockChefTaskRegistry.chefsForSection(section),
      'stats': {
        'total': tasks.length,
        'assigned': assigned,
        'inProgress': inProgress,
        'waiting': waiting,
        'delayed': delayed,
        'escalated': escalated,
      },
      'workloadBoard': _workloadBoard(tasks),
      'sections': MockSectionRegistry.filterSections,
    };
  }

  static Map<String, dynamic> performAction(
    String taskId,
    String action, {
    String? targetChefId,
    String? targetChefName,
  }) {
    final updated = MockChefTaskRegistry.performAction(
      taskId,
      action,
      targetChefId: targetChefId,
      targetChefName: targetChefName,
    );
    return {
      'success': true,
      'task': updated,
    };
  }

  static Map<String, dynamic> balanceWorkload() {
    final result = MockChefTaskRegistry.balanceWorkload();
    return {
      'success': true,
      ...result,
    };
  }

  static List<Map<String, dynamic>> _workloadBoard(
    List<Map<String, dynamic>> tasks,
  ) {
    final loads = <String, List<double>>{};
    for (final task in tasks) {
      loads.putIfAbsent(task['assignedChef'] as String, () => []).add(
            (task['workloadScore'] as num).toDouble(),
          );
    }

    return loads.entries
        .map(
          (entry) {
            final avg = entry.value.reduce((a, b) => a + b) / entry.value.length;
            return {
              'chef': entry.key,
              'taskCount': entry.value.length,
              'load': avg,
            };
          },
        )
        .toList()
      ..sort((a, b) => (b['load'] as double).compareTo(a['load'] as double));
  }

  static Map<String, dynamic> _serializeTask(Map<String, dynamic> task) {
    return {
      ...task,
      'availableActions': MockChefTaskRegistry.availableActions(task),
    };
  }
}
