import 'package:flutter/material.dart';



enum LoginMethod {

  otp('Mobile OTP login', Icons.sms_outlined),

  pin('PIN login', Icons.pin_outlined),

  password('Password login', Icons.lock_outline),

  qr('QR staff login', Icons.qr_code_scanner_outlined),

  nfc('NFC login', Icons.nfc_outlined),

  face('Face recognition login', Icons.face_outlined),

  fingerprint('Fingerprint login', Icons.fingerprint_outlined);



  const LoginMethod(this.label, this.icon);



  final String label;

  final IconData icon;



  /// API / session key stored after login (e.g. `otp`, `nfc`).

  String get sessionKey => name;



  static LoginMethod? fromSessionKey(String? value) {

    if (value == null || value.isEmpty) {

      return null;

    }

    for (final method in LoginMethod.values) {

      if (method.name == value || method.label == value) {

        return method;

      }

    }

    return null;

  }



  static String displayLabel(String? sessionKey) =>

      fromSessionKey(sessionKey)?.label ?? sessionKey ?? '—';

}


