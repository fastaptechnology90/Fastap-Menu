import '../kitchen_order.dart';

class ProcessingSnapshot {
  const ProcessingSnapshot({
    required this.section,
    required this.lastSyncedAt,
    required this.orders,
    required this.stats,
    required this.smartProcessing,
    required this.batchCooking,
    required this.cookingSequence,
    required this.sections,
  });

  final String section;
  final DateTime lastSyncedAt;
  final List<ProcessingOrder> orders;
  final ProcessingStats stats;
  final SmartProcessingFlags smartProcessing;
  final List<BatchCookingGroup> batchCooking;
  final List<CookingSequenceStep> cookingSequence;
  final List<String> sections;

  factory ProcessingSnapshot.fromJson(Map<String, dynamic> json) {
    return ProcessingSnapshot(
      section: json['section'] as String? ?? 'All',
      lastSyncedAt: DateTime.parse(json['lastSyncedAt'] as String),
      orders: (json['orders'] as List<dynamic>)
          .map(
            (item) => ProcessingOrder.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      stats: ProcessingStats.fromJson(json['stats'] as Map<String, dynamic>),
      smartProcessing: SmartProcessingFlags.fromJson(
        json['smartProcessing'] as Map<String, dynamic>,
      ),
      batchCooking: (json['batchCooking'] as List<dynamic>)
          .map(
            (item) =>
                BatchCookingGroup.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      cookingSequence: (json['cookingSequence'] as List<dynamic>)
          .map(
            (item) =>
                CookingSequenceStep.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      sections: (json['sections'] as List<dynamic>)
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class ProcessingOrder {
  const ProcessingOrder({
    required this.base,
    required this.lineItems,
    required this.held,
    required this.availableActions,
  });

  final KitchenOrder base;
  final List<ProcessingLineItem> lineItems;
  final bool held;
  final List<String> availableActions;

  factory ProcessingOrder.fromJson(Map<String, dynamic> json) {
    return ProcessingOrder(
      base: KitchenOrder.fromJson(json),
      lineItems: (json['lineItems'] as List<dynamic>? ?? const [])
          .map(
            (item) =>
                ProcessingLineItem.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      held: json['held'] as bool? ?? false,
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class ProcessingLineItem {
  const ProcessingLineItem({
    required this.name,
    required this.status,
    required this.modifiable,
    this.modification,
  });

  final String name;
  final String status;
  final bool modifiable;
  final String? modification;

  factory ProcessingLineItem.fromJson(Map<String, dynamic> json) {
    return ProcessingLineItem(
      name: json['name'] as String,
      status: json['status'] as String? ?? 'active',
      modifiable: json['modifiable'] as bool? ?? true,
      modification: json['modification'] as String?,
    );
  }
}

class ProcessingStats {
  const ProcessingStats({
    required this.total,
    required this.held,
    required this.vip,
    required this.rush,
    required this.batchGroups,
  });

  final int total;
  final int held;
  final int vip;
  final int rush;
  final int batchGroups;

  factory ProcessingStats.fromJson(Map<String, dynamic> json) {
    return ProcessingStats(
      total: json['total'] as int? ?? 0,
      held: json['held'] as int? ?? 0,
      vip: json['vip'] as int? ?? 0,
      rush: json['rush'] as int? ?? 0,
      batchGroups: json['batchGroups'] as int? ?? 0,
    );
  }
}

class SmartProcessingFlags {
  const SmartProcessingFlags({
    required this.autoQueueSorting,
    required this.aiPriorityHandling,
    required this.vipPrioritization,
    required this.rushHourOptimization,
    required this.batchCookingManagement,
    required this.smartCookingSequence,
  });

  final bool autoQueueSorting;
  final bool aiPriorityHandling;
  final bool vipPrioritization;
  final bool rushHourOptimization;
  final bool batchCookingManagement;
  final bool smartCookingSequence;

  factory SmartProcessingFlags.fromJson(Map<String, dynamic> json) {
    return SmartProcessingFlags(
      autoQueueSorting: json['autoQueueSorting'] as bool? ?? false,
      aiPriorityHandling: json['aiPriorityHandling'] as bool? ?? false,
      vipPrioritization: json['vipPrioritization'] as bool? ?? false,
      rushHourOptimization: json['rushHourOptimization'] as bool? ?? false,
      batchCookingManagement: json['batchCookingManagement'] as bool? ?? false,
      smartCookingSequence: json['smartCookingSequence'] as bool? ?? false,
    );
  }
}

class BatchCookingGroup {
  const BatchCookingGroup({
    required this.id,
    required this.label,
    required this.orderCount,
    required this.orders,
  });

  final String id;
  final String label;
  final int orderCount;
  final List<String> orders;

  factory BatchCookingGroup.fromJson(Map<String, dynamic> json) {
    return BatchCookingGroup(
      id: json['id'] as String,
      label: json['label'] as String,
      orderCount: json['orderCount'] as int? ?? 0,
      orders: (json['orders'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class CookingSequenceStep {
  const CookingSequenceStep({
    required this.orderId,
    required this.kotNumber,
    required this.step,
    required this.etaMinutes,
  });

  final String orderId;
  final String kotNumber;
  final String step;
  final int etaMinutes;

  factory CookingSequenceStep.fromJson(Map<String, dynamic> json) {
    return CookingSequenceStep(
      orderId: json['orderId'] as String,
      kotNumber: json['kotNumber'] as String,
      step: json['step'] as String,
      etaMinutes: json['etaMinutes'] as int? ?? 0,
    );
  }
}

class ProcessingOptimizeResult {
  const ProcessingOptimizeResult({
    required this.success,
    required this.message,
  });

  final bool success;
  final String message;

  factory ProcessingOptimizeResult.fromJson(Map<String, dynamic> json) {
    return ProcessingOptimizeResult(
      success: json['success'] as bool? ?? false,
      message: json['message'] as String? ?? 'Queue optimized',
    );
  }
}
