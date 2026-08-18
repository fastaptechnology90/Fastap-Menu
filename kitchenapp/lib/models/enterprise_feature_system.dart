class EnterpriseFeatureSystem {
  const EnterpriseFeatureSystem({
    required this.number,
    required this.title,
    required this.groups,
  });

  final int number;
  final String title;
  final List<FeatureGroup> groups;

  int get featureCount {
    return groups.fold(0, (total, group) => total + group.items.length);
  }
}

class FeatureGroup {
  const FeatureGroup({required this.title, required this.items});

  final String title;
  final List<String> items;
}
