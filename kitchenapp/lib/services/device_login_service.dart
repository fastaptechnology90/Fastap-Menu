import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:local_auth/error_codes.dart' as auth_error;
import 'package:local_auth/local_auth.dart';
import 'package:nfc_manager/nfc_manager.dart';

import '../models/auth/login_method.dart';

class DeviceLoginResult {
  const DeviceLoginResult({
    required this.success,
    this.skippedHardware = false,
    this.message,
    this.hardwareToken,
  });

  final bool success;
  final bool skippedHardware;
  final String? message;
  final String? hardwareToken;

  factory DeviceLoginResult.ok({String? hardwareToken}) =>
      DeviceLoginResult(success: true, hardwareToken: hardwareToken);

  factory DeviceLoginResult.fail(String message) =>
      DeviceLoginResult(success: false, message: message);

  factory DeviceLoginResult.skipped() =>
      const DeviceLoginResult(success: true, skippedHardware: true);
}

class DeviceLoginService {
  DeviceLoginService({LocalAuthentication? localAuth})
      : _localAuth = localAuth ?? LocalAuthentication();

  final LocalAuthentication _localAuth;

  bool get _supportsNativeHardware {
    if (kIsWeb) {
      return false;
    }
    return switch (defaultTargetPlatform) {
      TargetPlatform.android ||
      TargetPlatform.iOS ||
      TargetPlatform.windows ||
      TargetPlatform.macOS =>
        true,
      _ => false,
    };
  }

  Future<DeviceLoginResult> verifyBiometric(LoginMethod method) async {
    if (method != LoginMethod.face && method != LoginMethod.fingerprint) {
      return DeviceLoginResult.fail('Unsupported biometric method');
    }

    if (!_supportsNativeHardware) {
      return DeviceLoginResult.skipped();
    }

    try {
      final isSupported = await _localAuth.isDeviceSupported();
      if (!isSupported) {
        return DeviceLoginResult.fail(
          'This device does not support biometric sign-in. Use password or PIN.',
        );
      }

      final available = await _localAuth.getAvailableBiometrics();
      final canCheck = await _localAuth.canCheckBiometrics;

      if (available.isEmpty && !canCheck) {
        return DeviceLoginResult.fail(
          'Set up fingerprint or face unlock in device settings, then try again.',
        );
      }

      if (available.isNotEmpty) {
        if (method == LoginMethod.face && !supportsFace(available)) {
          if (supportsFingerprint(available)) {
            return DeviceLoginResult.fail(
              'Face recognition is not enrolled. Use Fingerprint login or enroll Face Unlock in settings.',
            );
          }
        }
        if (method == LoginMethod.fingerprint &&
            !supportsFingerprint(available)) {
          if (supportsFace(available)) {
            return DeviceLoginResult.fail(
              'Fingerprint is not enrolled. Use Face login or add a fingerprint in settings.',
            );
          }
        }
      }

      // Windows Hello does not support biometricOnly.
      final biometricOnly = method == LoginMethod.face &&
          defaultTargetPlatform != TargetPlatform.windows;

      final authenticated = await _localAuth.authenticate(
        localizedReason: method == LoginMethod.face
            ? 'Verify your face to sign in to FASTAP Smart Hospitality'
            : 'Verify your fingerprint to sign in to FASTAP Smart Hospitality',
        options: AuthenticationOptions(
          stickyAuth: true,
          biometricOnly: biometricOnly,
          useErrorDialogs: true,
          sensitiveTransaction: false,
        ),
      );

      if (!authenticated) {
        return DeviceLoginResult.fail('Biometric verification was cancelled.');
      }

      return DeviceLoginResult.ok(hardwareToken: 'local-auth-verified');
    } on PlatformException catch (error) {
      return DeviceLoginResult.fail(platformErrorMessage(error, method));
    } catch (_) {
      return DeviceLoginResult.fail(
        'Biometric verification failed. Try password or PIN login.',
      );
    }
  }

  static bool supportsFace(List<BiometricType> available) =>
      available.contains(BiometricType.face) ||
      available.contains(BiometricType.strong) ||
      available.contains(BiometricType.weak);

  static bool supportsFingerprint(List<BiometricType> available) =>
      available.contains(BiometricType.fingerprint) ||
      available.contains(BiometricType.strong) ||
      available.contains(BiometricType.weak);

  static String platformErrorMessage(
    PlatformException error,
    LoginMethod method,
  ) {
    return switch (error.code) {
      auth_error.notAvailable =>
        'Biometric hardware is not available on this device.',
      auth_error.notEnrolled =>
        method == LoginMethod.face
            ? 'No face profile enrolled. Add Face Unlock in device settings.'
            : 'No fingerprint enrolled. Add a fingerprint in device settings.',
      auth_error.passcodeNotSet =>
        'Set a device PIN, pattern, or password before using biometrics.',
      auth_error.lockedOut =>
        'Too many failed attempts. Wait a moment and try again.',
      auth_error.permanentlyLockedOut =>
        'Biometrics locked. Unlock with your device PIN or password first.',
      auth_error.otherOperatingSystem =>
        'Biometrics are not supported in this environment (e.g. iOS Simulator). Use password login.',
      auth_error.biometricOnlyNotSupported =>
        'Biometric-only mode is not supported here. Try again or use password login.',
      _ => error.message?.trim().isNotEmpty == true
          ? error.message!.trim()
          : 'Biometric verification failed. Try another login method.',
    };
  }

  Future<DeviceLoginResult> readNfcStaffCode({
    Duration timeout = const Duration(seconds: 25),
  }) async {
    if (!_supportsNativeHardware) {
      return DeviceLoginResult.skipped();
    }

    try {
      final available = await NfcManager.instance.isAvailable();
      if (!available) {
        return DeviceLoginResult.fail('NFC is not available on this device.');
      }

      final completer = Completer<DeviceLoginResult>();
      Timer? timer;

      timer = Timer(timeout, () async {
        if (!completer.isCompleted) {
          await NfcManager.instance.stopSession();
          completer.complete(
            DeviceLoginResult.fail('NFC scan timed out. Tap your badge again.'),
          );
        }
      });

      await NfcManager.instance.startSession(
        onDiscovered: (NfcTag tag) async {
          if (completer.isCompleted) {
            return;
          }

          final staffCode = _extractStaffCode(tag);
          timer?.cancel();
          await NfcManager.instance.stopSession();

          if (staffCode == null || staffCode.isEmpty) {
            completer.complete(
              DeviceLoginResult.fail(
                'Badge not recognized. Use a registered staff NFC badge.',
              ),
            );
            return;
          }

          completer.complete(
            DeviceLoginResult.ok(hardwareToken: staffCode),
          );
        },
      );

      return completer.future;
    } catch (_) {
      return DeviceLoginResult.fail('Unable to read NFC badge.');
    }
  }

  String? _extractStaffCode(NfcTag tag) {
    final data = tag.data;
    for (final value in data.values) {
      if (value is! Map) {
        continue;
      }
      final map = Map<String, dynamic>.from(value);
      final cached = map['cachedMessage'];
      if (cached is Map) {
        final records = cached['records'];
        if (records is List) {
          for (final record in records) {
            if (record is! Map) {
              continue;
            }
            final payload = record['payload'];
            if (payload is List<int> && payload.length > 3) {
              final text = String.fromCharCodes(payload.skip(3)).trim();
              final code = _parseStaffToken(text);
              if (code != null) {
                return code;
              }
            }
          }
        }
      }

      final identifier = map['identifier'];
      if (identifier is List<int> && identifier.isNotEmpty) {
        final hex = identifier
            .map((byte) => byte.toRadixString(16).padLeft(2, '0'))
            .join();
        final code = _parseStaffToken(hex);
        if (code != null) {
          return code;
        }
      }
    }

    return _parseStaffToken(tag.data.toString());
  }

  String? _parseStaffToken(String raw) {
    final trimmed = raw.trim();
    if (trimmed.isEmpty) {
      return null;
    }

    final upper = trimmed.toUpperCase();
    final direct = RegExp(r'KCH-\d{3}').firstMatch(upper);
    if (direct != null) {
      return direct.group(0);
    }

    final labeled = RegExp(r'STAFF[_:=-]?([A-Z0-9-]{3,})', caseSensitive: false)
        .firstMatch(upper);
    if (labeled != null) {
      final token = labeled.group(1);
      if (token != null && token.startsWith('KCH')) {
        return token;
      }
    }

    return null;
  }
}

String? parseQrStaffToken(String raw) {
  final trimmed = raw.trim();
  if (trimmed.isEmpty) {
    return null;
  }

  final upper = trimmed.toUpperCase();
  final direct = RegExp(r'KCH-\d{3}').firstMatch(upper);
  if (direct != null) {
    return direct.group(0);
  }

  if (upper.startsWith('KCH-')) {
    return upper.split(RegExp(r'\s|,|;')).first;
  }

  return trimmed.length <= 24 ? trimmed : null;
}
