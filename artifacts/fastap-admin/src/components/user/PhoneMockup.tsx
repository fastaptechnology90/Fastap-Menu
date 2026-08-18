import { MapPin, Star, Plus, ShoppingCart } from "lucide-react";

const DEMO_ITEMS = [
  { name: "Butter Chicken", price: 420, veg: false, rating: 4.8 },
  { name: "Paneer Tikka", price: 320, veg: true, rating: 4.6 },
  { name: "Mango Lassi", price: 120, veg: true, rating: 4.9 },
];

export function PhoneMockup() {
  return (
    <div className="guest-float relative">
      <div className="absolute -inset-8 rounded-full bg-orange-500/20 blur-3xl pointer-events-none" />
      <div className="guest-phone-frame w-[280px] sm:w-[300px]">
        <div className="guest-phone-screen">
          {/* Status bar */}
          <div className="flex items-center justify-between px-5 pt-3 pb-2 text-[10px] text-white/40">
            <span>9:41</span>
            <div className="flex gap-1">
              <span className="w-3 h-2 rounded-sm bg-white/30" />
              <span className="w-3 h-2 rounded-sm bg-white/30" />
            </div>
          </div>

          {/* App header */}
          <div className="px-4 pb-3 border-b border-white/5">
            <div className="flex items-center gap-1.5 text-[10px] text-white/40 mb-1">
              <MapPin className="h-2.5 w-2.5 text-orange-400" />
              <span>Main Hall</span>
              <span>·</span>
              <span className="text-orange-400 font-semibold">T-12</span>
            </div>
            <h3 className="font-display font-bold text-sm">The Grand Spice</h3>
          </div>

          {/* Menu items */}
          <div className="px-3 py-3 space-y-2">
            {DEMO_ITEMS.map(item => (
              <div
                key={item.name}
                className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06]"
              >
                <div className={`h-2 w-2 rounded-full shrink-0 ${item.veg ? "bg-emerald-400" : "bg-red-400"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate">{item.name}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                    <span className="text-[10px] text-white/40">{item.rating}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-bold text-orange-400">₹{item.price}</p>
                  <button className="mt-1 h-5 w-5 rounded-md bg-orange-500 flex items-center justify-center ml-auto">
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom CTA */}
          <div className="mx-3 mb-4 p-2.5 rounded-xl guest-btn-primary text-xs font-bold">
            <div className="flex items-center justify-center gap-2">
              <ShoppingCart className="h-3.5 w-3.5" />
              View Cart · ₹860
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
