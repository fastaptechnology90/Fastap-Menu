/**
 * Restaurant owner sign-up.
 *
 * Rebuilt on the public site's design language (`.fastap-site`), so the page an
 * owner lands on from "Start free" looks like the page they clicked it on. The
 * four steps, every field, and the validation behind them are unchanged.
 */
import { useState } from "react";
import { Link } from "wouter";
import { restaurantAuth } from "@/lib/api";
import { SiteBrand } from "@/components/site/SiteBrand";
import {
  AlertCircle, ArrowRight, Check, CheckCircle2, Loader2, Upload, X,
} from "lucide-react";

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
    <div className="rounded-xl border border-border bg-background p-3.5 space-y-2.5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[0.8125rem] font-medium text-foreground leading-snug min-w-0">
          {docDef.label}
          {docDef.required && <span className="text-danger ml-1">*</span>}
        </p>
        {doc?.fileName && (
          <button type="button" onClick={onClear} aria-label="Remove file" className="min-h-8 shrink-0 px-1.5 text-xs font-semibold text-danger">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <label className={`flex items-center gap-2 ${uploading ? "opacity-60 pointer-events-none" : "cursor-pointer"}`}>
        <span className="inline-flex min-h-10 items-center gap-1.5 rounded-full border-2 border-primary/25 bg-primary/10 px-3.5 text-xs font-semibold text-primary hover:bg-primary/15">
          <Upload className="h-4 w-4" />
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
        <p role="alert" className="text-xs text-danger flex items-center gap-1.5">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {uploadError}
        </p>
      )}
      {doc?.fileName && (
        <p className="text-xs text-success flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> {doc.fileName}
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
    <div className="fastap-site min-h-dvh flex flex-col lg:flex-row">
      {submitted ? (
        <div className="flex-1 flex items-center justify-center px-4 py-12 sm:py-16">
          <div className="max-w-md w-full text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success-subtle">
              <CheckCircle2 className="h-9 w-9 text-success" />
            </div>
            <h1 className="fs-display mt-6 text-3xl text-foreground">You're in the queue</h1>
            <p className="mt-4 text-[0.9375rem] leading-relaxed text-muted-foreground">
              <span className="font-semibold text-foreground">{submittedVenue}</span> has been sent to the
              Fastap team for review. You'll be able to sign in once it is approved.
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              We'll write to {ownerEmail}. It usually takes a day.
            </p>
            <Link href="/restaurant/login" className="fs-cta mt-8 w-full">
              Go to sign in <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>
      ) : (
      <>
      {/* ------------------------------------------------- artwork (lg only) */}
      <aside className="relative isolate hidden overflow-hidden lg:flex lg:w-[40%] lg:shrink-0">
        <img src="/img/table-scan.webp" alt="" className="absolute inset-0 -z-10 h-full w-full object-cover" />
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              "linear-gradient(180deg, rgba(12,10,10,0.80) 0%, rgba(12,10,10,0.70) 40%, rgba(12,10,10,0.93) 100%)",
          }}
        />
        <div className="flex w-full flex-col justify-between p-10 xl:p-12">
          <Link href="/" className="inline-flex w-fit"><SiteBrand size="lg" onDark /></Link>

          <div>
            <h2 className="fs-display-xl text-4xl text-white xl:text-5xl">
              Set it up tonight.
              <br />
              <span style={{ color: "#ff8a8f" }}>Serve on it tomorrow.</span>
            </h2>
            <p className="mt-5 max-w-md text-base leading-relaxed text-white/80">
              Four short steps. Only your account, your address and your bank details
              are needed to start — the paperwork can follow.
            </p>

            <ul className="mt-8 space-y-3">
              {["No card to sign up", "Approved in about a day", "KYC documents are optional at this stage"].map(t => (
                <li key={t} className="flex items-center gap-2.5 text-sm text-white/85">
                  <Check className="h-4 w-4 shrink-0" style={{ color: "#ff8a8f" }} />
                  {t}
                </li>
              ))}
            </ul>
          </div>

          <p className="text-xs text-white/45">© {new Date().getFullYear()} Fastap OS</p>
        </div>
      </aside>

      {/* ------------------------------------------------------------- form */}
      <main className="flex-1 overflow-y-auto px-4 py-8 pb-28 sm:px-6 sm:py-10 lg:px-10 lg:pb-10">
        <div className="mx-auto max-w-xl">
          <div className="mb-8 lg:hidden">
            <Link href="/" className="inline-flex"><SiteBrand /></Link>
          </div>

          <h1 className="fs-display text-3xl text-foreground sm:text-4xl">Register your restaurant</h1>
          <p className="mt-2 text-[0.9375rem] text-muted-foreground">
            This page is for owners. Staff should ask their manager for a login.
          </p>

          {/* Step tabs. Free navigation — Continue and the final submit are what
              actually enforce completeness. */}
          <div className="mt-7 flex gap-2 overflow-x-auto overscroll-x-contain no-scrollbar pb-1">
            {STEPS.map((label, i) => {
              const isCurrent = step === i + 1;
              const isDone = step > i + 1;
              return (
                <button
                  type="button"
                  key={label}
                  onClick={() => { setError(""); setStep((i + 1) as Step); }}
                  aria-current={isCurrent ? "step" : undefined}
                  className={`flex min-h-10 flex-1 shrink-0 items-center justify-center gap-1.5 rounded-full border-2 px-3 text-xs font-semibold transition-colors ${
                    isCurrent
                      ? "border-primary bg-primary text-white"
                      : isDone
                        ? "border-success-border bg-success-subtle text-success"
                        : "border-border bg-background text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  {isDone && <Check className="h-3.5 w-3.5" />}
                  {label}
                </button>
              );
            })}
          </div>
          <div className="mt-6" />

          {step === 1 && (
            <div className="space-y-4">
              <h2 className="fs-display text-xl text-foreground">Your account</h2>
              <div>
                <label className="fs-label" htmlFor="rg-name">Full name</label>
                <input id="rg-name" className="fs-field" placeholder="Priya Sharma" autoComplete="name" value={ownerName} onChange={e => setOwnerName(e.target.value)} />
              </div>
              <div>
                <label className="fs-label" htmlFor="rg-email">Email</label>
                <input id="rg-email" className="fs-field" placeholder="you@yourrestaurant.com" type="email" autoComplete="email" value={ownerEmail} onChange={e => setOwnerEmail(e.target.value)} />
              </div>
              <div>
                <label className="fs-label" htmlFor="rg-phone">Mobile</label>
                <input id="rg-phone" className="fs-field" placeholder="98765 43210" inputMode="numeric" autoComplete="tel-national" value={ownerPhone} onChange={e => setOwnerPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} />
              </div>
              <div>
                <label className="fs-label" htmlFor="rg-pass">Password</label>
                <input id="rg-pass" className="fs-field" placeholder="At least 6 characters" type="password" autoComplete="new-password" value={ownerPassword} onChange={e => setOwnerPassword(e.target.value)} />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="fs-display text-xl text-foreground">Your restaurant</h2>
              <div>
                <label className="fs-label" htmlFor="rg-venue">Restaurant / brand name</label>
                <input id="rg-venue" className="fs-field" placeholder="The Grand Spice" value={restaurantName} onChange={e => setRestaurantName(e.target.value)} />
              </div>
              <div>
                <label className="fs-label" htmlFor="rg-type">What kind of place is it?</label>
                <select id="rg-type" className="fs-field cursor-pointer" value={businessType} onChange={e => setBusinessType(e.target.value)}>
                  {BUSINESS_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="fs-label" htmlFor="rg-addr">Street address</label>
                <input id="rg-addr" className="fs-field" placeholder="42 MG Road" autoComplete="street-address" value={address} onChange={e => setAddress(e.target.value)} />
              </div>
              <div>
                <label className="fs-label" htmlFor="rg-pin">PIN code</label>
                <div className="relative">
                  <input id="rg-pin" className="fs-field" placeholder="Fills in city and state for you" value={pincode} onChange={e => handlePincode(e.target.value)} inputMode="numeric" maxLength={6} />
                  {pinLoading && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-primary" />}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="fs-label" htmlFor="rg-city">City</label>
                  <input id="rg-city" className="fs-field" placeholder="Bangalore" value={city} onChange={e => setCity(e.target.value)} />
                </div>
                <div>
                  <label className="fs-label" htmlFor="rg-state">State</label>
                  <input id="rg-state" className="fs-field" placeholder="Karnataka" value={state} onChange={e => setState(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="fs-label" htmlFor="rg-bphone">Business phone</label>
                <input id="rg-bphone" className="fs-field" placeholder="080 4567 8900" value={restaurantPhone} onChange={e => setRestaurantPhone(e.target.value)} />
              </div>
              <div>
                <label className="fs-label" htmlFor="rg-bemail">Business email <span className="font-normal text-muted-foreground">(optional)</span></label>
                <input id="rg-bemail" className="fs-field" placeholder="hello@yourrestaurant.com" type="email" value={restaurantEmail} onChange={e => setRestaurantEmail(e.target.value)} />
              </div>
              <div>
                <label className="fs-label" htmlFor="rg-web">Website <span className="font-normal text-muted-foreground">(optional)</span></label>
                <input id="rg-web" className="fs-field" placeholder="yourrestaurant.com" value={website} onChange={e => setWebsite(e.target.value)} />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="fs-display text-xl text-foreground">Business and bank</h2>
              <p className="rounded-xl border border-success-border bg-success-subtle px-3.5 py-2.5 text-xs leading-relaxed text-success">
                Only the legal name, bank account and IFSC are needed now — that is what payouts
                go to. GST, FSSAI, PAN and the document uploads can all wait; our team collects
                them during review.
              </p>
              <div>
                <label className="fs-label" htmlFor="rg-legal">Legal business name <span className="text-danger">*</span></label>
                <input id="rg-legal" className="fs-field" placeholder="As it appears on your registration" value={legalBusinessName} onChange={e => setLegalBusinessName(e.target.value)} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="fs-label" htmlFor="rg-bank">Bank account <span className="text-danger">*</span></label>
                  <input id="rg-bank" className="fs-field" placeholder="Account number" value={bankAccount} onChange={e => setBankAccount(e.target.value)} />
                </div>
                <div>
                  <label className="fs-label" htmlFor="rg-ifsc">IFSC code <span className="text-danger">*</span></label>
                  <input id="rg-ifsc" className="fs-field" placeholder="HDFC0001234" value={ifsc} onChange={e => setIfsc(e.target.value)} />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="fs-label" htmlFor="rg-gst">GST <span className="font-normal text-muted-foreground">(optional)</span></label>
                  <input id="rg-gst" className="fs-field" placeholder="29AABCT…" value={gstNumber} onChange={e => setGstNumber(e.target.value)} />
                </div>
                <div>
                  <label className="fs-label" htmlFor="rg-fssai">FSSAI <span className="font-normal text-muted-foreground">(optional)</span></label>
                  <input id="rg-fssai" className="fs-field" placeholder="License no." value={fssaiNumber} onChange={e => setFssaiNumber(e.target.value)} />
                </div>
                <div>
                  <label className="fs-label" htmlFor="rg-pan">PAN <span className="font-normal text-muted-foreground">(optional)</span></label>
                  <input id="rg-pan" className="fs-field" placeholder="ABCDE1234F" value={panNumber} onChange={e => setPanNumber(e.target.value)} />
                </div>
              </div>

              <div className="fs-tile mt-2 space-y-3 bg-muted p-4">
                <div>
                  <p className="fs-display text-sm text-foreground">Documents</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    All optional. Upload whatever you have to hand and we will verify it during review.
                  </p>
                </div>
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
            <div>
              <h2 className="fs-display text-xl text-foreground">Check it over</h2>
              <dl className="fs-tile mt-4 divide-y divide-border">
                {[
                  ["Role", "Restaurant owner"],
                  ["You", [ownerName, ownerEmail].filter(Boolean).join(" · ") || "—"],
                  ["Venue", restaurantName ? `${restaurantName} (${businessType})` : "—"],
                  ["Address", [address, city, state, pincode].filter(Boolean).join(", ") || "—"],
                  ["Legal name", legalBusinessName || "—"],
                  ["Bank", [bankAccount, ifsc].filter(Boolean).join(" · ") || "—"],
                  ["GST / FSSAI", `${gstNumber || "—"} · ${fssaiNumber || "—"}`],
                  ["Documents", `${documents.length} attached`],
                ].map(([k, v]) => (
                  <div key={k} className="flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:gap-4">
                    <dt className="w-32 shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{k}</dt>
                    <dd className="min-w-0 break-words text-[0.9375rem] text-foreground">{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                By submitting you confirm the business information above is accurate. Your venue
                goes live once our team has verified it.
              </p>
            </div>
          )}

          {error && (
            <p role="alert" className="mt-5 flex items-start gap-2 rounded-xl border border-danger-border bg-danger-subtle px-3.5 py-2.5 text-sm text-danger">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </p>
          )}

          <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-background/95 px-4 py-3 backdrop-blur lg:static lg:mt-8 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:backdrop-blur-none">
            <div className="mx-auto flex max-w-xl gap-3">
              {step > 1 && (
                <button
                  type="button"
                  onClick={() => setStep((step - 1) as Step)}
                  className="fs-cta-ghost flex-1 border-border text-foreground hover:bg-muted"
                >
                  Back
                </button>
              )}
              {step < STEPS.length ? (
                <button type="button" onClick={handleContinue} className="fs-cta flex-1">
                  Continue <ArrowRight className="h-5 w-5" />
                </button>
              ) : (
                <button type="button" onClick={handleSubmit} disabled={loading} className="fs-cta flex-1 disabled:opacity-50">
                  {loading
                    ? <Loader2 className="h-5 w-5 animate-spin" />
                    : <>Submit for approval <ArrowRight className="h-5 w-5" /></>}
                </button>
              )}
            </div>
          </div>

          <p className="mt-7 text-center text-sm text-muted-foreground">
            Already registered?{" "}
            <Link href="/restaurant/login" className="font-semibold text-primary underline underline-offset-2">
              Sign in
            </Link>
          </p>
        </div>
      </main>
      </>
      )}
    </div>
  );
}
