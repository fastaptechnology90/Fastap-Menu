class ModifierSnapshot {
  const ModifierSnapshot({
    required this.section,
    required this.lastSyncedAt,
    required this.orders,
    required this.catalog,
    required this.stats,
    required this.smartAlerts,
    required this.sections,
  });

  final String section;
  final DateTime lastSyncedAt;
  final List<ModifierOrder> orders;
  final List<ModifierCatalogItem> catalog;
  final ModifierStats stats;
  final SmartModifierAlerts smartAlerts;
  final List<String> sections;

  factory ModifierSnapshot.fromJson(Map<String, dynamic> json) {
    return ModifierSnapshot(
      section: json['section'] as String? ?? 'All',
      lastSyncedAt: DateTime.parse(json['lastSyncedAt'] as String),
      orders: (json['orders'] as List<dynamic>)
          .map(
            (item) => ModifierOrder.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      catalog: (json['catalog'] as List<dynamic>)
          .map(
            (item) =>
                ModifierCatalogItem.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      stats: ModifierStats.fromJson(json['stats'] as Map<String, dynamic>),
      smartAlerts: SmartModifierAlerts.fromJson(
        json['smartAlerts'] as Map<String, dynamic>,
      ),
      sections: (json['sections'] as List<dynamic>)
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class ModifierOrder {
  const ModifierOrder({
    required this.orderId,
    required this.kotNumber,
    required this.location,
    required this.section,
    required this.category,
    required this.status,
    required this.vip,
    required this.allergy,
    required this.items,
    required this.modifiers,
    required this.customizations,
    required this.stats,
    required this.availableActions,
  });

  final String orderId;
  final String kotNumber;
  final String location;
  final String section;
  final String category;
  final String status;
  final bool vip;
  final bool allergy;
  final List<String> items;
  final List<ModifierEntry> modifiers;
  final List<ModifierCustomization> customizations;
  final ModifierOrderStats stats;
  final List<String> availableActions;

  factory ModifierOrder.fromJson(Map<String, dynamic> json) {
    return ModifierOrder(
      orderId: json['orderId'] as String,
      kotNumber: json['kotNumber'] as String,
      location: json['location'] as String,
      section: json['section'] as String,
      category: json['category'] as String,
      status: json['status'] as String,
      vip: json['vip'] as bool? ?? false,
      allergy: json['allergy'] as bool? ?? false,
      items: (json['items'] as List<dynamic>).map((item) => item.toString()).toList(),
      modifiers: (json['modifiers'] as List<dynamic>)
          .map(
            (item) => ModifierEntry.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      customizations: (json['customizations'] as List<dynamic>? ?? const [])
          .map(
            (item) => ModifierCustomization.fromJson(
              item as Map<String, dynamic>,
            ),
          )
          .toList(),
      stats: ModifierOrderStats.fromJson(
        json['stats'] as Map<String, dynamic>,
      ),
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class ModifierEntry {
  const ModifierEntry({
    required this.id,
    required this.label,
    required this.type,
    required this.category,
    required this.priority,
    required this.flashAlert,
    required this.requiresChefConfirm,
    required this.acknowledged,
    required this.chefConfirmed,
  });

  final String id;
  final String label;
  final String type;
  final String category;
  final String priority;
  final bool flashAlert;
  final bool requiresChefConfirm;
  final bool acknowledged;
  final bool chefConfirmed;

  factory ModifierEntry.fromJson(Map<String, dynamic> json) {
    return ModifierEntry(
      id: json['id'] as String,
      label: json['label'] as String,
      type: json['type'] as String,
      category: json['category'] as String,
      priority: json['priority'] as String,
      flashAlert: json['flashAlert'] as bool? ?? false,
      requiresChefConfirm: json['requiresChefConfirm'] as bool? ?? false,
      acknowledged: json['acknowledged'] as bool? ?? false,
      chefConfirmed: json['chefConfirmed'] as bool? ?? false,
    );
  }
}

class ModifierCustomization {
  const ModifierCustomization({
    required this.item,
    required this.label,
    required this.type,
  });

  final String item;
  final String label;
  final String type;

  factory ModifierCustomization.fromJson(Map<String, dynamic> json) {
    return ModifierCustomization(
      item: json['item'] as String,
      label: json['label'] as String,
      type: json['type'] as String? ?? 'item_modification',
    );
  }
}

class ModifierOrderStats {
  const ModifierOrderStats({
    required this.totalModifiers,
    required this.pendingAcknowledgment,
    required this.pendingChefConfirm,
    required this.flashAlerts,
  });

  final int totalModifiers;
  final int pendingAcknowledgment;
  final int pendingChefConfirm;
  final int flashAlerts;

  factory ModifierOrderStats.fromJson(Map<String, dynamic> json) {
    return ModifierOrderStats(
      totalModifiers: json['totalModifiers'] as int? ?? 0,
      pendingAcknowledgment: json['pendingAcknowledgment'] as int? ?? 0,
      pendingChefConfirm: json['pendingChefConfirm'] as int? ?? 0,
      flashAlerts: json['flashAlerts'] as int? ?? 0,
    );
  }
}

class ModifierStats {
  const ModifierStats({
    required this.ordersWithModifiers,
    required this.totalModifiers,
    required this.pendingAcknowledgment,
    required this.pendingChefConfirm,
    required this.flashAlerts,
    required this.allergyOrders,
  });

  final int ordersWithModifiers;
  final int totalModifiers;
  final int pendingAcknowledgment;
  final int pendingChefConfirm;
  final int flashAlerts;
  final int allergyOrders;

  factory ModifierStats.fromJson(Map<String, dynamic> json) {
    return ModifierStats(
      ordersWithModifiers: json['ordersWithModifiers'] as int? ?? 0,
      totalModifiers: json['totalModifiers'] as int? ?? 0,
      pendingAcknowledgment: json['pendingAcknowledgment'] as int? ?? 0,
      pendingChefConfirm: json['pendingChefConfirm'] as int? ?? 0,
      flashAlerts: json['flashAlerts'] as int? ?? 0,
      allergyOrders: json['allergyOrders'] as int? ?? 0,
    );
  }
}

class SmartModifierAlerts {
  const SmartModifierAlerts({
    required this.allergyFlashingAlerts,
    required this.priorityModifiers,
    required this.chefConfirmationRequired,
    required this.acknowledgmentTracking,
  });

  final bool allergyFlashingAlerts;
  final bool priorityModifiers;
  final bool chefConfirmationRequired;
  final bool acknowledgmentTracking;

  factory SmartModifierAlerts.fromJson(Map<String, dynamic> json) {
    return SmartModifierAlerts(
      allergyFlashingAlerts: json['allergyFlashingAlerts'] as bool? ?? false,
      priorityModifiers: json['priorityModifiers'] as bool? ?? false,
      chefConfirmationRequired: json['chefConfirmationRequired'] as bool? ?? false,
      acknowledgmentTracking: json['acknowledgmentTracking'] as bool? ?? false,
    );
  }
}

class ModifierCatalogItem {
  const ModifierCatalogItem({
    required this.label,
    required this.type,
  });

  final String label;
  final String type;

  factory ModifierCatalogItem.fromJson(Map<String, dynamic> json) {
    return ModifierCatalogItem(
      label: json['label'] as String,
      type: json['type'] as String,
    );
  }
}
