import 'mock_order_store.dart';

class MockPrepRegistry {
  MockPrepRegistry._();

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

  static List<String> availableActions(Map<String, dynamic> task) {
    final status = task['status'] as String;
    final actions = <String>[];

    if (status == 'pending') {
      actions.add('start');
    }
    if (status == 'in_progress') {
      actions.addAll(['pause', 'complete_step', 'complete']);
    }
    if (status == 'paused') {
      actions.add('resume');
    }

    final steps = task['steps'] as List<dynamic>;
    final hasUnchecked = (task['ingredients'] as List<dynamic>).any(
      (item) => !(item as Map)['checked'],
    );
    if (hasUnchecked) {
      actions.add('check_next_ingredient');
    }

    actions.addAll([
      'mode_standard',
      'mode_fast',
      'mode_premium',
      'mode_bulk',
      'mode_scheduled',
    ]);

    if (steps.any((step) => !(step as Map)['done'])) {
      // complete_step already added
    }

    return actions.toSet().toList();
  }

  static Map<String, dynamic> performAction(
    String taskId,
    String action, {
    int? stepIndex,
    String? ingredient,
    String? mode,
  }) {
    final task = findById(taskId);
    if (task == null) {
      throw ArgumentError('Prep task not found');
    }

    switch (action) {
      case 'start':
        task['status'] = 'in_progress';
        task['timerSeconds'] = 0;
      case 'pause':
        if (task['status'] == 'in_progress') {
          task['status'] = 'paused';
        }
      case 'resume':
        if (task['status'] == 'paused') {
          task['status'] = 'in_progress';
        }
      case 'complete':
        task['status'] = 'completed';
        task['progress'] = 1.0;
        _markOrderReady(task);
      case 'complete_step':
        _completeStep(task, stepIndex);
      case 'check_next_ingredient':
        _checkNextIngredient(task, ingredient);
      case 'mode_standard':
        task['mode'] = 'standard';
      case 'mode_fast':
        task['mode'] = 'fast';
      case 'mode_premium':
        task['mode'] = 'premium';
      case 'mode_bulk':
        task['mode'] = 'bulk';
      case 'mode_scheduled':
        task['mode'] = 'scheduled';
      default:
        if (mode != null) {
          task['mode'] = mode;
        } else {
          throw ArgumentError('Unknown prep action: $action');
        }
    }

    _refreshProgress(task);
    _refreshAlerts(task);
    return _cloneTask(task);
  }

  static void tickTimers() {
    for (final task in _tasks) {
      if (task['status'] != 'in_progress') {
        continue;
      }
      task['timerSeconds'] = (task['timerSeconds'] as int) + 1;
      _refreshProgress(task);
      _refreshAlerts(task);
    }
  }

  static void _completeStep(Map<String, dynamic> task, int? stepIndex) {
    final steps = task['steps'] as List<dynamic>;
    if (stepIndex != null) {
      for (final raw in steps) {
        final step = raw as Map<String, dynamic>;
        if (step['order'] == stepIndex) {
          step['done'] = true;
          return;
        }
      }
    }

    for (final raw in steps) {
      final step = raw as Map<String, dynamic>;
      if (step['done'] != true) {
        step['done'] = true;
        break;
      }
    }
  }

  static void _checkNextIngredient(
    Map<String, dynamic> task,
    String? ingredient,
  ) {
    final ingredients = task['ingredients'] as List<dynamic>;
    if (ingredient != null) {
      for (final raw in ingredients) {
        final item = raw as Map<String, dynamic>;
        if (item['name'] == ingredient) {
          item['checked'] = true;
          return;
        }
      }
    }

    for (final raw in ingredients) {
      final item = raw as Map<String, dynamic>;
      if (item['checked'] != true) {
        item['checked'] = true;
        break;
      }
    }
  }

  static void _markOrderReady(Map<String, dynamic> task) {
    final orderId = task['orderId'] as String?;
    if (orderId == null) {
      return;
    }
    try {
      MockOrderStore.processAction(orderId, 'ready');
    } catch (_) {
      // Ignore invalid transitions for demo data.
    }
  }

  static void _refreshProgress(Map<String, dynamic> task) {
    final steps = task['steps'] as List<dynamic>;
    final doneCount = steps.where((step) => (step as Map)['done'] == true).length;
    final stepProgress = steps.isEmpty ? 0.0 : doneCount / steps.length;
    final timerTarget = task['timerTargetSeconds'] as int;
    final timerSeconds = task['timerSeconds'] as int;
    final timerProgress = timerTarget == 0
        ? 0.0
        : (timerSeconds / timerTarget).clamp(0.0, 1.0);
    task['progress'] = ((stepProgress * 0.7) + (timerProgress * 0.3)).clamp(0.0, 0.99);
    if (task['status'] == 'completed') {
      task['progress'] = 1.0;
    }
  }

  static void _refreshAlerts(Map<String, dynamic> task) {
    final alerts = <String>[];
    final timerTarget = task['timerTargetSeconds'] as int;
    final timerSeconds = task['timerSeconds'] as int;
    final remaining = timerTarget - timerSeconds;

    if (task['status'] == 'in_progress' && remaining > 0 && remaining <= 180) {
      alerts.add('Auto alert · ${(remaining / 60).ceil()}m remaining on timer');
    }
    if (task['status'] == 'paused') {
      alerts.add('Preparation paused · resume when station is clear');
    }

    final steps = task['steps'] as List<dynamic>;
    for (final raw in steps) {
      final step = raw as Map<String, dynamic>;
      if (step['done'] != true) {
        alerts.add('Next step · ${step['label']}');
        break;
      }
    }

    final unchecked = (task['ingredients'] as List<dynamic>)
        .where((item) => !(item as Map)['checked'])
        .length;
    if (unchecked > 0) {
      alerts.add('$unchecked ingredients pending checklist');
    }

    task['alerts'] = alerts.take(3).toList();
  }

  static Map<String, dynamic> _cloneTask(Map<String, dynamic> task) {
    return {
      ...task,
      'steps': (task['steps'] as List<dynamic>)
          .map((step) => Map<String, dynamic>.from(step as Map))
          .toList(),
      'ingredients': (task['ingredients'] as List<dynamic>)
          .map((item) => Map<String, dynamic>.from(item as Map))
          .toList(),
      'alerts': List<String>.from(task['alerts'] as List? ?? const []),
    };
  }

  static List<Map<String, dynamic>> _seedTasks() {
    return [
      _task(
        id: 'PREP-1842',
        orderId: 'ORD-1842',
        kotNumber: 'KOT #1842',
        section: 'Tandoor',
        dishName: 'Tandoori platter',
        location: 'Table 12',
        assignedChef: 'Ravi Tandoor',
        mode: 'standard',
        status: 'in_progress',
        timerSeconds: 438,
        timerTargetSeconds: 720,
        portions: 1,
        steps: [
          _step(1, 'Marinate protein', true, 15),
          _step(2, 'Skewer & tandoor fire', false, 18),
          _step(3, 'Naan finish & plate', false, 8),
        ],
        ingredients: [
          _ingredient('Chicken', '250g', true),
          _ingredient('Yogurt marinade', '120g', true),
          _ingredient('Butter naan dough', '2 portions', false),
        ],
      ),
      _task(
        id: 'PREP-1843',
        orderId: 'ORD-1843',
        kotNumber: 'KOT #1843',
        section: 'Main',
        dishName: 'Dal makhani · VIP',
        location: 'Room 804',
        assignedChef: 'Chef Arjun Mehta',
        mode: 'premium',
        status: 'in_progress',
        timerSeconds: 282,
        timerTargetSeconds: 960,
        portions: 1,
        vip: true,
        allergy: true,
        steps: [
          _step(1, 'Allergy kit setup', true, 5),
          _step(2, 'Simmer dal base', false, 25),
          _step(3, 'Tempering & QC', false, 10),
        ],
        ingredients: [
          _ingredient('Black dal', '180g', true),
          _ingredient('Steamed rice', '1 portion', false),
          _ingredient('Allergy-safe garnish', '1 set', false),
        ],
      ),
      _task(
        id: 'PREP-1844',
        orderId: 'ORD-1844',
        kotNumber: 'KOT #1844',
        section: 'Chinese',
        dishName: 'Hakka noodles combo',
        location: 'Zomato',
        assignedChef: 'Mei Lin',
        mode: 'fast',
        status: 'in_progress',
        timerSeconds: 965,
        timerTargetSeconds: 600,
        portions: 2,
        steps: [
          _step(1, 'Wok heat & oil', true, 3),
          _step(2, 'Noodle toss', false, 6),
          _step(3, 'Manchurian gravy finish', false, 5),
        ],
        ingredients: [
          _ingredient('Hakka noodles', '2 portions', true),
          _ingredient('Manchurian balls', '1 portion', true),
          _ingredient('Extra gravy', '120ml', false),
        ],
      ),
      _task(
        id: 'PREP-1845',
        orderId: 'ORD-1845',
        kotNumber: 'KOT #1845',
        section: 'Dessert',
        dishName: 'Banquet dessert batch',
        location: 'Banquet A',
        assignedChef: 'Dessert Team',
        mode: 'bulk',
        status: 'in_progress',
        timerSeconds: 690,
        timerTargetSeconds: 900,
        portions: 40,
        steps: [
          _step(1, 'Syrup batch heat', true, 12),
          _step(2, 'Gulab jamun fry cycle', false, 20),
          _step(3, 'Ice cream scoop staging', false, 15),
        ],
        ingredients: [
          _ingredient('Gulab jamun mix', '40 units', true),
          _ingredient('Ice cream tubs', '4 tubs', false),
          _ingredient('Silver service trays', '8 trays', false),
        ],
      ),
      _task(
        id: 'PREP-1847',
        orderId: 'ORD-1847',
        kotNumber: 'KOT #1847',
        section: 'Grill',
        dishName: 'Grilled fish',
        location: 'Table 4',
        assignedChef: 'Grill Station',
        mode: 'standard',
        status: 'paused',
        timerSeconds: 591,
        timerTargetSeconds: 840,
        portions: 1,
        allergy: true,
        steps: [
          _step(1, 'Fish prep & seasoning', true, 10),
          _step(2, 'Grill to temperature', false, 14),
          _step(3, 'Lemon butter finish', false, 4),
        ],
        ingredients: [
          _ingredient('Fish fillet', '220g', true),
          _ingredient('Lemon butter', '40g', true),
          _ingredient('QC thermometer', '1 unit', false),
        ],
      ),
      _task(
        id: 'PREP-1849',
        orderId: 'ORD-1849',
        kotNumber: 'KOT #1849',
        section: 'Salad',
        dishName: 'Caesar salad',
        location: 'Table 7',
        assignedChef: 'Cold Prep',
        mode: 'scheduled',
        status: 'pending',
        timerSeconds: 0,
        timerTargetSeconds: 420,
        portions: 2,
        steps: [
          _step(1, 'Wash & chop romaine', false, 6),
          _step(2, 'Dressing emulsion', false, 4),
          _step(3, 'Jain plate assembly', false, 5),
        ],
        ingredients: [
          _ingredient('Romaine lettuce', '2 heads', false),
          _ingredient('Caesar dressing', '80ml', false),
          _ingredient('Croutons (Jain)', '1 pack', false),
        ],
      ),
    ];
  }

  static Map<String, dynamic> _task({
    required String id,
    required String orderId,
    required String kotNumber,
    required String section,
    required String dishName,
    required String location,
    required String assignedChef,
    required String mode,
    required String status,
    required int timerSeconds,
    required int timerTargetSeconds,
    required int portions,
    required List<Map<String, dynamic>> steps,
    required List<Map<String, dynamic>> ingredients,
    bool vip = false,
    bool allergy = false,
  }) {
    final task = {
      'id': id,
      'orderId': orderId,
      'kotNumber': kotNumber,
      'section': section,
      'dishName': dishName,
      'location': location,
      'assignedChef': assignedChef,
      'mode': mode,
      'status': status,
      'timerSeconds': timerSeconds,
      'timerTargetSeconds': timerTargetSeconds,
      'portions': portions,
      'steps': steps,
      'ingredients': ingredients,
      'vip': vip,
      'allergy': allergy,
      'progress': 0.0,
      'alerts': <String>[],
    };
    _refreshProgress(task);
    _refreshAlerts(task);
    return task;
  }

  static Map<String, dynamic> _step(
    int order,
    String label,
    bool done,
    int durationMinutes,
  ) {
    return {
      'order': order,
      'label': label,
      'done': done,
      'durationMinutes': durationMinutes,
    };
  }

  static Map<String, dynamic> _ingredient(
    String name,
    String quantity,
    bool checked,
  ) {
    return {
      'name': name,
      'quantity': quantity,
      'checked': checked,
    };
  }
}
