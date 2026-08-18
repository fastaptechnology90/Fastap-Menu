import 'mock_order_store.dart';
import 'mock_section_registry.dart';

class MockSectionEngine {
  const MockSectionEngine._();

  static Map<String, dynamic> buildOverview({String filterSection = 'All'}) {
    final orders = MockOrderStore.filterBySection(filterSection);
    final active = orders.where((order) {
      return {
        'new',
        'accepted',
        'preparing',
        'delayed',
        'ready',
      }.contains(order['status']);
    }).toList();

    final sections = MockSectionRegistry.kitchenSections.map((meta) {
      final sectionOrders = active
          .where((order) => order['section'] == meta.name)
          .toList();
      final count = sectionOrders.length;
      final load = (count / meta.capacity).clamp(0.0, 1.2);
      final delayed = sectionOrders.where((o) => o['status'] == 'delayed').length;

      return {
        'id': meta.id,
        'name': meta.name,
        'label': meta.label,
        'headChef': meta.headChef,
        'capacity': meta.capacity,
        'activeOrders': count,
        'queueDepth': count,
        'load': load,
        'staffAssigned': _staffForLoad(count),
        'delayedOrders': delayed,
        'status': _statusForLoad(load, delayed),
        'isOnline': true,
        'iconKey': meta.iconKey,
        'parallelPrep': count > 2,
      };
    }).toList();

    sections.sort(
      (a, b) => (b['load'] as double).compareTo(a['load'] as double),
    );

    return {
      'filterSection': filterSection,
      'sections': sections,
      'lastSyncedAt': DateTime.now().toIso8601String(),
      'stats': {
        'totalSections': sections.length,
        'onlineSections': sections.length,
        'busiestSection': sections.isEmpty ? 'Main' : sections.first['name'],
        'avgLoad': sections.isEmpty
            ? 0
            : sections
                      .map((s) => s['load'] as double)
                      .reduce((a, b) => a + b) /
                  sections.length,
      },
    };
  }

  static Map<String, dynamic> buildRoutingBoard() {
    final splitOrders = [
      {
        'orderId': 'ORD-1845',
        'kotNumber': 'KOT #1845',
        'primarySection': 'Dessert',
        'sections': ['Dessert', 'Bakery'],
        'reason': 'Multi-section splitting · banquet batch',
        'mode': 'parallel',
      },
      {
        'orderId': 'ORD-1843',
        'kotNumber': 'KOT #1843',
        'primarySection': 'Main',
        'sections': ['Main', 'Salad'],
        'reason': 'Auto section assignment · VIP course split',
        'mode': 'sequential',
      },
      {
        'orderId': 'ORD-1844',
        'kotNumber': 'KOT #1844',
        'primarySection': 'Chinese',
        'sections': ['Chinese', 'Fry'],
        'reason': 'Side item routed to fry section',
        'mode': 'parallel',
      },
    ];

    final recommendations = _buildRecommendations();
    final routingLog = [
      {
        'time': DateTime.now()
            .subtract(const Duration(minutes: 2))
            .toIso8601String(),
        'message': 'Auto assigned KOT #1848 to Fry section',
        'type': 'auto_assignment',
      },
      {
        'time': DateTime.now()
            .subtract(const Duration(minutes: 6))
            .toIso8601String(),
        'message': 'Split KOT #1845 across Dessert + Bakery',
        'type': 'multi_split',
      },
      {
        'time': DateTime.now()
            .subtract(const Duration(minutes: 11))
            .toIso8601String(),
        'message': 'AI load balance moved 2 orders from Chinese to Main',
        'type': 'load_balance',
      },
    ];

    return {
      'splitOrders': splitOrders,
      'recommendations': recommendations,
      'routingLog': routingLog,
      'smartRouting': {
        'autoSectionAssignment': true,
        'multiSectionSplitting': true,
        'parallelPreparation': true,
        'aiLoadBalancing': true,
        'smartChefAllocation': true,
        'queueOptimization': true,
      },
    };
  }

  static List<Map<String, dynamic>> _buildRecommendations() {
    final overview = buildOverview();
    final sections = overview['sections'] as List<dynamic>;
    final recommendations = <Map<String, dynamic>>[];

    for (final raw in sections) {
      final section = raw as Map<String, dynamic>;
      final load = section['load'] as double;
      final name = section['name'] as String;

      if (load > 0.85) {
        recommendations.add({
          'id': 'REC-$name-overload',
          'title': 'AI load balancing',
          'message':
              '$name section at ${(load * 100).round()}% capacity · reroute 1-2 KOTs',
          'action': 'balance_load',
          'targetSection': name,
          'severity': 'critical',
        });
      } else if (load > 0.55) {
        recommendations.add({
          'id': 'REC-$name-chef',
          'title': 'Smart chef allocation',
          'message': 'Assign backup chef to $name for 15 minutes',
          'action': 'assign_chef',
          'targetSection': name,
          'severity': 'warning',
        });
      }
    }

    if (recommendations.isEmpty) {
      recommendations.add({
        'id': 'REC-stable',
        'title': 'Queue optimization',
        'message': 'All sections within optimal load thresholds',
        'action': 'none',
        'targetSection': 'All',
        'severity': 'info',
      });
    }

    return recommendations.take(4).toList();
  }

  static Map<String, dynamic> rerouteOrder(String orderId, String section) {
    final order = MockOrderStore.findById(orderId);
    if (order == null) {
      throw StateError('Order not found');
    }
    order['section'] = section;
    final meta = MockSectionRegistry.byName(section);
    if (meta != null) {
      order['assignedChef'] = meta.headChef;
    }
    return Map<String, dynamic>.from(order);
  }

  static void assignChef(String sectionName, String chefName) {
    final meta = MockSectionRegistry.byName(sectionName);
    if (meta == null) {
      return;
    }
    for (final order in MockOrderStore.orders) {
      if (order['section'] == sectionName) {
        order['assignedChef'] = chefName;
      }
    }
  }

  static Map<String, dynamic> optimizeQueue() {
    final overview = buildOverview();
    final sections = (overview['sections'] as List<dynamic>)
        .cast<Map<String, dynamic>>()
        .toList();
    final overloaded = sections.where((s) => (s['load'] as double) > 0.75);
    final underloaded = sections.where((s) => (s['load'] as double) < 0.35);

    var moved = 0;
    if (overloaded.isNotEmpty && underloaded.isNotEmpty) {
      final source = overloaded.first['name'] as String;
      final target = underloaded.first['name'] as String;
      final candidate = MockOrderStore.activeOrders(source)
          .where((o) => o['priority'] == 'normal')
          .toList();
      if (candidate.isNotEmpty) {
        rerouteOrder(candidate.first['id'] as String, target);
        moved = 1;
      }
    }

    MockOrderStore.bumpSortOrder(
      MockOrderStore.activeOrders('All').firstOrNull?['id']?.toString() ?? '',
    );

    return {
      'success': true,
      'movedOrders': moved,
      'message': moved > 0
          ? 'Queue optimized · $moved order rerouted for load balance'
          : 'Queue optimized · priority order sequence updated',
    };
  }

  static int _staffForLoad(int count) {
    if (count > 4) {
      return 3;
    }
    if (count > 1) {
      return 2;
    }
    return count > 0 ? 1 : 0;
  }

  static String _statusForLoad(double load, int delayed) {
    if (delayed > 0 || load > 0.9) {
      return 'critical';
    }
    if (load > 0.6) {
      return 'rush';
    }
    return 'normal';
  }
}

extension _FirstOrNull<T> on Iterable<T> {
  T? get firstOrNull {
    final iterator = this.iterator;
    if (iterator.moveNext()) {
      return iterator.current;
    }
    return null;
  }
}
