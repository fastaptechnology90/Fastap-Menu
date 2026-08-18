import 'mock_order_store.dart';

class MockCourseFiringRegistry {
  MockCourseFiringRegistry._();

  static final List<Map<String, dynamic>> _sessions = _seedSessions();

  static List<Map<String, dynamic>> sessionsFor(String section) {
    final copy = _sessions.map(_cloneSession).toList();
    if (section == 'All') {
      return copy;
    }
    return copy
        .where((session) => (session['sections'] as List).contains(section))
        .toList();
  }

  static Map<String, dynamic>? findById(String id) {
    for (final session in _sessions) {
      if (session['id'] == id) {
        return session;
      }
    }
    return null;
  }

  static List<String> availableActions(
    Map<String, dynamic> session,
    String courseType,
  ) {
    final course = _course(session, courseType);
    if (course == null) {
      return const [];
    }

    final status = course['status'] as String;
    final actions = <String>[];

    if (status == 'pending') {
      actions.add('fire_$courseType');
    }
    if (status == 'fired' || status == 'preparing') {
      actions.add('hold_$courseType');
    }
    if (status == 'held') {
      actions.add('resume_$courseType');
    }
    if (status == 'ready') {
      actions.add('mark_served_$courseType');
    }

    return actions;
  }

  static Map<String, dynamic> performAction(
    String sessionId,
    String action, {
    String? courseType,
    String? servingMode,
  }) {
    final session = findById(sessionId);
    if (session == null) {
      throw ArgumentError('Firing session not found');
    }

    if (action == 'sequential_serving') {
      session['servingMode'] = 'sequential';
      return _cloneSession(session);
    }
    if (action == 'simultaneous_serving') {
      session['servingMode'] = 'simultaneous';
      return _cloneSession(session);
    }
    if (action == 'sync_pacing') {
      final pacing = Map<String, dynamic>.from(
        session['pacing'] as Map<String, dynamic>,
      );
      pacing['syncDelayMinutes'] = 0;
      pacing['guestReady'] = true;
      session['pacing'] = pacing;
      return _cloneSession(session);
    }

    final resolvedCourse = courseType ?? _courseTypeFromAction(action);
    if (resolvedCourse == null) {
      throw ArgumentError('Unknown firing action: $action');
    }

    final course = _course(session, resolvedCourse);
    if (course == null) {
      throw ArgumentError('Course not found: $resolvedCourse');
    }

    if (action.startsWith('fire_')) {
      course['status'] = 'fired';
      course['firedSecondsAgo'] = 0;
      _kickLinkedOrders(session, resolvedCourse, 'prepare');
    } else if (action.startsWith('hold_')) {
      course['status'] = 'held';
      _kickLinkedOrders(session, resolvedCourse, 'hold');
    } else if (action.startsWith('resume_')) {
      course['status'] = 'fired';
      course['firedSecondsAgo'] = 0;
      _kickLinkedOrders(session, resolvedCourse, 'release');
    } else if (action.startsWith('mark_served_')) {
      course['status'] = 'served';
    } else if (servingMode != null) {
      session['servingMode'] = servingMode;
    } else {
      throw ArgumentError('Unknown firing action: $action');
    }

    _advanceSequentialFlow(session);
    return _cloneSession(session);
  }

  static void tickTimers() {
    for (final session in _sessions) {
      final pacing = session['pacing'] as Map<String, dynamic>;
      pacing['tableMinutesSinceSeat'] =
          (pacing['tableMinutesSinceSeat'] as int) + 0;

      for (final course in session['courses'] as List<dynamic>) {
        final map = course as Map<String, dynamic>;
        final status = map['status'] as String;
        if (status == 'fired' || status == 'preparing') {
          map['firedSecondsAgo'] = (map['firedSecondsAgo'] as int? ?? 0) + 1;
          if ((map['firedSecondsAgo'] as int) > 480 && status == 'fired') {
            map['status'] = 'preparing';
          }
          if ((map['firedSecondsAgo'] as int) > 720 && status == 'preparing') {
            map['status'] = 'ready';
          }
        }
      }
    }
  }

  static void _advanceSequentialFlow(Map<String, dynamic> session) {
    if (session['servingMode'] != 'sequential') {
      return;
    }
    final courses = session['courses'] as List<dynamic>;
    var previousComplete = true;
    for (final raw in courses) {
      final course = raw as Map<String, dynamic>;
      final status = course['status'] as String;
      if (!previousComplete && status == 'pending') {
        break;
      }
      if (status == 'served' || status == 'ready') {
        previousComplete = true;
        continue;
      }
      previousComplete = false;
    }
  }

  static void _kickLinkedOrders(
    Map<String, dynamic> session,
    String courseType,
    String orderAction,
  ) {
    final linked = session['linkedOrderIds'] as List<dynamic>;
    final course = _course(session, courseType)!;
    final category = _categoryForCourse(courseType);

    for (final rawId in linked) {
      final orderId = rawId.toString();
      final order = MockOrderStore.findById(orderId);
      if (order == null) {
        continue;
      }
      if (order['category'] != category && courseType != 'main') {
        continue;
      }
      try {
        MockOrderStore.processAction(orderId, orderAction);
      } catch (_) {
        // Ignore invalid transitions for demo orders.
      }
    }
  }

  static String? _courseTypeFromAction(String action) {
    for (final type in ['starter', 'main', 'dessert']) {
      if (action.contains(type)) {
        return type;
      }
    }
    return null;
  }

  static String _categoryForCourse(String courseType) {
    return switch (courseType) {
      'starter' => 'Starter',
      'main' => 'Main course',
      'dessert' => 'Dessert',
      _ => 'Main course',
    };
  }

  static Map<String, dynamic>? _course(
    Map<String, dynamic> session,
    String courseType,
  ) {
    for (final raw in session['courses'] as List<dynamic>) {
      final course = raw as Map<String, dynamic>;
      if (course['type'] == courseType) {
        return course;
      }
    }
    return null;
  }

  static Map<String, dynamic> _cloneSession(Map<String, dynamic> session) {
    return {
      ...session,
      'pacing': Map<String, dynamic>.from(session['pacing'] as Map),
      'sections': List<String>.from(session['sections'] as List),
      'linkedOrderIds': List<String>.from(session['linkedOrderIds'] as List),
      'courses': (session['courses'] as List<dynamic>)
          .map((course) => Map<String, dynamic>.from(course as Map))
          .toList(),
    };
  }

  static List<Map<String, dynamic>> _seedSessions() {
    return [
      _session(
        id: 'FIRE-T12',
        location: 'Table 12',
        tableNumber: '12',
        guestType: 'Regular',
        deliveryType: 'Dine-in',
        sections: ['Tandoor', 'Main'],
        servingMode: 'sequential',
        linkedOrderIds: ['ORD-1842'],
        vip: false,
        tableMinutesSinceSeat: 18,
        guestReady: true,
        syncDelayMinutes: 2,
        targetGapMinutes: 12,
        courses: [
          _courseSeed(
            type: 'starter',
            label: 'Starter',
            status: 'fired',
            items: ['1x Paneer tikka', '1x Tomato soup'],
            firedSecondsAgo: 120,
            etaMinutes: 8,
            linkedKot: 'KOT #1842-S',
          ),
          _courseSeed(
            type: 'main',
            label: 'Main course',
            status: 'pending',
            items: ['2x Butter naan', '1x Tandoori platter'],
            firedSecondsAgo: 0,
            etaMinutes: 18,
            linkedKot: 'KOT #1842',
          ),
          _courseSeed(
            type: 'dessert',
            label: 'Dessert',
            status: 'pending',
            items: ['1x Gulab jamun'],
            firedSecondsAgo: 0,
            etaMinutes: 10,
            linkedKot: 'KOT #1842-D',
          ),
        ],
      ),
      _session(
        id: 'FIRE-R804',
        location: 'Room 804',
        roomNumber: '804',
        guestType: 'VIP',
        deliveryType: 'Room service',
        sections: ['Main'],
        servingMode: 'sequential',
        linkedOrderIds: ['ORD-1843'],
        vip: true,
        tableMinutesSinceSeat: 32,
        guestReady: false,
        syncDelayMinutes: 6,
        targetGapMinutes: 15,
        courses: [
          _courseSeed(
            type: 'starter',
            label: 'Starter',
            status: 'served',
            items: ['1x Soup shooter'],
            firedSecondsAgo: 900,
            etaMinutes: 0,
            linkedKot: 'KOT #1843-S',
          ),
          _courseSeed(
            type: 'main',
            label: 'Main course',
            status: 'held',
            items: ['1x Dal makhani', '1x Steamed rice'],
            firedSecondsAgo: 0,
            etaMinutes: 16,
            linkedKot: 'KOT #1843',
          ),
          _courseSeed(
            type: 'dessert',
            label: 'Dessert',
            status: 'pending',
            items: ['1x Chocolate mousse'],
            firedSecondsAgo: 0,
            etaMinutes: 8,
            linkedKot: 'KOT #1843-D',
          ),
        ],
      ),
      _session(
        id: 'FIRE-BQA',
        location: 'Banquet A',
        guestType: 'Event',
        deliveryType: 'Banquet',
        sections: ['Dessert', 'Main'],
        servingMode: 'simultaneous',
        linkedOrderIds: ['ORD-1845'],
        vip: false,
        tableMinutesSinceSeat: 45,
        guestReady: true,
        syncDelayMinutes: 0,
        targetGapMinutes: 0,
        courses: [
          _courseSeed(
            type: 'starter',
            label: 'Starter',
            status: 'served',
            items: ['120x Canapés'],
            firedSecondsAgo: 1800,
            etaMinutes: 0,
            linkedKot: 'KOT #1845-S',
          ),
          _courseSeed(
            type: 'main',
            label: 'Main course',
            status: 'ready',
            items: ['120x Paneer tikka'],
            firedSecondsAgo: 960,
            etaMinutes: 0,
            linkedKot: 'KOT #1845-M',
          ),
          _courseSeed(
            type: 'dessert',
            label: 'Dessert',
            status: 'fired',
            items: ['40x Gulab jamun', '40x Ice cream scoop'],
            firedSecondsAgo: 45,
            etaMinutes: 12,
            linkedKot: 'KOT #1845',
          ),
        ],
      ),
      _session(
        id: 'FIRE-T7',
        location: 'Table 7',
        tableNumber: '7',
        guestType: 'Regular',
        deliveryType: 'Dine-in',
        sections: ['Salad', 'Main'],
        servingMode: 'sequential',
        linkedOrderIds: ['ORD-1849'],
        vip: false,
        tableMinutesSinceSeat: 9,
        guestReady: true,
        syncDelayMinutes: 0,
        targetGapMinutes: 10,
        courses: [
          _courseSeed(
            type: 'starter',
            label: 'Starter',
            status: 'preparing',
            items: ['2x Caesar salad'],
            firedSecondsAgo: 210,
            etaMinutes: 5,
            linkedKot: 'KOT #1849',
          ),
          _courseSeed(
            type: 'main',
            label: 'Main course',
            status: 'pending',
            items: ['2x Pasta primavera'],
            firedSecondsAgo: 0,
            etaMinutes: 14,
            linkedKot: 'KOT #1849-M',
          ),
          _courseSeed(
            type: 'dessert',
            label: 'Dessert',
            status: 'pending',
            items: ['1x Tiramisu'],
            firedSecondsAgo: 0,
            etaMinutes: 8,
            linkedKot: 'KOT #1849-D',
          ),
        ],
      ),
      _session(
        id: 'FIRE-T4',
        location: 'Table 4',
        tableNumber: '4',
        guestType: 'Regular',
        deliveryType: 'Dine-in',
        sections: ['Grill'],
        servingMode: 'sequential',
        linkedOrderIds: ['ORD-1847'],
        vip: false,
        tableMinutesSinceSeat: 22,
        guestReady: false,
        syncDelayMinutes: 4,
        targetGapMinutes: 12,
        courses: [
          _courseSeed(
            type: 'starter',
            label: 'Starter',
            status: 'served',
            items: ['1x Fish fingers'],
            firedSecondsAgo: 1200,
            etaMinutes: 0,
            linkedKot: 'KOT #1847-S',
          ),
          _courseSeed(
            type: 'main',
            label: 'Main course',
            status: 'held',
            items: ['1x Grilled fish'],
            firedSecondsAgo: 0,
            etaMinutes: 14,
            linkedKot: 'KOT #1847',
          ),
          _courseSeed(
            type: 'dessert',
            label: 'Dessert',
            status: 'pending',
            items: ['1x Lemon tart'],
            firedSecondsAgo: 0,
            etaMinutes: 9,
            linkedKot: 'KOT #1847-D',
          ),
        ],
      ),
    ];
  }

  static Map<String, dynamic> _session({
    required String id,
    required String location,
    required String guestType,
    required String deliveryType,
    required List<String> sections,
    required String servingMode,
    required List<String> linkedOrderIds,
    required bool vip,
    required int tableMinutesSinceSeat,
    required bool guestReady,
    required int syncDelayMinutes,
    required int targetGapMinutes,
    required List<Map<String, dynamic>> courses,
    String? tableNumber,
    String? roomNumber,
  }) {
    return {
      'id': id,
      'location': location,
      'tableNumber': tableNumber,
      'roomNumber': roomNumber,
      'guestType': guestType,
      'deliveryType': deliveryType,
      'sections': sections,
      'servingMode': servingMode,
      'linkedOrderIds': linkedOrderIds,
      'vip': vip,
      'pacing': {
        'tableMinutesSinceSeat': tableMinutesSinceSeat,
        'guestReady': guestReady,
        'syncDelayMinutes': syncDelayMinutes,
        'targetGapMinutes': targetGapMinutes,
      },
      'courses': courses,
    };
  }

  static Map<String, dynamic> _courseSeed({
    required String type,
    required String label,
    required String status,
    required List<String> items,
    required int firedSecondsAgo,
    required int etaMinutes,
    required String linkedKot,
  }) {
    return {
      'type': type,
      'label': label,
      'status': status,
      'items': items,
      'firedSecondsAgo': firedSecondsAgo,
      'etaMinutes': etaMinutes,
      'linkedKot': linkedKot,
    };
  }
}
