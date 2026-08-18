class FeatureWorkflowLink {
  const FeatureWorkflowLink({
    required this.from,
    required this.to,
    required this.label,
  });

  final int from;
  final int to;
  final String label;

  factory FeatureWorkflowLink.fromJson(Map<String, dynamic> json) {
    return FeatureWorkflowLink(
      from: json['from'] as int,
      to: json['to'] as int,
      label: json['label'] as String,
    );
  }
}

class FeatureModuleEntitlement {
  const FeatureModuleEntitlement({
    required this.number,
    required this.key,
    required this.title,
    required this.category,
    required this.linkedSystems,
    this.apiPath,
  });

  final int number;
  final String key;
  final String title;
  final String category;
  final List<int> linkedSystems;
  final String? apiPath;

  factory FeatureModuleEntitlement.fromJson(Map<String, dynamic> json) {
    return FeatureModuleEntitlement(
      number: json['number'] as int,
      key: json['key'] as String,
      title: json['title'] as String,
      category: json['category'] as String,
      linkedSystems: (json['linkedSystems'] as List<dynamic>? ?? [])
          .map((item) => item as int)
          .toList(),
      apiPath: json['apiPath'] as String?,
    );
  }
}

class FeatureEntitlementsSnapshot {
  const FeatureEntitlementsSnapshot({
    required this.restaurantId,
    required this.plan,
    required this.enabledSystems,
    required this.modules,
    required this.workflowLinks,
  });

  final int restaurantId;
  final String plan;
  final List<int> enabledSystems;
  final List<FeatureModuleEntitlement> modules;
  final List<FeatureWorkflowLink> workflowLinks;

  bool isSystemEnabled(int systemNumber) =>
      systemNumber == 1 || enabledSystems.contains(systemNumber);

  factory FeatureEntitlementsSnapshot.fromJson(Map<String, dynamic> json) {
    return FeatureEntitlementsSnapshot(
      restaurantId: json['restaurantId'] as int,
      plan: json['plan'] as String? ?? 'starter',
      enabledSystems: (json['enabledSystems'] as List<dynamic>)
          .map((item) => item as int)
          .toList(),
      modules: (json['modules'] as List<dynamic>? ?? [])
          .map(
            (item) =>
                FeatureModuleEntitlement.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      workflowLinks: (json['workflowLinks'] as List<dynamic>? ?? [])
          .map(
            (item) => FeatureWorkflowLink.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
    );
  }
}
