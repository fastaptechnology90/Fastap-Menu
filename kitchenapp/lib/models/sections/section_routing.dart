class SectionRoutingBoard {
  const SectionRoutingBoard({
    required this.splitOrders,
    required this.recommendations,
    required this.routingLog,
    required this.smartRouting,
  });

  final List<SplitOrderRoute> splitOrders;
  final List<RoutingRecommendation> recommendations;
  final List<RoutingLogEntry> routingLog;
  final SmartRoutingFlags smartRouting;

  factory SectionRoutingBoard.fromJson(Map<String, dynamic> json) {
    return SectionRoutingBoard(
      splitOrders: (json['splitOrders'] as List<dynamic>)
          .map((item) => SplitOrderRoute.fromJson(item as Map<String, dynamic>))
          .toList(),
      recommendations: (json['recommendations'] as List<dynamic>)
          .map(
            (item) =>
                RoutingRecommendation.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      routingLog: (json['routingLog'] as List<dynamic>)
          .map((item) => RoutingLogEntry.fromJson(item as Map<String, dynamic>))
          .toList(),
      smartRouting: SmartRoutingFlags.fromJson(
        json['smartRouting'] as Map<String, dynamic>,
      ),
    );
  }
}

class SplitOrderRoute {
  const SplitOrderRoute({
    required this.orderId,
    required this.kotNumber,
    required this.primarySection,
    required this.sections,
    required this.reason,
    required this.mode,
  });

  final String orderId;
  final String kotNumber;
  final String primarySection;
  final List<String> sections;
  final String reason;
  final String mode;

  factory SplitOrderRoute.fromJson(Map<String, dynamic> json) {
    return SplitOrderRoute(
      orderId: json['orderId'] as String,
      kotNumber: json['kotNumber'] as String,
      primarySection: json['primarySection'] as String,
      sections: (json['sections'] as List<dynamic>)
          .map((item) => item.toString())
          .toList(),
      reason: json['reason'] as String,
      mode: json['mode'] as String,
    );
  }
}

class RoutingRecommendation {
  const RoutingRecommendation({
    required this.id,
    required this.title,
    required this.message,
    required this.action,
    required this.targetSection,
    required this.severity,
  });

  final String id;
  final String title;
  final String message;
  final String action;
  final String targetSection;
  final String severity;

  factory RoutingRecommendation.fromJson(Map<String, dynamic> json) {
    return RoutingRecommendation(
      id: json['id'] as String,
      title: json['title'] as String,
      message: json['message'] as String,
      action: json['action'] as String,
      targetSection: json['targetSection'] as String,
      severity: json['severity'] as String? ?? 'info',
    );
  }
}

class RoutingLogEntry {
  const RoutingLogEntry({
    required this.time,
    required this.message,
    required this.type,
  });

  final DateTime time;
  final String message;
  final String type;

  factory RoutingLogEntry.fromJson(Map<String, dynamic> json) {
    return RoutingLogEntry(
      time: DateTime.parse(json['time'] as String),
      message: json['message'] as String,
      type: json['type'] as String,
    );
  }
}

class SmartRoutingFlags {
  const SmartRoutingFlags({
    required this.autoSectionAssignment,
    required this.multiSectionSplitting,
    required this.parallelPreparation,
    required this.aiLoadBalancing,
    required this.smartChefAllocation,
    required this.queueOptimization,
  });

  final bool autoSectionAssignment;
  final bool multiSectionSplitting;
  final bool parallelPreparation;
  final bool aiLoadBalancing;
  final bool smartChefAllocation;
  final bool queueOptimization;

  factory SmartRoutingFlags.fromJson(Map<String, dynamic> json) {
    return SmartRoutingFlags(
      autoSectionAssignment: json['autoSectionAssignment'] as bool? ?? true,
      multiSectionSplitting: json['multiSectionSplitting'] as bool? ?? true,
      parallelPreparation: json['parallelPreparation'] as bool? ?? true,
      aiLoadBalancing: json['aiLoadBalancing'] as bool? ?? true,
      smartChefAllocation: json['smartChefAllocation'] as bool? ?? true,
      queueOptimization: json['queueOptimization'] as bool? ?? true,
    );
  }
}

class SectionOptimizeResult {
  const SectionOptimizeResult({
    required this.movedOrders,
    required this.message,
  });

  final int movedOrders;
  final String message;

  factory SectionOptimizeResult.fromJson(Map<String, dynamic> json) {
    return SectionOptimizeResult(
      movedOrders: json['movedOrders'] as int? ?? 0,
      message: json['message'] as String? ?? 'Queue optimized',
    );
  }
}
