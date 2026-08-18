import 'mock_prep_registry.dart';
import 'mock_section_registry.dart';

class MockPrepEngine {
  const MockPrepEngine._();

  static Map<String, dynamic> buildSnapshot({String section = 'All'}) {
    MockPrepRegistry.tickTimers();
    final tasks = MockPrepRegistry.tasksFor(section).map(_serializeTask).toList();

    final active = tasks.where((t) => t['status'] == 'in_progress').length;
    final paused = tasks.where((t) => t['status'] == 'paused').length;
    final pending = tasks.where((t) => t['status'] == 'pending').length;
    final alerts = tasks
        .expand((t) => t['alerts'] as List<dynamic>)
        .length;

    return {
      'section': section,
      'lastSyncedAt': DateTime.now().toIso8601String(),
      'tasks': tasks,
      'stats': {
        'total': tasks.length,
        'active': active,
        'paused': paused,
        'pending': pending,
        'alerts': alerts,
      },
      'prepModes': _modeSummary(tasks),
      'stationLoad': _stationLoad(tasks),
      'sections': MockSectionRegistry.filterSections,
    };
  }

  static Map<String, dynamic> performAction(
    String taskId,
    String action, {
    int? stepIndex,
    String? ingredient,
    String? mode,
  }) {
    final updated = MockPrepRegistry.performAction(
      taskId,
      action,
      stepIndex: stepIndex,
      ingredient: ingredient,
      mode: mode,
    );
    return {
      'success': true,
      'task': updated,
    };
  }

  static List<Map<String, dynamic>> _modeSummary(
    List<Map<String, dynamic>> tasks,
  ) {
    final counts = <String, int>{};
    for (final task in tasks) {
      final mode = task['mode'] as String;
      counts[mode] = (counts[mode] ?? 0) + 1;
    }
    return counts.entries
        .map(
          (entry) => {
            'mode': entry.key,
            'label': _modeLabel(entry.key),
            'count': entry.value,
          },
        )
        .toList();
  }

  static List<Map<String, dynamic>> _stationLoad(
    List<Map<String, dynamic>> tasks,
  ) {
    final loads = <String, List<double>>{};
    for (final task in tasks) {
      loads.putIfAbsent(task['section'] as String, () => []).add(
            (task['progress'] as num).toDouble(),
          );
    }

    return loads.entries
        .map(
          (entry) {
            final avg = entry.value.reduce((a, b) => a + b) / entry.value.length;
            return {
              'section': entry.key,
              'load': avg,
              'taskCount': entry.value.length,
            };
          },
        )
        .toList()
      ..sort((a, b) => (b['load'] as double).compareTo(a['load'] as double));
  }

  static Map<String, dynamic> _serializeTask(Map<String, dynamic> task) {
    final timerSeconds = task['timerSeconds'] as int;
    final timerTarget = task['timerTargetSeconds'] as int;
    return {
      'id': task['id'],
      'orderId': task['orderId'],
      'kotNumber': task['kotNumber'],
      'section': task['section'],
      'dishName': task['dishName'],
      'location': task['location'],
      'assignedChef': task['assignedChef'],
      'mode': task['mode'],
      'modeLabel': _modeLabel(task['mode'] as String),
      'status': task['status'],
      'statusLabel': _statusLabel(task['status'] as String),
      'timerSeconds': timerSeconds,
      'timerTargetSeconds': timerTarget,
      'timer': _formatDuration(timerSeconds),
      'timerRemaining': _formatDuration(
        (timerTarget - timerSeconds).clamp(0, timerTarget),
      ),
      'portions': task['portions'],
      'progress': task['progress'],
      'steps': task['steps'],
      'ingredients': task['ingredients'],
      'alerts': task['alerts'],
      'vip': task['vip'],
      'allergy': task['allergy'],
      'availableActions': MockPrepRegistry.availableActions(task),
    };
  }

  static String _modeLabel(String mode) {
    return switch (mode) {
      'standard' => 'Standard preparation',
      'fast' => 'Fast preparation',
      'premium' => 'Premium preparation',
      'bulk' => 'Bulk preparation',
      'scheduled' => 'Scheduled preparation',
      _ => mode,
    };
  }

  static String _statusLabel(String status) {
    return switch (status) {
      'pending' => 'Awaiting start',
      'in_progress' => 'In preparation',
      'paused' => 'Paused',
      'completed' => 'Completed',
      _ => status,
    };
  }

  static String _formatDuration(int seconds) {
    final minutes = seconds ~/ 60;
    final remainder = seconds % 60;
    return '${minutes.toString().padLeft(2, '0')}:${remainder.toString().padLeft(2, '0')}';
  }
}
