class PrepSnapshot {
  const PrepSnapshot({
    required this.section,
    required this.lastSyncedAt,
    required this.tasks,
    required this.stats,
    required this.prepModes,
    required this.stationLoad,
    required this.sections,
  });

  final String section;
  final DateTime lastSyncedAt;
  final List<PrepTask> tasks;
  final PrepStats stats;
  final List<PrepModeSummary> prepModes;
  final List<PrepStationLoad> stationLoad;
  final List<String> sections;

  factory PrepSnapshot.fromJson(Map<String, dynamic> json) {
    return PrepSnapshot(
      section: json['section'] as String? ?? 'All',
      lastSyncedAt: DateTime.parse(json['lastSyncedAt'] as String),
      tasks: (json['tasks'] as List<dynamic>)
          .map((item) => PrepTask.fromJson(item as Map<String, dynamic>))
          .toList(),
      stats: PrepStats.fromJson(json['stats'] as Map<String, dynamic>),
      prepModes: (json['prepModes'] as List<dynamic>)
          .map(
            (item) => PrepModeSummary.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      stationLoad: (json['stationLoad'] as List<dynamic>)
          .map(
            (item) => PrepStationLoad.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      sections: (json['sections'] as List<dynamic>)
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class PrepTask {
  const PrepTask({
    required this.id,
    required this.orderId,
    required this.kotNumber,
    required this.section,
    required this.dishName,
    required this.location,
    required this.assignedChef,
    required this.mode,
    required this.modeLabel,
    required this.status,
    required this.statusLabel,
    required this.timerSeconds,
    required this.timerTargetSeconds,
    required this.timer,
    required this.timerRemaining,
    required this.portions,
    required this.progress,
    required this.steps,
    required this.ingredients,
    required this.alerts,
    required this.availableActions,
    this.vip = false,
    this.allergy = false,
  });

  final String id;
  final String orderId;
  final String kotNumber;
  final String section;
  final String dishName;
  final String location;
  final String assignedChef;
  final String mode;
  final String modeLabel;
  final String status;
  final String statusLabel;
  final int timerSeconds;
  final int timerTargetSeconds;
  final String timer;
  final String timerRemaining;
  final int portions;
  final double progress;
  final List<PrepStep> steps;
  final List<PrepIngredient> ingredients;
  final List<String> alerts;
  final List<String> availableActions;
  final bool vip;
  final bool allergy;

  factory PrepTask.fromJson(Map<String, dynamic> json) {
    return PrepTask(
      id: json['id'] as String,
      orderId: json['orderId'] as String,
      kotNumber: json['kotNumber'] as String,
      section: json['section'] as String,
      dishName: json['dishName'] as String,
      location: json['location'] as String,
      assignedChef: json['assignedChef'] as String,
      mode: json['mode'] as String,
      modeLabel: json['modeLabel'] as String,
      status: json['status'] as String,
      statusLabel: json['statusLabel'] as String,
      timerSeconds: json['timerSeconds'] as int? ?? 0,
      timerTargetSeconds: json['timerTargetSeconds'] as int? ?? 0,
      timer: json['timer'] as String? ?? '00:00',
      timerRemaining: json['timerRemaining'] as String? ?? '00:00',
      portions: json['portions'] as int? ?? 1,
      progress: (json['progress'] as num?)?.toDouble() ?? 0,
      steps: (json['steps'] as List<dynamic>)
          .map((item) => PrepStep.fromJson(item as Map<String, dynamic>))
          .toList(),
      ingredients: (json['ingredients'] as List<dynamic>)
          .map(
            (item) => PrepIngredient.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      alerts: (json['alerts'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
      vip: json['vip'] as bool? ?? false,
      allergy: json['allergy'] as bool? ?? false,
    );
  }
}

class PrepStep {
  const PrepStep({
    required this.order,
    required this.label,
    required this.done,
    required this.durationMinutes,
  });

  final int order;
  final String label;
  final bool done;
  final int durationMinutes;

  factory PrepStep.fromJson(Map<String, dynamic> json) {
    return PrepStep(
      order: json['order'] as int,
      label: json['label'] as String,
      done: json['done'] as bool? ?? false,
      durationMinutes: json['durationMinutes'] as int? ?? 0,
    );
  }
}

class PrepIngredient {
  const PrepIngredient({
    required this.name,
    required this.quantity,
    required this.checked,
  });

  final String name;
  final String quantity;
  final bool checked;

  factory PrepIngredient.fromJson(Map<String, dynamic> json) {
    return PrepIngredient(
      name: json['name'] as String,
      quantity: json['quantity'] as String,
      checked: json['checked'] as bool? ?? false,
    );
  }
}

class PrepStats {
  const PrepStats({
    required this.total,
    required this.active,
    required this.paused,
    required this.pending,
    required this.alerts,
  });

  final int total;
  final int active;
  final int paused;
  final int pending;
  final int alerts;

  factory PrepStats.fromJson(Map<String, dynamic> json) {
    return PrepStats(
      total: json['total'] as int? ?? 0,
      active: json['active'] as int? ?? 0,
      paused: json['paused'] as int? ?? 0,
      pending: json['pending'] as int? ?? 0,
      alerts: json['alerts'] as int? ?? 0,
    );
  }
}

class PrepModeSummary {
  const PrepModeSummary({
    required this.mode,
    required this.label,
    required this.count,
  });

  final String mode;
  final String label;
  final int count;

  factory PrepModeSummary.fromJson(Map<String, dynamic> json) {
    return PrepModeSummary(
      mode: json['mode'] as String,
      label: json['label'] as String,
      count: json['count'] as int? ?? 0,
    );
  }
}

class PrepStationLoad {
  const PrepStationLoad({
    required this.section,
    required this.load,
    required this.taskCount,
  });

  final String section;
  final double load;
  final int taskCount;

  factory PrepStationLoad.fromJson(Map<String, dynamic> json) {
    return PrepStationLoad(
      section: json['section'] as String,
      load: (json['load'] as num?)?.toDouble() ?? 0,
      taskCount: json['taskCount'] as int? ?? 0,
    );
  }
}
