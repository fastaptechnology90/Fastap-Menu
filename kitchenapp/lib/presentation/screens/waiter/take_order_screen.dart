import 'package:flutter/material.dart';

import 'package:kitchenapp/core/api/api_exception.dart';
import 'package:kitchenapp/core/constants/app_colors.dart';
import 'package:kitchenapp/core/constants/app_spacing.dart';
import 'package:kitchenapp/services/auth_service.dart';
import 'package:kitchenapp/services/waiter_take_order_service.dart';
import 'package:kitchenapp/state/auth_controller.dart';
import 'package:kitchenapp/state/kitchen_command_controller.dart';

/// Minimal waiter take-order: pick table → add menu lines (variants/addons) → submit.
/// Prices shown are display-only; the server prices the ticket.
class TakeOrderScreen extends StatefulWidget {
  const TakeOrderScreen({
    super.key,
    required this.auth,
    required this.controller,
  });

  final AuthController auth;
  final KitchenCommandController controller;

  @override
  State<TakeOrderScreen> createState() => _TakeOrderScreenState();
}

class _TakeOrderScreenState extends State<TakeOrderScreen> {
  late final WaiterTakeOrderService _service;
  bool _loading = true;
  bool _submitting = false;
  String? _error;
  List<WaiterFloorTable> _tables = const [];
  List<WaiterMenuItem> _menu = const [];
  WaiterFloorTable? _table;
  final List<WaiterCartLine> _cart = [];
  final _notes = TextEditingController();
  String _menuQuery = '';

  @override
  void initState() {
    super.initState();
    final AuthService authService = widget.auth.authService;
    _service = WaiterTakeOrderService.fromAuth(authService);
    _load();
  }

  @override
  void dispose() {
    _notes.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final tables = await _service.fetchTables();
      final menu = await _service.fetchMenu();
      if (!mounted) return;
      setState(() {
        _tables = tables;
        _menu = menu;
        _loading = false;
        if (_table == null && tables.isNotEmpty) {
          _table = tables.firstWhere(
            (t) => t.status == 'free',
            orElse: () => tables.first,
          );
        }
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = e.message;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = 'Could not load tables or menu. Check your connection.';
      });
    }
  }

  int get _lineCount =>
      _cart.fold<int>(0, (sum, line) => sum + line.quantity);

  double get _displaySubtotal =>
      _cart.fold<double>(0, (sum, line) => sum + line.displayLineEstimate);

  List<WaiterMenuItem> get _filteredMenu {
    final q = _menuQuery.trim().toLowerCase();
    if (q.isEmpty) return _menu;
    return _menu
        .where(
          (m) =>
              m.name.toLowerCase().contains(q) ||
              m.description.toLowerCase().contains(q),
        )
        .toList();
  }

  double _estimateUnit(WaiterMenuItem item, String? variant, List<String> addons) {
    var unit = item.displayPrice;
    if (variant != null) {
      for (final v in item.variants) {
        if (v.name == variant && v.displayPrice != null && v.displayPrice! > 0) {
          unit = v.displayPrice!;
          break;
        }
      }
    }
    for (final name in addons) {
      for (final a in item.addons) {
        if (a.name == name) unit += a.displayPrice;
      }
    }
    return unit;
  }

  void _bumpPlain(WaiterMenuItem item, int delta) {
    final idx = _cart.indexWhere(
      (l) =>
          l.menuItemId == item.id &&
          (l.variant == null || l.variant!.isEmpty) &&
          l.addonNames.isEmpty,
    );
    setState(() {
      if (idx < 0) {
        if (delta > 0) {
          _cart.add(
            WaiterCartLine(
              menuItemId: item.id,
              name: item.name,
              quantity: delta,
              displayUnitEstimate: item.displayPrice,
            ),
          );
        }
        return;
      }
      final next = _cart[idx].quantity + delta;
      if (next <= 0) {
        _cart.removeAt(idx);
      } else {
        _cart[idx].quantity = next;
      }
    });
  }

  int _plainQty(WaiterMenuItem item) {
    for (final l in _cart) {
      if (l.menuItemId == item.id &&
          (l.variant == null || l.variant!.isEmpty) &&
          l.addonNames.isEmpty) {
        return l.quantity;
      }
    }
    return 0;
  }

  Future<void> _addConfigurable(WaiterMenuItem item) async {
    final result = await showModalBottomSheet<_ConfiguredPick>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (ctx) => _ItemOptionsSheet(item: item),
    );
    if (result == null || !mounted) return;
    final estimate = _estimateUnit(item, result.variant, result.addonNames);
    setState(() {
      final idx = _cart.indexWhere(
        (l) =>
            l.menuItemId == item.id &&
            l.variant == result.variant &&
            _sameAddons(l.addonNames, result.addonNames),
      );
      if (idx >= 0) {
        _cart[idx].quantity += result.quantity;
      } else {
        _cart.add(
          WaiterCartLine(
            menuItemId: item.id,
            name: item.name,
            quantity: result.quantity,
            variant: result.variant,
            addonNames: result.addonNames,
            displayUnitEstimate: estimate,
          ),
        );
      }
    });
  }

  bool _sameAddons(List<String> a, List<String> b) {
    if (a.length != b.length) return false;
    final sa = [...a]..sort();
    final sb = [...b]..sort();
    for (var i = 0; i < sa.length; i++) {
      if (sa[i] != sb[i]) return false;
    }
    return true;
  }

  Future<void> _submit() async {
    final table = _table;
    if (table == null) {
      setState(() => _error = 'Pick a table first.');
      return;
    }
    if (_lineCount < 1) {
      setState(() => _error = 'Add at least one menu item.');
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final result = await _service.placeOrder(
        tableId: table.id,
        lines: List<WaiterCartLine>.from(_cart),
        notes: _notes.text,
      );
      await Future.wait([
        widget.controller.refreshDashboard(silent: true),
        widget.controller.refreshKds(silent: true),
      ]);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            '${result.message} · ${result.id} · ₹${result.total.toStringAsFixed(0)}',
          ),
        ),
      );
      Navigator.of(context).pop(result);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _error = e.message;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _error =
            'Order did not go through. Nothing was saved — try again.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Take order'),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            onPressed: _loading || _submitting ? null : _load,
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                if (_error != null)
                  Material(
                    color: AppColors.danger.withValues(alpha: 0.12),
                    child: ListTile(
                      leading:
                          Icon(Icons.error_outline, color: AppColors.danger),
                      title: Text(
                        _error!,
                        style: TextStyle(
                          color: AppColors.danger,
                          fontWeight: FontWeight.w600,
                          fontSize: 13,
                        ),
                      ),
                      trailing: IconButton(
                        icon: const Icon(Icons.close),
                        onPressed: () => setState(() => _error = null),
                      ),
                    ),
                  ),
                Expanded(
                  child: ListView(
                    padding: const EdgeInsets.all(AppSpacing.xl),
                    children: [
                      Text(
                        '1. Table',
                        style: TextStyle(
                          fontWeight: FontWeight.w900,
                          color: AppColors.primaryText,
                          fontSize: 16,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      if (_tables.isEmpty)
                        Text(
                          'No active tables for this restaurant. Ask the manager to add tables under Tables in the restaurant panel, then tap Refresh.',
                          style: TextStyle(color: AppColors.secondaryText),
                        )
                      else
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            for (final t in _tables)
                              ChoiceChip(
                                label: Text(
                                  '${t.name}${t.status == 'occupied' ? ' · seated' : ''}',
                                ),
                                selected: _table?.id == t.id,
                                onSelected: _submitting
                                    ? null
                                    : (_) => setState(() => _table = t),
                              ),
                          ],
                        ),
                      const SizedBox(height: AppSpacing.xl),
                      Text(
                        '2. Menu',
                        style: TextStyle(
                          fontWeight: FontWeight.w900,
                          color: AppColors.primaryText,
                          fontSize: 16,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Prices shown are from the menu. The bill is calculated on the server.',
                        style: TextStyle(
                          color: AppColors.secondaryText,
                          fontSize: 12,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      TextField(
                        onChanged: (v) => setState(() => _menuQuery = v),
                        decoration: const InputDecoration(
                          hintText: 'Search dishes…',
                          prefixIcon: Icon(Icons.search_rounded),
                        ),
                      ),
                      const SizedBox(height: AppSpacing.md),
                      if (_menu.isEmpty)
                        Text(
                          'No available menu items. Confirm dishes are active in Menu Management, then tap Refresh.',
                          style: TextStyle(color: AppColors.secondaryText),
                        )
                      else
                        ..._filteredMenu.map(_menuTile),
                      if (_cart.isNotEmpty) ...[
                        const SizedBox(height: AppSpacing.xl),
                        Text(
                          'Cart',
                          style: TextStyle(
                            fontWeight: FontWeight.w900,
                            color: AppColors.primaryText,
                            fontSize: 16,
                          ),
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        for (var i = 0; i < _cart.length; i++)
                          _cartTile(i, _cart[i]),
                      ],
                      const SizedBox(height: AppSpacing.lg),
                      TextField(
                        controller: _notes,
                        maxLines: 2,
                        enabled: !_submitting,
                        decoration: const InputDecoration(
                          labelText: 'Kitchen notes (optional)',
                        ),
                      ),
                      const SizedBox(height: 88),
                    ],
                  ),
                ),
                SafeArea(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            _lineCount == 0
                                ? 'No items yet'
                                : '$_lineCount item${_lineCount == 1 ? '' : 's'} · ≈ ₹${_displaySubtotal.toStringAsFixed(0)}',
                            style: TextStyle(
                              fontWeight: FontWeight.w700,
                              color: AppColors.primaryText,
                            ),
                          ),
                        ),
                        FilledButton.icon(
                          onPressed: _submitting ||
                                  _lineCount < 1 ||
                                  _table == null
                              ? null
                              : _submit,
                          icon: _submitting
                              ? const SizedBox(
                                  width: 16,
                                  height: 16,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                  ),
                                )
                              : const Icon(Icons.send_rounded),
                          label:
                              Text(_submitting ? 'Sending…' : 'Place order'),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
    );
  }

  Widget _menuTile(WaiterMenuItem item) {
    if (item.hasOptions) {
      return Card(
        margin: const EdgeInsets.only(bottom: 8),
        child: ListTile(
          title: Text(
            item.name,
            style: const TextStyle(fontWeight: FontWeight.w700),
          ),
          subtitle: Text(
            [
              if (item.description.isNotEmpty) item.description,
              '₹${item.displayPrice.toStringAsFixed(0)}'
                  '${item.variants.isNotEmpty ? ' · sizes' : ''}'
                  '${item.addons.isNotEmpty ? ' · add-ons' : ''}',
            ].join('\n'),
            maxLines: 3,
            overflow: TextOverflow.ellipsis,
          ),
          isThreeLine: item.description.isNotEmpty,
          trailing: FilledButton.tonal(
            onPressed: _submitting ? null : () => _addConfigurable(item),
            child: const Text('Add'),
          ),
        ),
      );
    }

    final q = _plainQty(item);
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        title: Text(
          item.name,
          style: const TextStyle(fontWeight: FontWeight.w700),
        ),
        subtitle: Text(
          item.description.isEmpty
              ? '₹${item.displayPrice.toStringAsFixed(0)}'
              : '${item.description}\n₹${item.displayPrice.toStringAsFixed(0)}',
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
        ),
        isThreeLine: item.description.isNotEmpty,
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            IconButton(
              onPressed:
                  _submitting || q < 1 ? null : () => _bumpPlain(item, -1),
              icon: const Icon(Icons.remove_circle_outline),
            ),
            Text('$q', style: const TextStyle(fontWeight: FontWeight.w800)),
            IconButton(
              onPressed: _submitting ? null : () => _bumpPlain(item, 1),
              icon: const Icon(Icons.add_circle_outline),
            ),
          ],
        ),
      ),
    );
  }

  Widget _cartTile(int index, WaiterCartLine line) {
    final detail = [
      if (line.variant != null && line.variant!.isNotEmpty) line.variant!,
      if (line.addonNames.isNotEmpty) line.addonNames.join(', '),
    ].join(' · ');
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        title: Text(line.name, style: const TextStyle(fontWeight: FontWeight.w700)),
        subtitle: Text(
          detail.isEmpty
              ? '≈ ₹${line.displayLineEstimate.toStringAsFixed(0)}'
              : '$detail\n≈ ₹${line.displayLineEstimate.toStringAsFixed(0)}',
        ),
        isThreeLine: detail.isNotEmpty,
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            IconButton(
              onPressed: _submitting
                  ? null
                  : () => setState(() {
                        final next = line.quantity - 1;
                        if (next <= 0) {
                          _cart.removeAt(index);
                        } else {
                          line.quantity = next;
                        }
                      }),
              icon: const Icon(Icons.remove_circle_outline),
            ),
            Text(
              '${line.quantity}',
              style: const TextStyle(fontWeight: FontWeight.w800),
            ),
            IconButton(
              onPressed: _submitting
                  ? null
                  : () => setState(() => line.quantity += 1),
              icon: const Icon(Icons.add_circle_outline),
            ),
          ],
        ),
      ),
    );
  }
}

class _ConfiguredPick {
  const _ConfiguredPick({
    required this.quantity,
    this.variant,
    this.addonNames = const [],
  });

  final int quantity;
  final String? variant;
  final List<String> addonNames;
}

class _ItemOptionsSheet extends StatefulWidget {
  const _ItemOptionsSheet({required this.item});

  final WaiterMenuItem item;

  @override
  State<_ItemOptionsSheet> createState() => _ItemOptionsSheetState();
}

class _ItemOptionsSheetState extends State<_ItemOptionsSheet> {
  late String? _variant;
  final Set<String> _addons = {};
  int _qty = 1;

  @override
  void initState() {
    super.initState();
    _variant =
        widget.item.variants.isNotEmpty ? widget.item.variants.first.name : null;
  }

  @override
  Widget build(BuildContext context) {
    final item = widget.item;
    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 8,
        bottom: MediaQuery.viewInsetsOf(context).bottom + 20,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            item.name,
            style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 18),
          ),
          const SizedBox(height: 4),
          Text(
            'Choices only — the server sets the price.',
            style: TextStyle(color: AppColors.secondaryText, fontSize: 12),
          ),
          if (item.variants.isNotEmpty) ...[
            const SizedBox(height: 16),
            const Text('Size', style: TextStyle(fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final v in item.variants)
                  ChoiceChip(
                    label: Text(
                      v.displayPrice == null
                          ? v.name
                          : '${v.name} · ₹${v.displayPrice!.toStringAsFixed(0)}',
                    ),
                    selected: _variant == v.name,
                    onSelected: (_) => setState(() => _variant = v.name),
                  ),
              ],
            ),
          ],
          if (item.addons.isNotEmpty) ...[
            const SizedBox(height: 16),
            const Text('Add-ons', style: TextStyle(fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final a in item.addons)
                  FilterChip(
                    label: Text(
                      '${a.name} · ₹${a.displayPrice.toStringAsFixed(0)}',
                    ),
                    selected: _addons.contains(a.name),
                    onSelected: (on) => setState(() {
                      if (on) {
                        _addons.add(a.name);
                      } else {
                        _addons.remove(a.name);
                      }
                    }),
                  ),
              ],
            ),
          ],
          const SizedBox(height: 16),
          Row(
            children: [
              IconButton(
                onPressed: _qty <= 1 ? null : () => setState(() => _qty -= 1),
                icon: const Icon(Icons.remove_circle_outline),
              ),
              Text('$_qty', style: const TextStyle(fontWeight: FontWeight.w900)),
              IconButton(
                onPressed: () => setState(() => _qty += 1),
                icon: const Icon(Icons.add_circle_outline),
              ),
              const Spacer(),
              FilledButton(
                onPressed: () => Navigator.pop(
                  context,
                  _ConfiguredPick(
                    quantity: _qty,
                    variant: _variant,
                    addonNames: _addons.toList(),
                  ),
                ),
                child: const Text('Add to cart'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
