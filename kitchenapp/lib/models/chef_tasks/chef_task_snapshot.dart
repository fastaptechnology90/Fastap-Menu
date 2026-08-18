class ChefTaskSnapshot {
  const ChefTaskSnapshot({
    required this.section,
    required this.lastSyncedAt,
    required this.tasks,
    required this.chefs,
    required this.stats,
    required this.workloadBoard,
    required this.sections,
  });

  final String section;
  final DateTime lastSyncedAt;
  final List<ChefTask> tasks;
  final List<ChefProfile> chefs;
  final ChefTaskStats stats;
  final List<ChefWorkloadItem> workloadBoard;
  final List<String> sections;

  factory ChefTaskSnapshot.fromJson(Map<String, dynamic> json) {
    return ChefTaskSnapshot(
      section: json['section'] as String? ?? 'All',
      lastSyncedAt: DateTime.parse(json['lastSyncedAt'] as String),
      tasks: (json['tasks'] as List<dynamic>)
          .map((item) => ChefTask.fromJson(item as Map<String, dynamic>))
          .toList(),
      chefs: (json['chefs'] as List<dynamic>)
          .map((item) => ChefProfile.fromJson(item as Map<String, dynamic>))
          .toList(),
      stats: ChefTaskStats.fromJson(json['stats'] as Map<String, dynamic>),
      workloadBoard: (json['workloadBoard'] as List<dynamic>)
          .map(
            (item) => ChefWorkloadItem.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      sections: (json['sections'] as List<dynamic>)
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class ChefTask {
  const ChefTask({
    required this.id,
    required this.orderId,
    required this.kotNumber,
    required this.title,
    required this.section,
    required this.assignedChef,
    required this.assignedChefId,
    required this.skillTag,
    required this.shiftId,
    required this.status,
    required this.statusLabel,
    required this.priority,
    required this.progress,
    required this.workloadScore,
    required this.coordination,
    required this.availableActions,
  });

  final String id;
  final String orderId;
  final String kotNumber;
  final String title;
  final String section;
  final String assignedChef;
  final String assignedChefId;
  final String skillTag;
  final String shiftId;
  final String status;
  final String statusLabel;
  final String priority;
  final double progress;
  final double workloadScore;
  final List<String> coordination;
  final List<String> availableActions;

  factory ChefTask.fromJson(Map<String, dynamic> json) {
    return ChefTask(
      id: json['id'] as String,
      orderId: json['orderId'] as String,
      kotNumber: json['kotNumber'] as String,
      title: json['title'] as String,
      section: json['section'] as String,
      assignedChef: json['assignedChef'] as String,
      assignedChefId: json['assignedChefId'] as String,
      skillTag: json['skillTag'] as String,
      shiftId: json['shiftId'] as String,
      status: json['status'] as String,
      statusLabel: json['statusLabel'] as String,
      priority: json['priority'] as String,
      progress: (json['progress'] as num).toDouble(),
      workloadScore: (json['workloadScore'] as num).toDouble(),
      coordination: (json['coordination'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class ChefProfile {
  const ChefProfile({
    required this.id,
    required this.name,
    required this.role,
    required this.section,
  });

  final String id;
  final String name;
  final String role;
  final String section;

  factory ChefProfile.fromJson(Map<String, dynamic> json) {
    return ChefProfile(
      id: json['id'] as String,
      name: json['name'] as String,
      role: json['role'] as String,
      section: json['section'] as String,
    );
  }
}

class ChefTaskStats {
  const ChefTaskStats({
    required this.total,
    required this.assigned,
    required this.inProgress,
    required this.waiting,
    required this.delayed,
    required this.escalated,
  });

  final int total;
  final int assigned;
  final int inProgress;
  final int waiting;
  final int delayed;
  final int escalated;

  factory ChefTaskStats.fromJson(Map<String, dynamic> json) {
    return ChefTaskStats(
      total: json['total'] as int? ?? 0,
      assigned: json['assigned'] as int? ?? 0,
      inProgress: json['inProgress'] as int? ?? 0,
      waiting: json['waiting'] as int? ?? 0,
      delayed: json['delayed'] as int? ?? 0,
      escalated: json['escalated'] as int? ?? 0,
    );
  }
}

class ChefWorkloadItem {
  const ChefWorkloadItem({
    required this.chef,
    required this.taskCount,
    required this.load,
  });

  final String chef;
  final int taskCount;
  final double load;

  factory ChefWorkloadItem.fromJson(Map<String, dynamic> json) {
    return ChefWorkloadItem(
      chef: json['chef'] as String,
      taskCount: json['taskCount'] as int? ?? 0,
      load: (json['load'] as num?)?.toDouble() ?? 0,
    );
  }
}

class ChefTaskActionResult {
  const ChefTaskActionResult({
    required this.success,
    required this.message,
  });

  final bool success;
  final String message;

  factory ChefTaskActionResult.fromJson(Map<String, dynamic> json) {
    return ChefTaskActionResult(
      success: json['success'] as bool? ?? false,
      message: json['message'] as String? ?? 'Action applied',
    );
  }
}
