import 'kitchen_section.dart';
import 'section_routing.dart';

class SectionOverviewSnapshot {
  const SectionOverviewSnapshot({
    required this.filterSection,
    required this.sections,
    required this.lastSyncedAt,
    required this.stats,
  });

  final String filterSection;
  final List<KitchenSectionProfile> sections;
  final DateTime lastSyncedAt;
  final SectionOverviewStats stats;

  factory SectionOverviewSnapshot.fromJson(Map<String, dynamic> json) {
    return SectionOverviewSnapshot(
      filterSection: json['filterSection'] as String? ?? 'All',
      sections: (json['sections'] as List<dynamic>)
          .map(
            (item) =>
                KitchenSectionProfile.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      lastSyncedAt: DateTime.parse(json['lastSyncedAt'] as String),
      stats: SectionOverviewStats.fromJson(
        json['stats'] as Map<String, dynamic>,
      ),
    );
  }
}

class SectionOverviewStats {
  const SectionOverviewStats({
    required this.totalSections,
    required this.onlineSections,
    required this.busiestSection,
    required this.avgLoad,
  });

  final int totalSections;
  final int onlineSections;
  final String busiestSection;
  final double avgLoad;

  factory SectionOverviewStats.fromJson(Map<String, dynamic> json) {
    return SectionOverviewStats(
      totalSections: json['totalSections'] as int? ?? 0,
      onlineSections: json['onlineSections'] as int? ?? 0,
      busiestSection: json['busiestSection'] as String? ?? 'Main',
      avgLoad: (json['avgLoad'] as num?)?.toDouble() ?? 0,
    );
  }
}

class SectionManagementSnapshot {
  const SectionManagementSnapshot({
    required this.overview,
    required this.routing,
  });

  final SectionOverviewSnapshot overview;
  final SectionRoutingBoard routing;

  factory SectionManagementSnapshot.fromJson(Map<String, dynamic> json) {
    return SectionManagementSnapshot(
      overview: SectionOverviewSnapshot.fromJson(
        json['overview'] as Map<String, dynamic>,
      ),
      routing: SectionRoutingBoard.fromJson(
        json['routing'] as Map<String, dynamic>,
      ),
    );
  }
}
