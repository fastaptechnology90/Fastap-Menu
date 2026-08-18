import 'package:flutter_test/flutter_test.dart';

import 'package:kitchenapp/models/kitchen_heatmap/kitchen_heatmap_snapshot.dart';

void main() {
  test('kitchen heatmap snapshot parses API payload', () {
    final snapshot = KitchenHeatmapSnapshot.fromJson({
      'section': 'All',
      'lastSyncedAt': '2026-06-06T12:00:00.000',
      'sections': ['All', 'Main'],
      'stationHeatmap': [
        {
          'id': 'HT-ST-001',
          'stationName': 'Main grill',
          'section': 'Main',
          'heatLevel': 'critical',
          'loadPercent': 94,
          'ordersQueued': 8,
          'status': 'active',
          'availableActions': ['rebalance_station'],
        },
      ],
      'delayHotspots': [
        {
          'id': 'HT-DLY-001',
          'zoneName': 'Main grill delay zone',
          'section': 'Main',
          'delayMinutes': 18,
          'severity': 'high',
          'status': 'active',
          'availableActions': ['reroute_orders'],
        },
      ],
      'staffDensity': [
        {
          'id': 'HT-DEN-001',
          'zoneName': 'Main hot line',
          'section': 'Main',
          'staffCount': 2,
          'capacity': 4,
          'densityLevel': 'understaffed',
          'availableActions': ['request_backup'],
        },
      ],
      'rushZones': [
        {
          'id': 'HT-RSH-001',
          'zoneName': 'Lunch rush · Main floor',
          'section': 'Main',
          'rushLevel': 'high',
          'coversExpected': 148,
          'windowLabel': '13:00–14:30',
          'status': 'active',
          'availableActions': ['activate_rush_mode'],
        },
      ],
      'stats': {
        'hotStations': 1,
        'delayHotspots': 1,
        'overstaffedZones': 0,
        'understaffedZones': 1,
        'activeRushZones': 1,
        'avgLoadPercent': 94,
      },
      'heatmapFeatures': {
        'busyStationMapping': true,
        'delayHotspots': true,
        'staffDensityTracking': true,
        'rushVisualization': true,
      },
    });

    expect(snapshot.stationHeatmap.length, 1);
    expect(snapshot.stationHeatmap.first.heatLevel, 'critical');
    expect(snapshot.heatmapFeatures.rushVisualization, isTrue);
    expect(snapshot.stats.avgLoadPercent, 94);
  });
}
