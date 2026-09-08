import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

import '../core/settings/alert_settings.dart';
import '../models/kds/kds_snapshot.dart';
import '../models/kds/kds_view_mode.dart';

/// Bundled alarm tone (see `pubspec.yaml`). Declared here so a media-channel
/// driver has one place to read it from; kitchenapp is also a package
/// dependency of the waiter and housekeeping apps, where the bundler exposes
/// the same file under [packagedToneAsset].
const kitchenAlarmToneAsset = 'assets/audio/kitchen_alarm.wav';
const kitchenAlarmPackagedToneAsset =
    'packages/kitchenapp/$kitchenAlarmToneAsset';

/// How the alarm actually makes noise.
///
/// Split out from [KitchenAlarmService] so the escalation logic can be
/// exercised without a platform channel, and so a media/alarm-channel player
/// can replace the system-sound fallback without touching the ladder.
abstract class KitchenAlarmTone {
  /// Sounds one burst. [pulses] grows as the alarm escalates.
  Future<void> play({required int pulses, required bool haptics});
}

/// The tone available with no audio backend on the device: a burst of the OS
/// alert sound plus haptics.
///
/// This rides the UI-sounds channel, which on a wall-mounted tablet is often
/// turned down or off — hence the deliberately un-ignorable *pattern* (repeated
/// pulses that multiply as the alarm escalates) and the vibration alongside it.
class SystemKitchenAlarmTone implements KitchenAlarmTone {
  const SystemKitchenAlarmTone();

  static const _pulseGap = Duration(milliseconds: 180);

  @override
  Future<void> play({required int pulses, required bool haptics}) async {
    for (var i = 0; i < pulses; i++) {
      unawaited(SystemSound.play(SystemSoundType.alert));
      if (haptics) {
        unawaited(HapticFeedback.heavyImpact());
      }
      if (i < pulses - 1) {
        await Future<void>.delayed(_pulseGap);
      }
    }
  }
}

/// Rings until a chef acknowledges a new order.
///
/// A kitchen display exists to say that an order arrived, so this fires for
/// **every** new KOT — not only priority or VIP ones — repeats on a shortening
/// interval, and gets longer bursts the longer it is ignored. It lives on the
/// command controller rather than inside the KDS view so it keeps working while
/// the chef is on Stations, Prep, Home or anywhere else in the app.
class KitchenAlarmService extends ChangeNotifier {
  KitchenAlarmService({KitchenAlarmTone? tone})
      : _tone = tone ?? const SystemKitchenAlarmTone() {
    _soundEnabled = soundAlertsEnabled.value;
    _hapticsEnabled = hapticFeedbackEnabled.value;
    soundAlertsEnabled.addListener(_applySoundSetting);
    hapticFeedbackEnabled.addListener(_applyHapticSetting);
  }

  void _applySoundSetting() => soundEnabled = soundAlertsEnabled.value;

  void _applyHapticSetting() => hapticsEnabled = hapticFeedbackEnabled.value;

  /// Gap before the next burst, per escalation stage. It shortens because an
  /// unacknowledged ticket is a table waiting; the last entry repeats forever.
  static const escalationLadder = <Duration>[
    Duration(seconds: 8),
    Duration(seconds: 6),
    Duration(seconds: 4),
    Duration(seconds: 3),
    Duration(seconds: 2),
  ];

  final KitchenAlarmTone _tone;

  /// KOTs that have rung and are still waiting to be acknowledged.
  final Set<String> _pending = <String>{};

  /// KOTs the chef has already silenced. Kept so a later poll of the same
  /// still-new order does not start the alarm again.
  final Set<String> _acknowledged = <String>{};

  Timer? _repeatTimer;
  int _stage = 0;
  bool _soundEnabled = true;
  bool _hapticsEnabled = true;
  bool _paused = false;

  bool get soundEnabled => _soundEnabled;
  bool get hapticsEnabled => _hapticsEnabled;

  /// True while there is at least one KOT nobody has acknowledged.
  bool get isRinging => _pending.isNotEmpty;

  int get pendingCount => _pending.length;

  /// 0 = first alert, rising to `escalationLadder.length - 1`.
  int get escalationStage => _stage;

  set soundEnabled(bool value) {
    if (_soundEnabled == value) return;
    _soundEnabled = value;
    if (!value) {
      _stopRinging();
    } else if (_pending.isNotEmpty) {
      _restart();
    }
    notifyListeners();
  }

  set hapticsEnabled(bool value) {
    if (_hapticsEnabled == value) return;
    _hapticsEnabled = value;
    notifyListeners();
  }

  /// Silences the timer while the app is backgrounded — the alarm is useless
  /// with the screen off, and a timer that keeps firing all shift is not.
  /// The pending set is kept, so the alarm resumes on the way back in.
  void setPaused(bool value) {
    if (_paused == value) return;
    _paused = value;
    if (_paused) {
      _repeatTimer?.cancel();
      _repeatTimer = null;
    } else if (_pending.isNotEmpty) {
      _restart();
    }
  }

  /// Compares a freshly polled board against what the chef has already seen.
  void evaluate(KdsSnapshot? snapshot) {
    if (snapshot == null) {
      return;
    }

    // Only un-started tickets shout. Accepting an order is itself an
    // acknowledgement, and an order that left the board is nobody's problem.
    final awaiting = <String>{
      for (final order in snapshot.orders)
        if (order.status == KdsStatus.newOrder) order.id,
    };
    _pending.removeWhere((id) => !awaiting.contains(id));
    _acknowledged.removeWhere((id) => !awaiting.contains(id));

    var arrived = false;
    for (final id in awaiting) {
      if (_acknowledged.contains(id) || _pending.contains(id)) {
        continue;
      }
      _pending.add(id);
      arrived = true;
    }

    if (_pending.isEmpty) {
      _stopRinging();
      notifyListeners();
      return;
    }

    // A brand-new KOT restarts the ladder so it gets a clean first alert
    // rather than inheriting whatever stage an older ticket had climbed to.
    if (arrived || _repeatTimer == null) {
      _restart();
    }
    notifyListeners();
  }

  /// Chef heard it. Silences every currently-ringing KOT; the next arrival
  /// starts the alarm again from stage zero.
  void acknowledge() {
    if (_pending.isEmpty) {
      return;
    }
    _acknowledged.addAll(_pending);
    _pending.clear();
    _stopRinging();
    if (_hapticsEnabled) {
      unawaited(HapticFeedback.selectionClick());
    }
    notifyListeners();
  }

  /// Clears everything — used on sign-out and when the board owner changes.
  void reset() {
    _pending.clear();
    _acknowledged.clear();
    _stopRinging();
    notifyListeners();
  }

  void _restart() {
    _stage = 0;
    _ring();
    _scheduleNext();
  }

  void _ring() {
    if (!_soundEnabled || _paused) {
      return;
    }
    unawaited(
      _tone.play(pulses: _stage + 2, haptics: _hapticsEnabled),
    );
  }

  void _scheduleNext() {
    _repeatTimer?.cancel();
    if (_paused || !_soundEnabled) {
      _repeatTimer = null;
      return;
    }
    final delay = escalationLadder[_stage.clamp(0, escalationLadder.length - 1)];
    _repeatTimer = Timer(delay, () {
      if (_pending.isEmpty) {
        _stopRinging();
        notifyListeners();
        return;
      }
      if (_stage < escalationLadder.length - 1) {
        _stage++;
      }
      _ring();
      notifyListeners();
      _scheduleNext();
    });
  }

  void _stopRinging() {
    _repeatTimer?.cancel();
    _repeatTimer = null;
    _stage = 0;
  }

  @override
  void dispose() {
    soundAlertsEnabled.removeListener(_applySoundSetting);
    hapticFeedbackEnabled.removeListener(_applyHapticSetting);
    _repeatTimer?.cancel();
    _repeatTimer = null;
    super.dispose();
  }
}
