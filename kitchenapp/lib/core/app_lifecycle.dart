import 'package:flutter/foundation.dart';

/// True while the app is actually on screen.
///
/// `Timer`s keep firing in a pocket, and Flutter stops producing frames there,
/// so anything that must stop has to be *told* — waiting for a rebuild would
/// mean waiting until the screen comes back on. The shell sets this; per-card
/// countdowns and other repeating work listen to it.
final ValueNotifier<bool> appForeground = ValueNotifier<bool>(true);
