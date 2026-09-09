import { useState } from "react";
import { Link } from "wouter";
import { restaurantAuth } from "@/lib/api";
import { Icon } from "@/components/shared/Icon";
import { PanelLogo } from "@/components/shared/PanelLogo";
import { IMAGES } from "@/lib/media";
import { Crown } from "lucide-react";

type Step = 1 | 2 | 3 | 4;

const REQUIRED_BUSINESS_DOCS = [
  // ALL KYC documents are OPTIONAL at registration. If the owner uploads them, the Fastap
  // team verifies them; if not, the super admin can still approve the venue manually.
  { id: "gst_certificate", label: "GST registration certificate", required: false },
  { id: "fssai_license", label: "FSSAI license copy", required: false },
  { id: "business_registration", label: "Business registration / Shop Act license", required: false },
  { id: "bank_proof", label: "Bank proof (cancelled cheque or statement)", required: false },
] as const;

type RegDocument = {
  type: string;
  name: string;
  fileUrl: string;
  fileName?: string;
  fileType?: string;
};

const BUSINESS_TYPES = [
  { id: "restaurant", label: "Restaurant" },
  { id: "cafe", label: "Café" },
  { id: "hotel", label: "Hotel" },
  { id: "bar", label: "Bar / Lounge" },
  { id: "cloud_kitchen", label: "Cloud Kitchen" },
  { id: "franchise", label: "Franchise" },
];

const STEPS = ["Account", "Business", "KYC", "Review"];

// Auto-fill State/City from a 6-digit Indian PIN. Uses the free India Post API, and
// falls back to a first-2-digit → state map so State still fills when offline.
const PIN2_STATE: Record<string, string> = {
  "11": "Delhi", "12": "Haryana", "13": "Haryana", "14": "Punjab", "15": "Punjab", "16": "Punjab",
  "17": "Himachal Pradesh", "18": "Jammu & Kashmir", "19": "Jammu & Kashmir",
  "20": "Uttar Pradesh", "21": "Uttar Pradesh", "22": "Uttar Pradesh", "23": "Uttar Pradesh",
  "24": "Uttar Pradesh", "25": "Uttar Pradesh", "26": "Uttar Pradesh", "27": "Uttar Pradesh", "28": "Uttar Pradesh",
  "30": "Rajasthan", "31": "Rajasthan", "32": "Rajasthan", "33": "Rajasthan", "34": "Rajasthan",
  "36": "Gujarat", "37": "Gujarat", "38": "Gujarat", "39": "Gujarat",
  "40": "Maharashtra", "41": "Maharashtra", "42": "Maharashtra", "43": "Maharashtra", "44": "Maharashtra",
  "45": "Madhya Pradesh", "46": "Madhya Pradesh", "47": "Madhya Pradesh", "48": "Madhya Pradesh", "49": "Chhattisgarh",
  "50": "Telangana", "51": "Andhra Pradesh", "52": "Andhra Pradesh", "53": "Andhra Pradesh",
  "56": "Karnataka", "57": "Karnataka", "58": "Karnataka", "59": "Karnataka",
  "60": "Tamil Nadu", "61": "Tamil Nadu", "62": "Tamil Nadu", "63": "Tamil Nadu", "64": "Tamil Nadu",
  "67": "Kerala", "68": "Kerala", "69": "Kerala",
  "70": "West Bengal", "71": "West Bengal", "72": "West Bengal", "73": "West Bengal", "74": "West Bengal",
  "75": "Odisha", "76": "Odisha", "77": "Odisha", "78": "Assam", "79": "North East",
  "80": "Bihar", "81": "Bihar", "82": "Bihar", "83": "Jharkhand", "84": "Bihar", "85": "Bihar",
};
function stateFromPin(pin: string): string {
  return PIN2_STATE[pin.slice(0, 2)] ?? "";
}
async function lookupPincode(pin: string): Promise<{ city?: string; state?: string } | null> {
  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
    const data = await res.json();
    const po = data?.[0]?.PostOffice?.[0];
    if (po?.State) return { city: po.District || po.Block || po.Name || "", state: po.State };
  } catch { /* offline / blocked → fall back to the prefix map below */ }
  const st = stateFromPin(pin);
  return st ? { state: st } : null;
}

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 1600;

async function fileToUploadData(file: File): Promise<{ fileUrl: string; fileName: string; fileType: string }> {
  if (file.size > MAX_FILE_BYTES && !file.type.startsWith("image/")) {
    throw new Error(`${file.name} exceeds 5 MB. Use a smaller PDF.`);
  }
  if (file.type.startsWith("image/")) {
    const compressed = await compressImage(file);
    if (compressed.blob.size > MAX_FILE_BYTES) {
      throw new Error(`${file.name} is still too large after compression. Try a smaller image.`);
    }
    const fileUrl = await blobToDataUrl(compressed.blob);
    return { fileUrl, fileName: file.name, fileType: compressed.mime };
  }
  const fileUrl = await readFileAsDataUrl(file);
  if (fileUrl.length > MAX_FILE_BYTES * 1.4) {
    throw new Error(`${file.name} exceeds 5 MB.`);
  }
  return { fileUrl, fileName: file.name, fileType: file.type || "application/octet-stream" };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Could not read compressed image"));
    reader.readAsDataURL(blob);
  });
}

function compressImage(file: File): Promise<{ blob: Blob; mime: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(width, height));
      width = Math.round(width * scale);
      height = Math.round(height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not process image"));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        blob => {
          if (!blob) {
            reject(new Error("Could not compress image"));
            return;
          }
          resolve({ blob, mime: "image/jpeg" });
        },
        "image/jpeg",
        0.82,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Invalid image file"));
    };
    img.src = url;
  });
}

function DocUploadField({
  docDef,
  doc,
  onUpload,
  onClear,
}: {
  docDef: { id: string; label: string; required: boolean };
  doc?: RegDocument;
  onUpload: (d: RegDocument) => void;
  onClear: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-foreground leading-snug">
          {docDef.label}
          {docDef.required && <span className="text-danger ml-1">*</span>}
        </p>
        {doc?.fileName && (
          <button type="button" onClick={onClear} className="text-2xs text-danger shrink-0">Remove</button>
        )}
      </div>
      <label className={`flex items-center gap-2 ${uploading ? "opacity-60 pointer-events-none" : "cursor-pointer"}`}>
        <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary/15 border border-primary/30 text-primary text-xs font-semibold hover:bg-primary/25">
          <Icon name="upload_file" size={16} />
          {uploading ? "Processing…" : doc?.fileName ? "Replace file" : "Choose file"}
        </span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="hidden"
          disabled={uploading}
          onChange={e => {
            const file = e.target.files?.[0];
            if (!file) return;
            setUploadError("");
            setUploading(true);
            void fileToUploadData(file)
              .then(data => {
                onUpload({
                  type: docDef.id,
                  name: docDef.label,
                  fileUrl: data.fileUrl,
                  fileName: data.fileName,
                  fileType: data.fileType,
                });
              })
              // Shown beside the field rather than in a browser dialog, so the
              // applicant can see which document failed while they fix it.
              .catch(err => {
                setUploadError(err instanceof Error ? err.message : "Upload failed. Try a smaller file.");
              })
              .finally(() => {
                setUploading(false);
                e.target.value = "";
              });
          }}
        />
      </label>
      {uploadError && (
        <p role="alert" className="text-2xs text-danger flex items-center gap-1">
          <Icon name="error" size={14} /> {uploadError}
        </p>
      )}
      {doc?.fileName && (
        <p className="text-2xs text-success flex items-center gap-1">
          <Icon name="check_circle" size={14} /> {doc.fileName}
        </p>
      )}
    </div>
  );
}

export default function RestaurantRegister() {
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submittedVenue, setSubmittedVenue] = useState("");

  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");

  const [restaurantName, setRestaurantName] = useState("");
  const [businessType, setBusinessType] = useState("restaurant");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");
  const [pinLoading, setPinLoading] = useState(false);
  const [restaurantPhone, setRestaurantPhone] = useState("");
  const [restaurantEmail, setRestaurantEmail] = useState("");
  const [website, setWebsite] = useState("");

  const [legalBusinessName, setLegalBusinessName] = useState("");
  const [gstNumber, setGstNumber] = useState("");
  const [fssaiNumber, setFssaiNumber] = useState("");
  const [panNumber, setPanNumber] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [documents, setDocuments] = useState<RegDocument[]>([]);

  function upsertDocument(doc: RegDocument) {
    setDocuments(prev => {
      const rest = prev.filter(d => d.type !== doc.type);
      return [...rest, doc];
    });
  }

  function removeDocument(type: string) {
    setDocuments(prev => prev.filter(d => d.type !== type));
  }

  function getDoc(type: string) {
    return documents.find(d => d.type === type);
  }

  // Auto-fill City + State once the PIN is 6 digits.
  async function handlePincode(v: string) {
    const digits = v.replace(/\D/g, "").slice(0, 6);
    setPincode(digits);
    if (digits.length === 6) {
      setPinLoading(true);
      const r = await lookupPincode(digits);
      if (r) {
        if (r.state) setState(r.state);
        if (r.city) setCity(r.city);
      }
      setPinLoading(false);
    }
  }

  async function submitRegistration() {
    setLoading(true);
    setError("");
    try {
      const result = await restaurantAuth.register({
        staffRole: "owner",
        ownerName,
        ownerEmail,
        ownerPassword,
        ownerPhone: ownerPhone.replace(/\D/g, ""),
        restaurantName,
        businessType,
        address,
        city,
        state,
        pincode,
        restaurantPhone,
        restaurantEmail,
        website,
        legalBusinessName: legalBusinessName || restaurantName,
        gstNumber,
        fssaiNumber,
        panNumber,
        bankAccount,
        ifsc,
        documents,
      });
      if (result.pendingApproval) {
        setSubmittedVenue(result.restaurant?.name || restaurantName);
        setSubmitted(true);
        return;
      }
      setError("Registration completed but requires admin approval before sign-in.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  function validateStep(): boolean {
    setError("");

    if (step === 1) {
      if (!ownerName || !ownerEmail || ownerPassword.length < 6 || ownerPhone.replace(/\D/g, "").length < 10) {
        setError("Complete name, email, mobile, and password (6+ chars)");
        return false;
      }
    }
    if (step === 2 && (!restaurantName || !address)) {
      setError("Restaurant name and address are required");
      return false;
    }
    // Step 3: legal business name + bank account + IFSC are REQUIRED. GST/FSSAI/PAN and all
    // document uploads stay OPTIONAL — the super admin verifies/approves those later.
    if (step === 3) {
      if (!legalBusinessName.trim()) {
        setError("Legal business name is required");
        return false;
      }
      if (!bankAccount.trim() || !ifsc.trim()) {
        setError("Bank account and IFSC are required");
        return false;
      }
    }
    return true;
  }

  function handleContinue() {
    if (!validateStep()) return;
    if (step < STEPS.length) setStep((step + 1) as Step);
  }

  // Full cross-step validation for final submit. Required: owner account (step 1), basic
  // business details (step 2), and bank account + IFSC (step 3, for payouts). Documents and
  // GST/FSSAI/PAN stay OPTIONAL — the super admin verifies/approves those after submission.
  function firstIncompleteStep(): { step: Step; msg: string } | null {
    if (!ownerName || !ownerEmail || ownerPassword.length < 6 || ownerPhone.replace(/\D/g, "").length < 10) {
      return { step: 1, msg: "Complete name, email, mobile, and password (6+ chars)" };
    }
    if (!restaurantName || !address) {
      return { step: 2, msg: "Restaurant name and address are required" };
    }
    if (!legalBusinessName.trim()) {
      return { step: 3, msg: "Legal business name is required" };
    }
    if (!bankAccount.trim() || !ifsc.trim()) {
      return { step: 3, msg: "Bank account and IFSC are required" };
    }
    return null;
  }

  function handleSubmit() {
    const bad = firstIncompleteStep();
    if (bad) {
      setStep(bad.step);
      setError(bad.msg);
      return;
    }
    void submitRegistration();
  }

  return (
    <div className="restaurant-panel min-h-screen flex flex-col lg:flex-row">
      {submitted ? (
        <div className="flex-1 flex items-center justify-center px-4 py-16">
          <div className="max-w-md w-full text-center space-y-5">
            <div className="mx-auto w-16 h-16 rounded-full bg-success-subtle border border-success-border flex items-center justify-center">
              <Icon name="check_circle" size={36} className="text-success" />
            </div>
            <h1 className="text-2xl font-semibold">Registration submitted</h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              <span className="text-primary font-semibold">{submittedVenue}</span> has been sent to the Fastap team for KYC review.
              You will be able to sign in to the restaurant dashboard only after your documents are approved.
            </p>
            <p className="text-xs text-muted-foreground">
              Check your email ({ownerEmail}) for updates. Approval usually takes 1–2 business days.
            </p>
            <Link
              href="/restaurant/login"
              className="inline-flex items-center justify-center w-full py-3 rounded-lg bg-primary hover:bg-primary/90 font-semibold text-sm"
            >
              Go to sign in
            </Link>
          </div>
        </div>
      ) : (
      <>
      <div className="hidden lg:flex lg:w-2/5 relative overflow-hidden">
        <img src={IMAGES.heroKitchen} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[hsl(222,47%,5%)] via-[hsl(222,47%,5%)]/85 to-transparent" />
        <div className="relative p-10 flex flex-col justify-between min-h-full">
          <PanelLogo panel="restaurant" size="lg" showLabel label="FastMenu" />
          <div>
            <h2 className="font-display text-2xl font-semibold mb-2">Register as restaurant owner</h2>
            <p className="text-muted-foreground text-sm">
              Create your venue account with full KYC verification. Your application is reviewed by our team before dashboard access is granted.
            </p>
            <div className="flex flex-wrap gap-2 mt-4">
              <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-primary/15 border border-primary/30 text-primary"><Crown className="h-3 w-3" />Owner registration</span>
              <span className="text-xs px-2.5 py-1 rounded-full bg-muted border border-border">KYC required</span>
              <span className="text-xs px-2.5 py-1 rounded-full bg-muted border border-border">Admin approval</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-10">
        <div className="max-w-lg mx-auto">
          <div className="text-center mb-6 lg:hidden">
            <div className="flex justify-center mb-3"><PanelLogo panel="restaurant" size="lg" /></div>
            <h1 className="font-display text-xl font-semibold">Restaurant Owner Registration</h1>
            <p className="text-sm text-muted-foreground mt-1">Register your restaurant on FastMenu</p>
          </div>

          <div className="hidden lg:block mb-6">
            <h1 className="text-2xl font-semibold">Restaurant Owner Registration</h1>
            <p className="text-sm text-muted-foreground mt-1">Complete all steps to submit your venue for approval</p>
          </div>

          <div className="flex gap-1 mb-6 overflow-x-auto">
            {STEPS.map((label, i) => (
              <button
                type="button"
                key={label}
                onClick={() => {
                  // Free navigation — clicking any tab opens that step directly.
                  // Data integrity is still enforced by the Continue button and the
                  // final "Submit for approval" (which jumps to the first incomplete step).
                  setError("");
                  setStep((i + 1) as Step);
                }}
                className={`flex-shrink-0 flex-1 min-w-[4rem] text-center text-2xs sm:text-xs py-2 px-1 rounded-lg border transition-colors cursor-pointer hover:border-border ${
                  step === i + 1 ? "border-primary/50 bg-primary/15 text-primary" : step > i + 1 ? "border-success-border text-success" : "border-border text-muted-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {step === 1 && (
            <div className="space-y-3">
              <h2 className="text-xl font-semibold mb-4">Owner account</h2>
              <input className="field" placeholder="Full name" value={ownerName} onChange={e => setOwnerName(e.target.value)} />
              <input className="field" placeholder="Email" type="email" value={ownerEmail} onChange={e => setOwnerEmail(e.target.value)} />
              <input className="field" placeholder="Mobile (+91)" value={ownerPhone} onChange={e => setOwnerPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} />
              <input className="field" placeholder="Password (min 6 characters)" type="password" value={ownerPassword} onChange={e => setOwnerPassword(e.target.value)} />
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <h2 className="text-xl font-semibold mb-4">Business details</h2>
              <input className="field" placeholder="Restaurant / brand name" value={restaurantName} onChange={e => setRestaurantName(e.target.value)} />
              <select className="field" value={businessType} onChange={e => setBusinessType(e.target.value)}>
                {BUSINESS_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
              <input className="field" placeholder="Street address" value={address} onChange={e => setAddress(e.target.value)} />
              <div className="relative">
                <input className="field w-full" placeholder="PIN code (auto-fills city & state)" value={pincode} onChange={e => handlePincode(e.target.value)} inputMode="numeric" maxLength={6} />
                {pinLoading && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-primary">…</span>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input className="field" placeholder="City" value={city} onChange={e => setCity(e.target.value)} />
                <input className="field" placeholder="State" value={state} onChange={e => setState(e.target.value)} />
              </div>
              <input className="field" placeholder="Business phone" value={restaurantPhone} onChange={e => setRestaurantPhone(e.target.value)} />
              <input className="field" placeholder="Business email (optional)" type="email" value={restaurantEmail} onChange={e => setRestaurantEmail(e.target.value)} />
              <input className="field" placeholder="Website (optional)" value={website} onChange={e => setWebsite(e.target.value)} />
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <h2 className="text-xl font-semibold mb-4">KYC & compliance</h2>
              <div className="rounded-lg bg-success-subtle border border-success-border px-3 py-2 text-2xs text-success">
                Legal business name, bank account & IFSC are required. GST/FSSAI/PAN and document uploads are optional — our team verifies those, and the admin approves your venue.
              </div>
              <input className="field" placeholder="Legal business name *" value={legalBusinessName} onChange={e => setLegalBusinessName(e.target.value)} />
              <input className="field" placeholder="GST number (optional)" value={gstNumber} onChange={e => setGstNumber(e.target.value)} />
              <input className="field" placeholder="FSSAI license number (optional)" value={fssaiNumber} onChange={e => setFssaiNumber(e.target.value)} />
              <input className="field" placeholder="PAN number (optional)" value={panNumber} onChange={e => setPanNumber(e.target.value)} />
              <div className="grid grid-cols-2 gap-3">
                <input className="field" placeholder="Bank account *" value={bankAccount} onChange={e => setBankAccount(e.target.value)} />
                <input className="field" placeholder="IFSC code *" value={ifsc} onChange={e => setIfsc(e.target.value)} />
              </div>
              <div className="border border-border rounded-lg p-4 space-y-3 mt-2">
                <p className="text-xs text-muted-foreground font-semibold uppercase">Business & compliance documents</p>
                <p className="text-2xs text-muted-foreground">All documents are optional. Upload what you have (GST, FSSAI, business registration, bank proof) — the team will verify them during KYC review.</p>
                {REQUIRED_BUSINESS_DOCS.map(def => (
                  <DocUploadField
                    key={def.id}
                    docDef={def}
                    doc={getDoc(def.id)}
                    onUpload={upsertDocument}
                    onClear={() => removeDocument(def.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3 text-sm text-foreground">
              <h2 className="text-xl font-semibold mb-4 text-foreground">Review & submit</h2>
              <p><span className="text-muted-foreground">Role:</span> Restaurant Owner</p>
              <p><span className="text-muted-foreground">Name:</span> {ownerName} · {ownerEmail}</p>
              <p><span className="text-muted-foreground">Venue:</span> {restaurantName} ({businessType})</p>
              <p><span className="text-muted-foreground">Address:</span> {[address, city, state, pincode].filter(Boolean).join(", ")}</p>
              <p><span className="text-muted-foreground">GST:</span> {gstNumber || "—"} · <span className="text-muted-foreground">FSSAI:</span> {fssaiNumber || "—"}</p>
              <p><span className="text-muted-foreground">Documents:</span> {documents.length} attached <span className="text-muted-foreground">(optional — admin verifies)</span></p>
              <p className="text-xs text-muted-foreground pt-2">
                By submitting you confirm the business information is accurate. Your venue will be activated after super admin verification.
              </p>
            </div>
          )}

          {error && <p className="text-xs text-danger mt-3">{error}</p>}

          <div className="flex gap-3 mt-8">
            {step > 1 && (
              <button type="button" onClick={() => setStep((step - 1) as Step)} className="flex-1 py-3 rounded-lg border border-border text-sm font-semibold text-foreground">
                Back
              </button>
            )}
            {step < STEPS.length ? (
              <button type="button" onClick={handleContinue} className="flex-1 py-3 rounded-lg bg-primary hover:bg-primary/90 font-semibold text-sm">
                Continue
              </button>
            ) : (
              <button type="button" onClick={handleSubmit} disabled={loading} className="flex-1 py-3 rounded-lg bg-primary hover:bg-primary/90 disabled:opacity-40 font-semibold text-sm">
                {loading ? "Submitting…" : "Submit for approval"}
              </button>
            )}
          </div>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already registered?{" "}
            <Link href="/restaurant/login" className="text-primary hover:text-primary font-semibold">Sign in</Link>
          </p>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Staff members should ask their manager for access — this page is for restaurant owners only.
          </p>
        </div>
      </div>

      <style>{`.field{width:100%;background:hsl(var(--muted));border:1px solid hsl(var(--border));border-radius:var(--radius-control);padding:.875rem 1rem;font-size:.875rem;color:hsl(var(--foreground))}.field:focus-visible{outline:2px solid hsl(var(--ring));outline-offset:2px}select.field{padding-right:2.5rem;min-height:2.75rem;cursor:pointer}`}</style>
      </>
      )}
    </div>
  );
}
