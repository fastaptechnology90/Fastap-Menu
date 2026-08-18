import 'mock_course_firing_registry.dart';
import 'mock_section_registry.dart';

class MockCourseFiringEngine {
  const MockCourseFiringEngine._();

  static Map<String, dynamic> buildSnapshot({String section = 'All'}) {
    MockCourseFiringRegistry.tickTimers();
    final sessions = MockCourseFiringRegistry.sessionsFor(section)
        .map(_serializeSession)
        .toList();

    final activeFires = sessions
        .expand((session) => session['courses'] as List<dynamic>)
        .where((course) {
          final map = course as Map<String, dynamic>;
          return {'fired', 'preparing'}.contains(map['status']);
        })
        .length;
    final heldCourses = sessions
        .expand((session) => session['courses'] as List<dynamic>)
        .where((course) => (course as Map)['status'] == 'held')
        .length;
    final vipSessions = sessions.where((session) => session['vip'] == true).length;
    final syncAlerts = sessions.where((session) {
      final pacing = session['pacing'] as Map<String, dynamic>;
      return (pacing['syncDelayMinutes'] as int) > 0;
    }).length;

    return {
      'section': section,
      'lastSyncedAt': DateTime.now().toIso8601String(),
      'sessions': sessions,
      'stats': {
        'totalSessions': sessions.length,
        'activeFires': activeFires,
        'heldCourses': heldCourses,
        'vipSessions': vipSessions,
        'syncAlerts': syncAlerts,
      },
      'smartFiring': {
        'tablePacing': true,
        'guestPacing': heldCourses > 0,
        'delaySynchronization': syncAlerts > 0,
        'multiCourseCoordination': sessions.length > 1,
      },
      'coordinationBoard': _coordinationBoard(sessions),
      'sections': MockSectionRegistry.filterSections,
    };
  }

  static Map<String, dynamic> syncAllPacing() {
    final sessions = MockCourseFiringRegistry.sessionsFor('All');
    for (final session in sessions) {
      MockCourseFiringRegistry.performAction(
        session['id'] as String,
        'sync_pacing',
      );
    }
    return {
      'success': true,
      'message':
          'Delay synchronization applied · ${sessions.length} tables aligned',
    };
  }

  static Map<String, dynamic> performAction(
    String sessionId,
    String action, {
    String? courseType,
    String? servingMode,
  }) {
    final updated = MockCourseFiringRegistry.performAction(
      sessionId,
      action,
      courseType: courseType,
      servingMode: servingMode,
    );
    return {
      'success': true,
      'session': updated,
    };
  }

  static List<Map<String, dynamic>> _coordinationBoard(
    List<Map<String, dynamic>> sessions,
  ) {
    return sessions
        .take(4)
        .map(
          (session) => {
            'sessionId': session['id'],
            'location': session['location'],
            'mode': session['servingMode'],
            'nextAction': _nextAction(session),
            'etaMinutes': _nextEta(session),
          },
        )
        .toList();
  }

  static String _nextAction(Map<String, dynamic> session) {
    for (final raw in session['courses'] as List<dynamic>) {
      final course = raw as Map<String, dynamic>;
      final status = course['status'] as String;
      if (status == 'held') {
        return 'Resume ${course['label']}';
      }
      if (status == 'pending') {
        return 'Fire ${course['label']}';
      }
      if (status == 'fired' || status == 'preparing') {
        return 'Finish ${course['label']}';
      }
    }
    return 'All courses served';
  }

  static int _nextEta(Map<String, dynamic> session) {
    for (final raw in session['courses'] as List<dynamic>) {
      final course = raw as Map<String, dynamic>;
      if (course['status'] != 'served') {
        return course['etaMinutes'] as int? ?? 0;
      }
    }
    return 0;
  }

  static Map<String, dynamic> _serializeSession(Map<String, dynamic> session) {
    final courses = (session['courses'] as List<dynamic>)
        .map((raw) {
          final course = Map<String, dynamic>.from(raw as Map);
          course['availableActions'] = MockCourseFiringRegistry.availableActions(
            session,
            course['type'] as String,
          );
          course['statusLabel'] = _statusLabel(course['status'] as String);
          course['elapsed'] = _formatElapsed(course['firedSecondsAgo'] as int? ?? 0);
          return course;
        })
        .toList();

    final pacing = session['pacing'] as Map<String, dynamic>;
    return {
      'id': session['id'],
      'location': session['location'],
      'tableNumber': session['tableNumber'],
      'roomNumber': session['roomNumber'],
      'guestType': session['guestType'],
      'deliveryType': session['deliveryType'],
      'sections': session['sections'],
      'servingMode': session['servingMode'],
      'servingModeLabel': session['servingMode'] == 'simultaneous'
          ? 'Simultaneous serving'
          : 'Sequential serving',
      'linkedOrderIds': session['linkedOrderIds'],
      'vip': session['vip'],
      'pacing': pacing,
      'courses': courses,
      'sessionActions': _sessionActions(session),
    };
  }

  static List<String> _sessionActions(Map<String, dynamic> session) {
    final actions = <String>[];
    if (session['servingMode'] == 'sequential') {
      actions.add('simultaneous_serving');
    } else {
      actions.add('sequential_serving');
    }
    actions.add('sync_pacing');
    return actions;
  }

  static String _statusLabel(String status) {
    return switch (status) {
      'pending' => 'Awaiting fire',
      'fired' => 'Fired',
      'preparing' => 'In kitchen',
      'ready' => 'Ready to serve',
      'held' => 'On hold',
      'served' => 'Served',
      _ => status,
    };
  }

  static String _formatElapsed(int seconds) {
    if (seconds <= 0) {
      return '00:00';
    }
    final minutes = seconds ~/ 60;
    final remainder = seconds % 60;
    return '${minutes.toString().padLeft(2, '0')}:${remainder.toString().padLeft(2, '0')}';
  }
}
